import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  allowedForward,
  handleFairleadProxy,
  identityDecision,
  localTokenDisabled,
  parseFairleadId,
  parseProcNetTcp,
  pathsEqual,
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

test('a matching Fairlead is called with the label and the account token, which the page does not receive', async () => {
  const token = 'fl-account-token-value';
  const seen: Array<{ url: string; authorization?: string; label?: string; privacy?: string }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({ url: String(url), authorization: headers.get('authorization') ?? undefined, label: headers.get('x-fairlead-label') ?? undefined, privacy: headers.get('x-fairlead-privacy') ?? undefined });
    if (String(url).endsWith('/__fleethacker/id')) {
      return new Response(JSON.stringify({ tool: 'fairlead', pid: 42, path: PROGRAM }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ data: [{ id: 'local' }], echo: token }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const result = await handleFairleadProxy({
    method: 'GET',
    pathname: '/api/fairlead/v1/models',
    originOk: true,
    env: {},
    fetchImpl,
    listenerPids: () => [42],
    processPaths: () => [PROGRAM],
    readToken: () => token,
  });
  assert.equal(result.status, 200);
  assert.equal(seen[0]?.url, 'http://127.0.0.1:8776/__fleethacker/id');
  assert.equal(seen[0]?.authorization, undefined);
  assert.equal(seen[1]?.authorization, `Bearer ${token}`);
  assert.equal(seen[1]?.label, 'Shellback');
  assert.equal(seen[1]?.privacy, 'local');
  assert.equal(result.body.includes(Buffer.from(token)), false);
  assert.match(result.body.toString('utf8'), /\[key\]/);
});

test('a foreign program on the port does not receive the token', async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return new Response(JSON.stringify({ tool: 'not-fairlead', pid: 9, path: 'C:\\other.exe' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const result = await handleFairleadProxy({
    method: 'POST',
    pathname: '/api/fairlead/v1/chat/completions',
    body: Buffer.from('{}'),
    originOk: true,
    env: {},
    fetchImpl,
    listenerPids: () => [9],
    processPaths: () => ['C:\\other.exe'],
    readToken: () => 'fl-secret',
  });
  assert.equal(result.status, 502);
  assert.equal(called, true);
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
  assert.doesNotMatch(proxy, /fl-secret/);
});
