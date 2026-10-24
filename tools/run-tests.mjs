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
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-tests-'));
// Keep the original directory depth so `new URL('../../examples/…', import.meta.url)` resolves from tests/unit.
const outUnit = path.join(outDir, 'tests', suite);

await esbuild.build({
  entryPoints: entries, outdir: outUnit, bundle: true, platform: 'node', format: 'esm', target: 'node22',
  nodePaths, sourcemap: 'inline', logLevel: 'warning', jsx: 'automatic',
  external: ['node:*', 'playwright', 'playwright-core'], loader: { '.json': 'json' },
  plugins: [{ name: 'worker-stub', setup(b) { b.onResolve({ filter: /^worker:scan$/ }, () => ({ path: 'worker:scan', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default ""', loader: 'js' })); } }],
  outExtension: { '.js': '.mjs' },
});
fs.symlinkSync(path.join(root, 'examples'), path.join(outDir, 'examples'), 'dir');

const files = fs.readdirSync(outUnit).filter((f) => f.endsWith('.mjs')).map((f) => path.join(outUnit, f));
// e2e bundles live in a temp dir, so let them resolve playwright from the repo / NODE_PATH.
const env = { ...process.env, NODE_PATH: [path.join(root, 'node_modules'), ...nodePaths].join(path.delimiter), SYNAPSE_ROOT: root };
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { stdio: 'inherit', env });
fs.rmSync(outDir, { recursive: true, force: true });
process.exit(r.status ?? 1);
