/**
 * TechStack "Lifecycle rules" against the compiled dist/ and the Node twin of Serve-Synapse.ps1
 * (tools/serve.mjs implements the same presence rule). --leaving-ms shortens the grace; the 60 s
 * timeout means a stop within seconds can only come from the pagehide beacon. The PowerShell rule is covered by
 * tests/ps/Lifecycle.Tests.ps1 on the Windows CI runner.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Browser } from 'playwright';

const root = process.env.SYNAPSE_ROOT ?? process.cwd();
const { chromium } = createRequire(path.join(root, 'package.json'))('playwright') as typeof import('playwright');

let browser: Browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

interface Served { proc: ChildProcess; url: string; exited: Promise<number | null>; isRunning: () => boolean }
async function serve(extra: string[] = []): Promise<Served> {
  const proc = spawn(process.execPath, [path.join(root, 'tools/serve.mjs'), '--port', '0', ...extra], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, SYNAPSE_AUTO_STOP: '' } });
  let running = true;
  const exited = new Promise<number | null>((resolve) => proc.on('exit', (code) => { running = false; resolve(code); }));
  const url = await new Promise<string>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 10_000);
    proc.stdout!.on('data', (b: Buffer) => { const m = /http:\/\/127\.0\.0\.1:\d+\//.exec(String(b)); if (m) { clearTimeout(t); resolve(m[0]); } });
  });
  return { proc, url, exited, isRunning: () => running };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const within = <T>(p: Promise<T>, ms: number, what: string) => Promise.race([p, sleep(ms).then(() => { throw new Error(`timed out: ${what}`); })]);

test('closing the last tab stops the server; a reload does not', async () => {
  const s = await serve(['--timeout-ms', '60000', '--leaving-ms', '1000']);
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(s.url);
    await page.locator('#metricSkills').waitFor();
    await page.reload();
    await page.locator('#metricSkills').waitFor();
    await sleep(1800); // longer than the leaving grace: the reload's fresh heartbeat kept it alive
    assert.equal(s.isRunning(), true, 'a reload must not stop the server');
    await page.close({ runBeforeUnload: true });
    await within(s.exited, 6000, 'server should stop after the tab closed');
    await context.close();
  } finally { if (s.isRunning()) s.proc.kill(); }
});

test('two tabs: closing one keeps the server for the other', async () => {
  const s = await serve(['--timeout-ms', '60000', '--leaving-ms', '1000']);
  try {
    const context = await browser.newContext();
    const a = await context.newPage(), b = await context.newPage();
    for (const p of [a, b]) { await p.goto(s.url); await p.locator('#metricSkills').waitFor(); }
    await a.close({ runBeforeUnload: true });
    await sleep(4000); // past the leaving grace; tab b keeps heartbeating
    assert.equal(s.isRunning(), true, 'the other tab is still open');
    await b.close({ runBeforeUnload: true });
    await within(s.exited, 6000, 'server should stop after the last tab closed');
    await context.close();
  } finally { if (s.isRunning()) s.proc.kill(); }
});

test('End session in the navigation stops the server and says so', async () => {
  const s = await serve(['--stay']);
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(s.url);
    await page.locator('#metricSkills').waitFor();
    await page.locator('#endSessionBtn').click();
    await page.locator('dialog [data-dialog="confirm"]').click();
    await page.locator('#sessionEnded').waitFor();
    await within(s.exited, 5000, 'server should stop on End session');
    assert.deepEqual(errors, []);
    await context.close();
  } finally { if (s.isRunning()) s.proc.kill(); }
});

test('lifecycle routes refuse other origins and GET; --stay keeps running', async () => {
  const s = await serve(['--stay', '--timeout-ms', '500', '--leaving-ms', '200']);
  try {
    const origin = s.url.replace(/\/$/, '');
    const post = (p: string, headers: Record<string, string>) => fetch(s.url + p.slice(1), { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{"leaving":true}' });
    assert.equal((await post('/api/session/stop', { Origin: 'http://evil.example', 'X-Synapse-Intent': 'end-session' })).status, 403);
    assert.equal((await post('/api/session/stop', { Origin: origin })).status, 403, 'End session needs its intent header');
    assert.equal((await post('/api/heartbeat', { Origin: 'http://evil.example' })).status, 403);
    assert.equal((await fetch(s.url + 'api/heartbeat')).status, 405);
    assert.equal((await post('/api/heartbeat', { Origin: origin })).status, 204);
    await sleep(1200);
    assert.equal(s.isRunning(), true, '--stay ignores the presence rule');
  } finally { if (s.isRunning()) s.proc.kill(); }
});

test('standalone edition has no server and no End session control', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/')) requests.push(r.url()); });
  await page.goto(pathToFileURL(path.join(root, 'dist/Synapse-Standalone.html')).href);
  await page.locator('#metricSkills').waitFor();
  assert.equal(await page.locator('#endSessionBtn').count(), 0);
  assert.deepEqual(requests, []);
  await context.close();
});
