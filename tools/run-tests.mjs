#!/usr/bin/env node
/**
 * Test runner: bundles tests/<suite>/*.test.ts (suite = unit | e2e; default unit) with esbuild (same resolver as the app build,
 * so TS path/JSON imports behave identically) and runs them with Node's built-in test runner.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodePaths = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
const require = createRequire(path.join(root, 'package.json'));
const esbuild = await import(pathToFileURL(require.resolve('esbuild', { paths: [root, ...nodePaths] })).href);

const suite = process.argv[2] === 'e2e' ? 'e2e' : 'unit';
const testDir = path.join(root, 'tests', suite);
const entries = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.ts')).map((f) => path.join(testDir, f));
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shellback-tests-'));
// Keep the original directory depth so `new URL('../../examples/…', import.meta.url)` resolves from tests/unit.
const outUnit = path.join(outDir, 'tests', suite);

await esbuild.build({
  entryPoints: entries, outdir: outUnit, bundle: true, platform: 'node', format: 'esm', target: 'node22',
  nodePaths, sourcemap: 'inline', logLevel: 'warning', jsx: 'automatic',
  external: ['node:*', 'playwright', 'playwright-core'], loader: { '.json': 'json' },
  plugins: [{ name: 'worker-stub', setup(b) { b.onResolve({ filter: /^worker:scan$/ }, () => ({ path: 'worker:scan', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default ""', loader: 'js' })); } }],
  outExtension: { '.js': '.mjs' },
});
// 'junction' needs no admin rights on Windows; the type is ignored on other platforms.
fs.symlinkSync(path.join(root, 'examples'), path.join(outDir, 'examples'), 'junction');

const files = fs.readdirSync(outUnit).filter((f) => f.endsWith('.mjs')).map((f) => path.join(outUnit, f));
// e2e bundles live in a temp dir, so let them resolve playwright from the repo / NODE_PATH.
const env = { ...process.env, NODE_PATH: [path.join(root, 'node_modules'), ...nodePaths].join(path.delimiter), SHELLBACK_ROOT: root };
const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-concurrency=1', ...files], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');

// On GitHub Actions, surface each failing test as an annotation so failures are readable on the
// PR checks page (and through the API) without opening the raw log.
if (process.env.GITHUB_ACTIONS && r.status !== 0) {
  const lines = (r.stdout ?? '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*not ok \d+ - (.*)$/.exec(lines[i]);
    if (!m) continue;
    const detail = [];
    for (let j = i + 1; j < lines.length && !/^\s*\.\.\.\s*$/.test(lines[j]); j++) detail.push(lines[j]);
    const text = detail.filter((l) => !/^\s+(duration_ms|type|failureType|code|location):/.test(l)).join('\n').slice(0, 3500);
    const esc = (v) => v.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::error title=${esc(`${suite}: ${m[1]}`).replace(/[:,]/g, ' ')}::${esc(text)}`);
  }
  if (r.error) console.log(`::error title=${suite} runner::${String(r.error)}`);
}

// Remove the examples link itself first (never its target), then the temp tree.
try { fs.unlinkSync(path.join(outDir, 'examples')); } catch { /* already gone */ }
fs.rmSync(outDir, { recursive: true, force: true });
process.exit(r.status ?? 1);
