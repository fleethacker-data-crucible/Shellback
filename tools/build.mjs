#!/usr/bin/env node
/**
 * Synapse build — runs OFF the workstation (TechStack "Build rules").
 *
 *   node tools/build.mjs          → writes dist/
 *   node tools/build.mjs --check  → rebuilds into a temp dir and fails if dist/ is stale
 *
 * Produces:
 *   dist/index.html                 served edition (PowerShell / Node static server)
 *   dist/assets/app.js, app.css     esbuild + Tailwind 4 output, all dependencies bundled
 *   dist/sw.js                      service worker with a precache list keyed by content hash
 *   dist/Synapse-Standalone.html    single-file edition (double-click, file://)
 *   dist/build-manifest.json        sha256 of every shipped file (reproducibility check)
 *
 * No CDN, no runtime network calls, no telemetry. Output is deterministic for a given
 * source tree and dependency set, so CI can verify the committed dist/ matches.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const outDir = check ? fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-dist-')) : path.join(root, 'dist');

// ---------------------------------------------------------------------------
// Dependency resolution: local node_modules first, then NODE_PATH entries.
// ---------------------------------------------------------------------------
const nodePaths = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
const require = createRequire(path.join(root, 'package.json'));
function resolvePkg(name) {
  try { return require.resolve(name, { paths: [root, ...nodePaths] }); }
  catch (e) { throw new Error(`Cannot resolve "${name}". Run "npm install" or set NODE_PATH. (${e.message})`); }
}
const esbuild = await import(pathToFileURL(resolvePkg('esbuild')).href);
const tailwindEntry = resolvePkg('tailwindcss');
const tailwindDir = path.dirname(path.dirname(tailwindEntry)); // …/tailwindcss/dist/lib.js → …/tailwindcss
const { compile: tailwindCompile } = await import(pathToFileURL(path.join(tailwindDir, 'dist/lib.mjs')).href);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sha256b64 = (buf) => crypto.createHash('sha256').update(buf).digest('base64');

fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });

// ---------------------------------------------------------------------------
// 1. Worker bundle (inlined into the app as a Blob so it also works from file://)
// ---------------------------------------------------------------------------
const workerBuild = await esbuild.build({
  entryPoints: [path.join(root, 'src/workers/scan.worker.ts')],
  bundle: true, write: false, minify: true, format: 'iife', target: ['es2022'],
  platform: 'browser', nodePaths, legalComments: 'none', charset: 'utf8',
});
const workerCode = workerBuild.outputFiles[0].text;

// ---------------------------------------------------------------------------
// 2. Application bundle
// ---------------------------------------------------------------------------
const inlineWorkerPlugin = {
  name: 'inline-worker',
  setup(build) {
    build.onResolve({ filter: /^worker:scan$/ }, () => ({ path: 'worker:scan', namespace: 'inline-worker' }));
    build.onLoad({ filter: /.*/, namespace: 'inline-worker' }, () => ({
      contents: `export default ${JSON.stringify(workerCode)};`, loader: 'js',
    }));
  },
};
const appBuild = await esbuild.build({
  entryPoints: [path.join(root, 'src/app/main.tsx')],
  bundle: true, write: false, minify: true, format: 'esm', target: ['es2022', 'chrome120', 'edge120', 'firefox120'],
  platform: 'browser', nodePaths, legalComments: 'none', charset: 'utf8', sourcemap: false,
  jsx: 'automatic', define: {
    'process.env.NODE_ENV': '"production"',
    '__SYNAPSE_VERSION__': JSON.stringify(pkg.version),
  },
  loader: { '.json': 'json' },
  plugins: [inlineWorkerPlugin],
  metafile: true,
});
if (process.argv.includes('--analyze')) console.log(await esbuild.analyzeMetafile(appBuild.metafile, { verbose: false }));
const appJs = appBuild.outputFiles[0].text;

// ---------------------------------------------------------------------------
// 3. Tailwind 4 — driven through its compile() API with our own candidate scan,
//    so the build has no dependency on the Tailwind CLI / oxide binary.
// ---------------------------------------------------------------------------
function listFiles(dir, exts, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(p, exts, acc);
    else if (exts.some((e) => p.endsWith(e))) acc.push(p);
  }
  return acc;
}
const candidates = new Set();
for (const file of listFiles(path.join(root, 'src'), ['.ts', '.tsx', '.html']).sort()) {
  const text = fs.readFileSync(file, 'utf8');
  for (const token of text.match(/[^\s"'`<>{}();,]+/g) || []) candidates.add(token);
}
const twCompiler = await tailwindCompile(read('src/styles/app.css'), {
  base: path.join(root, 'src/styles'),
  loadStylesheet: async (id, base) => {
    let p;
    if (id === 'tailwindcss') p = path.join(tailwindDir, 'index.css');
    else if (id.startsWith('tailwindcss/')) p = path.join(tailwindDir, id.slice('tailwindcss/'.length));
    else p = path.resolve(base, id);
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
  },
  loadModule: async (id) => { throw new Error(`Tailwind plugins are not used in this build (requested ${id})`); },
});
const appCss = twCompiler.build([...candidates].sort());

// ---------------------------------------------------------------------------
// 4. HTML (served) + service worker + standalone
// ---------------------------------------------------------------------------
const template = read('public/index.html');
const cspBase = [
  "default-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
];
const buildId = sha256(appJs + appCss + template).slice(0, 12);

function renderHtml({ css, js, inline }) {
  const scriptSrc = inline ? `'sha256-${sha256b64(js)}'` : "'self'";
  const csp = [...cspBase, `script-src ${scriptSrc} blob:`].join('; ');
  return template
    .replaceAll('{{CSP}}', csp)
    .replaceAll('{{BUILD_ID}}', buildId)
    .replaceAll('{{VERSION}}', pkg.version)
    .replaceAll('{{EDITION}}', inline ? 'standalone' : 'served')
    .replace('{{STYLES}}', () => (inline ? `<style>${css}</style>` : '<link rel="stylesheet" href="./assets/app.css">'))
    .replace('{{SCRIPT}}', () => (inline ? `<script type="module">${js}</script>` : '<script type="module" src="./assets/app.js"></script>'));
  // NOTE: function replacers — minified JS contains `$&`/`$'` sequences that string replacers would expand.
}

const served = renderHtml({ css: appCss, js: appJs, inline: false });
const standalone = renderHtml({ css: appCss, js: appJs, inline: true });

const precache = ['./', './index.html', './assets/app.js', './assets/app.css'];
const sw = read('public/sw.js')
  .replace('{{BUILD_ID}}', () => buildId)
  .replace('{{PRECACHE}}', () => JSON.stringify(precache));

const outputs = {
  'index.html': served,
  'assets/app.js': appJs,
  'assets/app.css': appCss,
  'sw.js': sw,
  'Synapse-Standalone.html': standalone,
};
for (const [rel, content] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(outDir, rel), content);
}
const manifest = {
  name: pkg.name, version: pkg.version, buildId,
  files: Object.fromEntries(Object.entries(outputs).map(([rel, content]) => [rel, { bytes: Buffer.byteLength(content), sha256: sha256(content) }])),
};
fs.writeFileSync(path.join(outDir, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// ---------------------------------------------------------------------------
// 5. Report / check
// ---------------------------------------------------------------------------
if (check) {
  const committed = path.join(root, 'dist');
  const stale = [];
  for (const rel of [...Object.keys(outputs), 'build-manifest.json']) {
    const a = path.join(outDir, rel), b = path.join(committed, rel);
    if (!fs.existsSync(b) || sha256(fs.readFileSync(a)) !== sha256(fs.readFileSync(b))) stale.push(rel);
  }
  fs.rmSync(outDir, { recursive: true, force: true });
  if (stale.length) {
    console.error(`dist/ is stale. Run "npm run build" and commit:\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`dist/ is up to date (build ${buildId}).`);
} else {
  for (const [rel, info] of Object.entries(manifest.files)) console.log(`${rel.padEnd(26)} ${(info.bytes / 1024).toFixed(1).padStart(8)} KB`);
  console.log(`build ${buildId} → ${path.relative(root, outDir)}/`);
}
