#!/usr/bin/env node
/**
 * Shellback command-line entry point, for people and for agents.
 *   node tools/shellback.mjs commands --json   every command, machine-readable
 *   node tools/shellback.mjs commands          the same list for people
 *   node tools/shellback.mjs run <name>        run one command (same as npm run <name>)
 * The registry is read from package.json scripts, so the CLI and npm cannot drift.
 * tests/unit/cli-parity.test.ts enforces that every script has a summary and that every tool it names exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SUMMARIES = {
  build: 'Compile the app into dist/ (committed output)',
  'build:check': 'Fail if dist/ is out of date with the sources',
  'build:intel': 'Build a host-specific edition into dist-intel/ (not committed)',
  serve: 'Serve dist/ on 127.0.0.1 for the served edition',
  'serve:intel': 'Serve the host-specific edition from dist-intel/',
  test: 'Run every check: typecheck, unit tests, build check, browser tests',
  'test:unit': 'Run the unit test suites with Node’s test runner',
  'test:e2e': 'Run the browser suites against the compiled output (needs Playwright Chromium)',
  typecheck: 'Type-check the whole app',
  'typecheck:core': 'Type-check the core logic in strict mode',
  'typecheck:offline': 'Type-check the offline build configuration',
  'typecheck:tests': 'Type-check the test files',
  'intel:adapter': 'Run the loopback adapter for OpenAI-compatible gateways',
};

/** One entry per npm script. `command` is the script text exactly as package.json has it. */
export function commandRegistry(scripts) {
  return Object.entries(scripts).map(([name, command]) => ({ name, summary: SUMMARIES[name] ?? 'No summary yet', command }));
}

function main(argv) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const registry = commandRegistry(pkg.scripts);
  const [cmd, ...rest] = argv;

  if (cmd === 'commands') {
    if (rest.includes('--json')) {
      console.log(JSON.stringify({ commands: registry }, null, 2));
    } else {
      for (const c of registry) console.log(`${c.name.padEnd(18)} ${c.summary}`);
    }
    return 0;
  }
  if (cmd === 'run') {
    const name = rest[0];
    const entry = registry.find((c) => c.name === name);
    if (!entry) {
      console.error(`Unknown command: ${name ?? '(none)'}. Run: node tools/shellback.mjs commands`);
      return 2;
    }
    const r = spawnSync(`npm run ${entry.name}`, { cwd: root, shell: true, stdio: 'inherit' });
    return r.status ?? 1;
  }
  console.error('Usage: node tools/shellback.mjs commands [--json] | run <name>');
  return 2;
}

process.exitCode = main(process.argv.slice(2));
