import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FAIRLEAD_ORIGIN, FAIRLEAD_PRIVACY_HEADER, fairleadPreset, isFairleadOrigin, privacyHeaders } from '../../src/core/fairlead';
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

test('the shipped build allows the router origin and no other host by default', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'dist', 'build-manifest.json'), 'utf8')) as { intelHosts: string[] };
  assert.deepEqual(manifest.intelHosts, [FAIRLEAD_ORIGIN]);
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
  // The router address is fixed; the fake has to listen on it.
  await new Promise<void>((ok, bad) => { server.once('error', bad); server.listen(8776, '127.0.0.1', () => ok()); });
  try {
    const provider = createOpenAIProvider({ ...fairleadPreset(), model: 'local-small' }, { fetch: (...a) => fetch(...a), token: () => 'client-key' });
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
