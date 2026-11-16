import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  allowedForward,
  fairleadSocketOptions,
  FORWARD_TIMEOUT_MS,
  handleFairleadProxy,
  ID_TIMEOUT_MS,
  identityDecision,
  localTokenDisabled,
  loopbackFairleadRequest,
  MAX_RESPONSE_BYTES,
  parseFairleadId,
  parseProcNetTcp,
  pathsEqual,
  pinnedContentType,
  readLocalTokenText,
  scrub,
} from '../../tools/fairlead-forward.mjs';

const root = process.env.SHELLBACK_ROOT ?? process.cwd();
const PROGRAM = 'C:\\Fairlead\\scripts\\Start-Fairlead.ps1';

test('the account token is the first line only, and a huge or empty file is refused', () => {
  assert.equal(readLocalTokenText('  fl-local \r\nsecond'), 'fl-local');
  assert.equal(readLocalTokenText('\uFEFFfl-local\n'), 'fl-local');
  assert.equal(readLocalTokenText('   \n'), null);
  assert.equal(readLocalTokenText('x'.repeat(5000)), null);
  assert.equal(localTokenDisabled({ FAIRLEAD_LOCAL_TOKEN: 'off' }), true);
  assert.equal(localTokenDisabled({}), false);
});

test('only the model list and chat completions are forwarded', () => {
  assert.equal(allowedForward('GET', '/v1/models'), true);
  assert.equal(allowedForward('POST', '/v1/chat/completions'), true);
  assert.equal(allowedForward('POST', '/v1/models'), false);
  assert.equal(allowedForward('GET', '/api/config'), false);
});

test('the id answer must be Fairlead, with a pid and a path', () => {
  assert.deepEqual(parseFairleadId({ tool: 'fairlead', pid: 42, path: PROGRAM }), { ok: true, pid: 42, path: PROGRAM });
  const foreign = parseFairleadId({ tool: 'other', pid: 1, path: 'x' });
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.match(foreign.error, /not Fairlead/);
  assert.equal(parseFairleadId({ tool: 'fairlead', pid: 0, path: PROGRAM }).ok, false);
  assert.equal(parseFairleadId({ tool: 'fairlead', pid: 4, path: '  ' }).ok, false);
});

test('the token is sent only when the listener pid and the process path match', () => {
  const id = parseFairleadId({ tool: 'fairlead', pid: 42, path: PROGRAM });
  assert.equal(identityDecision(id, [42], [PROGRAM]).ok, true);
  assert.equal(identityDecision(id, [42], ['C:/Fairlead/scripts/Start-Fairlead.ps1']).ok, true);
  assert.equal(pathsEqual(PROGRAM, 'c:/fairlead/scripts/start-fairlead.ps1'), true);
  assert.match(identityDecision(id, null, [PROGRAM]).ok ? '' : (identityDecision(id, null, [PROGRAM]) as { error: string }).error, /could not see/);
  assert.match(identityDecision(id, [], [PROGRAM]).ok ? '' : (identityDecision(id, [], [PROGRAM]) as { error: string }).error, /not running/);
  assert.match(identityDecision(id, [7], [PROGRAM]).ok ? '' : (identityDecision(id, [7], [PROGRAM]) as { error: string }).error, /account token was not sent/);
  assert.match(identityDecision(id, [42], ['C:\\other\\app.exe']).ok ? '' : (identityDecision(id, [42], ['C:\\other\\app.exe']) as { error: string }).error, /not what that process runs/);
});

test('returned text never keeps the token', () => {
  assert.equal(scrub('refused fl-secret-value today', 'fl-secret-value'), 'refused [key] today');
  assert.doesNotMatch(scrub('fl-secret-value', 'fl-secret-value'), /fl-secret-value/);
});

test('proc net tcp keeps loopback listeners and skips other addresses', () => {
  const text = [
    'sl local_address rem_address st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode',
    '0: 0100007F:2248 00000000:0000 0A 0:0 0:0 0 0 0 99 1 00000000 100 0 0 10 0',
    '1: 0101A8C0:2248 00000000:0000 0A 0:0 0:0 0 0 0 50 1 00000000 100 0 0 10 0',
  ].join('\n');
  assert.deepEqual(parseProcNetTcp(text, 8776), ['99']);
});

test('Fairlead calls stay on loopback, with a timeout and no proxy agent', () => {
  const id = fairleadSocketOptions(ID_TIMEOUT_MS);
  const forward = fairleadSocketOptions(FORWARD_TIMEOUT_MS);
  assert.deepEqual(id, { host: '127.0.0.1', port: 8776, timeout: 3000 });
  assert.equal(forward.timeout, 45000);
  assert.equal('agent' in id, false);
  const src = readFileSync(path.join(root, 'tools', 'fairlead-forward.mjs'), 'utf8');
  assert.match(src, /from 'node:http'/);
  assert.doesNotMatch(src, /fetch\(/);
  assert.equal(pinnedContentType('text/html; charset=utf-8'), 'text/plain; charset=utf-8');
  assert.equal(pinnedContentType('application/json'), 'application/json; charset=utf-8');
});

test('a matching Fairlead is called with the label and the account token, which the page does not receive', async () => {
  const token = 'fl-account-token-value';
  const seen: Array<{ path: string; timeoutMs: number; authorization?: string; label?: string; privacy?: string }> = [];
  const requestImpl = async (call: { path: string; timeoutMs: number; headers?: Record<string, string> }) => {
    seen.push({ path: call.path, timeoutMs: call.timeoutMs, authorization: call.headers?.authorization, label: call.headers?.['x-fairlead-label'], privacy: call.headers?.['x-fairlead-privacy'] });
    if (call.path === '/__fleethacker/id') {
      return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify({ tool: 'fairlead', pid: 42, path: PROGRAM })) };
    }
    return { status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(JSON.stringify({ data: [{ id: 'local' }], echo: token })) };
  };
  const result = await handleFairleadProxy({
    method: 'GET',
    pathname: '/api/fairlead/v1/models',
    originOk: true,
    env: {},
    requestImpl,
    listenerPids: () => [42],
    processPaths: () => [PROGRAM],
    readToken: () => token,
  });
  assert.equal(result.status, 200);
  assert.equal(seen[0]?.path, '/__fleethacker/id');
  assert.equal(seen[0]?.timeoutMs, ID_TIMEOUT_MS);
  assert.equal(seen[0]?.authorization, undefined);
  assert.equal(seen[1]?.path, '/v1/models');
  assert.equal(seen[1]?.timeoutMs, FORWARD_TIMEOUT_MS);
  assert.equal(seen[1]?.authorization, `Bearer ${token}`);
  assert.equal(seen[1]?.label, 'Shellback');
  assert.equal(seen[1]?.privacy, 'local');
  assert.equal(result.contentType, 'text/plain; charset=utf-8', 'an HTML content type is not passed through');
  assert.equal(result.body.includes(Buffer.from(token)), false);
  assert.match(result.body.toString('utf8'), /\[key\]/);
});

test('a redirect is not followed, and a timeout does not leave the token in the error', async () => {
  const redirect = await handleFairleadProxy({
    method: 'GET',
    pathname: '/api/fairlead/v1/models',
    originOk: true,
    env: {},
    requestImpl: async (call) => {
      if (call.path === '/__fleethacker/id') {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        return { status: 200, headers, body: Buffer.from(JSON.stringify({ tool: 'fairlead', pid: 42, path: PROGRAM })) };
      }
      const headers: Record<string, string> = { location: 'http://example.invalid/steal' };
      return { status: 302, headers, body: Buffer.alloc(0) };
    },
    listenerPids: () => [42],
    processPaths: () => [PROGRAM],
    readToken: () => 'fl-secret',
  });
  assert.equal(redirect.status, 502);
  assert.match(redirect.body.toString('utf8'), /redirected/);
  assert.doesNotMatch(redirect.body.toString('utf8'), /example\.invalid|fl-secret/);

  const timed = await handleFairleadProxy({
    method: 'GET',
    pathname: '/api/fairlead/v1/models',
    originOk: true,
    env: {},
    requestImpl: async (call) => {
      if (call.path === '/__fleethacker/id') {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        return { status: 200, headers, body: Buffer.from(JSON.stringify({ tool: 'fairlead', pid: 42, path: PROGRAM })) };
      }
      throw Object.assign(new Error('Bearer fl-secret hung'), { code: 'timeout' });
    },
    listenerPids: () => [42],
    processPaths: () => [PROGRAM],
    readToken: () => 'fl-secret',
  });
  assert.equal(timed.status, 502);
  assert.match(timed.body.toString('utf8'), /did not answer in time/);
  assert.doesNotMatch(timed.body.toString('utf8'), /fl-secret/);
});

test('a listener that accepts and never answers is cut off on the loopback socket', async () => {
  const server = http.createServer(() => { /* hold the socket open */ });
  try {
    await new Promise<void>((ok, bad) => {
      server.once('error', bad);
      server.listen(8776, '127.0.0.1', () => ok());
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    assert.equal(code, 'EADDRINUSE');
    return;
  }
  try {
    const started = Date.now();
    await assert.rejects(() => loopbackFairleadRequest({ method: 'GET', path: '/__fleethacker/id', headers: {}, timeoutMs: 200 }));
    assert.ok(Date.now() - started < 2000);
  } finally {
    await new Promise<void>((ok) => server.close(() => ok()));
  }
});

test('a foreign program on the port does not receive the token', async () => {
  let calls = 0;
  const requestImpl = async () => {
    calls += 1;
    return { status: 200, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify({ tool: 'not-fairlead', pid: 9, path: 'C:\\other.exe' })) };
  };
  const result = await handleFairleadProxy({
    method: 'POST',
    pathname: '/api/fairlead/v1/chat/completions',
    body: Buffer.from('{}'),
    originOk: true,
    env: {},
    requestImpl,
    listenerPids: () => [9],
    processPaths: () => ['C:\\other.exe'],
    readToken: () => 'fl-secret',
  });
  assert.equal(result.status, 502);
  assert.equal(calls, 1, 'the key-bearing forward is not made');
  assert.match(result.body.toString('utf8'), /not Fairlead/);
  assert.doesNotMatch(result.body.toString('utf8'), /fl-secret/);
});

test('the PowerShell server wires the same forwarder and never names a workflow edit', () => {
  const server = readFileSync(path.join(root, 'tools', 'Start-Shellback.ps1'), 'utf8');
  const proxy = readFileSync(path.join(root, 'tools', 'Fairlead-Proxy.ps1'), 'utf8');
  assert.match(server, /Fairlead-Proxy\.ps1/);
  assert.match(server, /Invoke-ShellbackFairleadProxy/);
  assert.match(proxy, /X-Fairlead-Label/);
  assert.match(proxy, /X-Fairlead-Privacy/);
  assert.match(proxy, /__fleethacker\/id/);
  assert.match(proxy, /local-token/);
  assert.match(proxy, /text\/plain; charset=utf-8/);
  assert.match(server, /X-Content-Type-Options: nosniff/);
  assert.doesNotMatch(proxy, /fl-secret/);
  assert.ok(MAX_RESPONSE_BYTES > 0);
});
