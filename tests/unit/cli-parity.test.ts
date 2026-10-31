import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.env.SHELLBACK_ROOT ?? process.cwd();
const cli = path.join(root, 'tools', 'shellback.mjs');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };

function run(args: string[]) {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

test('commands --json lists every npm script, once, with a summary and the exact script text', () => {
  const r = run(['commands', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const { commands } = JSON.parse(r.stdout) as { commands: Array<{ name: string; summary: string; command: string }> };
  assert.deepEqual(commands.map((c) => c.name).sort(), Object.keys(pkg.scripts).sort(), 'the registry and package.json agree on names');
  for (const c of commands) {
    assert.equal(c.command, pkg.scripts[c.name], `${c.name}: command matches package.json`);
    assert.notEqual(c.summary, 'No summary yet', `${c.name} needs a summary in tools/shellback.mjs`);
  }
});

test('every tool a command names exists in the repository', () => {
  const { commands } = JSON.parse(run(['commands', '--json']).stdout) as { commands: Array<{ name: string; command: string }> };
  for (const c of commands) {
    for (const m of c.command.matchAll(/node (tools\/[\w.-]+\.mjs)/g)) {
      assert.ok(existsSync(path.join(root, m[1]!)), `${c.name} names ${m[1]}, which does not exist`);
    }
  }
});

test('the plain listing names every command too', () => {
  const r = run(['commands']);
  assert.equal(r.status, 0, r.stderr);
  for (const name of Object.keys(pkg.scripts)) assert.match(r.stdout, new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`, 'm'), name);
});

test('run rejects unknown names and no-argument calls with exit code 2', () => {
  assert.equal(run(['run', 'no-such-command']).status, 2);
  assert.equal(run(['run']).status, 2);
  assert.equal(run([]).status, 2);
});
