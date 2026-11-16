import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FAIRLEAD_ORIGIN, FAIRLEAD_PRIVACY_HEADER, fairleadPreset, fairleadTransport, isFairleadOrigin, privacyHeaders } from '../../src/core/fairlead';
import { createOpenAIProvider, validateEndpoint } from '../../src/core/intelligence';

const root = process.env.SHELLBACK_ROOT ?? process.cwd();

test('the Fairlead preset is a loopback endpoint the form accepts', () => {
  const p = fairleadPreset();
  assert.equal(p.kind, 'openai');
  assert.equal(p.endpoint, `${FAIRLEAD_ORIGIN}/v1`);
  assert.equal(validateEndpoint(p.endpoint), null);
  assert.equal(isFairleadOrigin(p.endpoint), true);
  assert.match(p.dataHandling ?? '', /local/);
});

test('the privacy header goes only to the router, never to other hosts', () => {
  assert.deepEqual(privacyHeaders(`${FAIRLEAD_ORIGIN}/v1`), { [FAIRLEAD_PRIVACY_HEADER]: 'local' });
  assert.deepEqual(privacyHeaders('https://ai.example.com/v1'), {});
  assert.deepEqual(privacyHeaders('http://127.0.0.1:8790/v1'), {}, 'the loopback adapter is not the router');
});

test('the person can let the router use cloud engines: the local-only header is then left out', () => {
  assert.deepEqual(privacyHeaders(`${FAIRLEAD_ORIGIN}/v1`, true), {});
  assert.deepEqual(privacyHeaders(`${FAIRLEAD_ORIGIN}/v1`, false), { [FAIRLEAD_PRIVACY_HEADER]: 'local' });
});

test('the shipped build allows the router origin and no other host by default', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'dist', 'build-manifest.json'), 'utf8')) as { intelHosts: string[] };
  assert.deepEqual(manifest.intelHosts, [FAIRLEAD_ORIGIN]);
});

test('the Fairlead preset with no browser key goes to the local server, and a sealed key still goes to the router', () => {
  const viaServer = fairleadTransport(`${FAIRLEAD_ORIGIN}/v1`, '/models', null, 'http://127.0.0.1:8765');
  assert.deepEqual(viaServer, { url: 'http://127.0.0.1:8765/api/fairlead/v1/models', sendBrowserToken: false });
  const viaKey = fairleadTransport(`${FAIRLEAD_ORIGIN}/v1`, '/chat/completions', 'client-key', 'http://127.0.0.1:8765');
  assert.equal('url' in viaKey && viaKey.url, `${FAIRLEAD_ORIGIN}/v1/chat/completions`);
  assert.equal('sendBrowserToken' in viaKey && viaKey.sendBrowserToken, true);
  const filePage = fairleadTransport(`${FAIRLEAD_ORIGIN}/v1`, '/models', null, null);
  assert.equal('error' in filePage, true);
  const other = fairleadTransport('https://ai.example.com/v1', '/models', null, 'http://127.0.0.1:8765');
  assert.match('error' in other ? other.error : '', /No API key unlocked/);
});

test('a Fairlead call with no browser key asks the local server and does not send a bearer token', async () => {
  const seen: Array<{ url: string; auth?: string; privacy?: string }> = [];
  const fetchMock = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    seen.push({ url: String(input), auth: headers.authorization, privacy: headers[FAIRLEAD_PRIVACY_HEADER] });
    return new Response(JSON.stringify({ data: [{ id: 'local-small' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const provider = createOpenAIProvider({ ...fairleadPreset(), model: 'local-small' }, { fetch: fetchMock, token: () => null, pageOrigin: 'http://127.0.0.1:8765' });
  const ping = await provider.ping();
  assert.equal(ping.ok, true, ping.detail);
  assert.equal(seen[0]?.url, 'http://127.0.0.1:8765/api/fairlead/v1/models');
  assert.equal(seen[0]?.auth, undefined);
  assert.equal(seen[0]?.privacy, 'local');
});

test('a provider talks to a fake router: models, scan, local-only header and bearer key', async () => {
  const seen: Array<{ url: string; auth?: string; privacy?: string; body: string }> = [];
  const server: Server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      seen.push({ url: req.url ?? '', auth: req.headers.authorization, privacy: req.headers[FAIRLEAD_PRIVACY_HEADER.toLowerCase()] as string | undefined, body });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'local-small' }] }));
      if (req.url === '/v1/chat/completions') return res.end(JSON.stringify({ choices: [{ message: { content: '{"skills":["sql-pipelines","not-a-real-skill"],"credentials":[]}' } }] }));
      res.statusCode = 404;
      res.end('{}');
    });
  });
  // The fake listens on a free port, so a real router on 8776 (a developer machine) cannot break the test.
  // The provider keeps the real router address; the fetch it is given redirects that origin to the fake.
  await new Promise<void>((ok, bad) => { server.once('error', bad); server.listen(0, '127.0.0.1', () => ok()); });
  const fakeOrigin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const toFake: typeof fetch = (input, init) => fetch(String(input).replace(FAIRLEAD_ORIGIN, fakeOrigin), init);
  try {
    const provider = createOpenAIProvider({ ...fairleadPreset(), model: 'local-small' }, { fetch: toFake, token: () => 'client-key' });
    const ping = await provider.ping();
    assert.equal(ping.ok, true, ping.detail);
    assert.match(ping.detail, /local-small/);
    const scan = await provider.scanResume({ text: 'Wrote SQL pipelines for the warehouse.', confirmed: [] });
    assert.deepEqual(scan.skills, ['sql-pipelines'], 'suggestions outside the taxonomy are dropped');
    const chat = seen.find((r) => r.url === '/v1/chat/completions');
    assert.ok(chat, 'the scan reached the router');
    assert.equal(chat.privacy, 'local');
    assert.equal(chat.auth, 'Bearer client-key');
    assert.equal(JSON.parse(chat.body).model, 'local-small');
    assert.ok(seen.every((r) => r.privacy === 'local'), 'every router call carries the header');
  } finally {
    await new Promise<void>((ok) => server.close(() => ok()));
  }
});
