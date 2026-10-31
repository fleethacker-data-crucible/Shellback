#!/usr/bin/env node
/**
 * Shellback intelligence adapter â€” a tiny loopback bridge between Shellback's provider contract (v1)
 * and any OpenAI-compatible chat-completions endpoint (enterprise gateways usually are).
 *
 *   node tools/intel-adapter.mjs
 *
 * Environment (set in the shell that starts it; nothing is written to disk):
 *   INTEL_UPSTREAM_URL   e.g. https://api.github.com/v1/chat/completions   (required)
 *   INTEL_API_KEY        bearer token for the upstream                             (required)
 *   INTEL_MODEL          default model/deployment name                            (optional; Shellback may override)
 *   INTEL_PORT           default 8790
 *   INTEL_TOKEN          optional shared secret Shellback must present (Program â†’ Intelligence â†’ bearer token)
 *   NODE_EXTRA_CA_CERTS  (standard Node variable) PEM bundle for an internal CA, if the gateway uses one
 *
 * The adapter listens on 127.0.0.1 only. Shellback must be built with
 *   SHELLBACK_INTEL_HOST=http://127.0.0.1:8790
 * so its Content-Security-Policy allows the connection. Contract: docs/INTELLIGENCE_PROVIDERS.md.
 *
 * Zero dependencies. Node 18+.
 */
import http from 'node:http';

const UPSTREAM = process.env.INTEL_UPSTREAM_URL;
const KEY = process.env.INTEL_API_KEY;
const MODEL = process.env.INTEL_MODEL || '';
const PORT = Number(process.env.INTEL_PORT || 8790);
const SHARED = process.env.INTEL_TOKEN || '';
if (!UPSTREAM || !KEY) { console.error('Set INTEL_UPSTREAM_URL and INTEL_API_KEY first.'); process.exit(2); }

const SYSTEM = `You help employees see their own capabilities. You never score, rank or judge a person.
Answer ONLY with the JSON object requested, no prose, no code fences.`;

const prompts = {
  'scan-resume': (p) => `Taxonomy (id â€” name â€” domain):\n${p.taxonomy.map((t) => `${t.id} â€” ${t.name} â€” ${t.domain}`).join('\n')}\n\nRÃ©sumÃ© text:\n"""\n${p.text}\n"""\n\nAlready confirmed ids (exclude): ${p.confirmed.join(', ') || 'none'}\n\nReturn {"skills": [taxonomy ids clearly evidenced by the text, max 25], "credentials": [{"name": certification or qualification actually HELD (not pursued), "authority": issuer or "", "matched": the exact phrase}]}. Only include skills with real evidence; prefer precision over recall.`,
  'map-skills': (p) => `Taxonomy (id â€” name â€” domain):\n${p.taxonomy.map((t) => `${t.id} â€” ${t.name} â€” ${t.domain}`).join('\n')}\n\nMap each of these free-text skill names to the single best taxonomy id, or null if nothing fits:\n${p.names.map((n) => `- ${n}`).join('\n')}\n\nReturn {"mapped": [{"input": name exactly as given, "skillId": id or null, "score": 0..1}]}.`,
  'team-brief': (p) => `Write a short, plain-language brief (3â€“6 short paragraphs, plain text, blank line between paragraphs) for a supervisor from these AGGREGATE team numbers. Never name or imply an individual. Treat everything as self-reported and as a conversation starter, not an assessment. End with one suggested next step that involves asking the team.\n\n${JSON.stringify(p.input, null, 2)}\n\nReturn {"text": "..."}.`,
};

async function upstream(model, user) {
  const res = await fetch(UPSTREAM, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: model || MODEL || undefined, temperature: 0, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? json?.output_text ?? json?.content?.[0]?.text;
  if (typeof content !== 'string') throw new Error('upstream returned no text');
  const m = content.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('upstream did not return JSON');
  return JSON.parse(m[0]);
}

const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'POST, OPTIONS' }); res.end(JSON.stringify(body)); };

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' });
  if (SHARED && req.headers.authorization !== `Bearer ${SHARED}`) return send(res, 401, { ok: false, error: 'bad token' });
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 2_000_000) req.destroy(); });
  req.on('end', async () => {
    try {
      const body = JSON.parse(raw);
      if (body.contract !== 1) return send(res, 200, { ok: false, error: `unsupported contract ${body.contract}` });
      const p = body.payload ?? {};
      if (p.task === 'ping') return send(res, 200, { ok: true, result: { detail: `adapter ok â†’ ${new URL(UPSTREAM).host}${MODEL ? ` (${MODEL})` : ''}` } });
      if (p.task === 'list-models') {
        // GET <base>/models where base is the upstream URL minus /chat/completions
        const modelsUrl = UPSTREAM.replace(/\/chat\/completions\/?$/, '') + '/models';
        const r = await fetch(modelsUrl, { headers: { authorization: `Bearer ${KEY}` } });
        if (!r.ok) return send(res, 200, { ok: false, error: `upstream /models answered ${r.status}` });
        const j = await r.json();
        const models = Array.isArray(j?.data) ? j.data.map((m) => m.id).filter((x) => typeof x === 'string') : [];
        return send(res, 200, { ok: true, result: { models } });
      }
      const make = prompts[p.task];
      if (!make) return send(res, 200, { ok: false, error: `unknown task ${p.task}` });
      const started = Date.now();
      const result = await upstream(body.model, make(p));
      console.log(new Date().toISOString(), p.task, `${Date.now() - started}ms`);
      return send(res, 200, { ok: true, result });
    } catch (err) {
      console.error(new Date().toISOString(), 'error', err.message);
      return send(res, 200, { ok: false, error: String(err.message).slice(0, 380) });
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Shellback intelligence adapter on http://127.0.0.1:${PORT}  â†’  ${UPSTREAM}${SHARED ? '  (shared token required)' : ''}`));
