#!/usr/bin/env node
/**
 * Development / CI static server for dist/. Mirrors tools/Start-Shellback.ps1:
 * loopback only, no directory listing, no path traversal, correct MIME types,
 * and the security headers the PowerShell server sends.
 *
 *   node tools/serve.mjs [--port 8765] [--root dist] [--stay]
 *
 * Lifecycle (TechStack "Lifecycle rules", same rule as Start-Shellback.ps1): POST /api/heartbeat from
 * the page every 5 s; the server exits 20 s after the last heartbeat from any tab, or 5 s after a
 * leaving beacon with no new heartbeat. --stay or SHELLBACK_AUTO_STOP=0 (former name SYNAPSE_AUTO_STOP still read) turns that off. POST
 * /api/session/stop (End session) exits at once. Both routes accept only this server's own Origin/Host.
 * --timeout-ms / --leaving-ms shorten the windows for tests.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stopRunningShellback } from './stop-running.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const port = Number(opt('port', process.env.PORT || 8765)); // stable port = stable origin = same IndexedDB data
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(appRoot, opt('root', 'dist'));
const autoStop = !args.includes('--stay') && !/^(0|false|off|no)$/i.test(process.env.SHELLBACK_AUTO_STOP ?? process.env.SYNAPSE_AUTO_STOP ?? '');
const timeoutMs = Number(opt('timeout-ms', 20_000));
const leavingMs = Number(opt('leaving-ms', 5_000));
// A tab that has missed two 5 s heartbeats is treated as gone once some tab has signalled leaving. Browsers
// sometimes drop the pagehide beacon of a page that is being reloaded, which would otherwise keep a ghost tab alive.
const staleMs = Number(opt('stale-ms', 11_000));

// Presence: tab id -> last heartbeat. Mirrors New-ShellbackPresence / Test-ShellbackBrowserGone.
const tabs = new Map();
let lastHeartbeat = 0;
let leavingAt = 0;
function browserGone(now) {
  if (!autoStop || !lastHeartbeat) return false;
  for (const [id, t] of tabs) if (now - t >= timeoutMs || (leavingAt && now - t >= staleMs)) tabs.delete(id);
  if (tabs.size) return false;
  if (leavingAt && now - leavingAt >= leavingMs) return true;
  return now - lastHeartbeat >= timeoutMs;
}
function shutdown(reason) {
  console.log(`Shellback: ${reason}`);
  server.close();
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 50).unref();
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

function lifecycle(req, res, url, headers) {
  const { port: p } = server.address();
  const okOrigin = [`http://127.0.0.1:${p}`, `http://localhost:${p}`].includes(req.headers.origin ?? '');
  const okHost = [`127.0.0.1:${p}`, `localhost:${p}`].includes(req.headers.host ?? '');
  if (req.method !== 'POST') { res.writeHead(405, headers); return res.end('Method not allowed'); }
  if (!okOrigin || !okHost) { res.writeHead(403, headers); return res.end('Forbidden'); }
  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (c) => { raw += c; if (raw.length > 4096) req.destroy(); });
  req.on('end', () => {
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; } // never logged
    if (url.pathname === '/api/heartbeat') {
      const tab = String(body.tab ?? 'tab').slice(0, 64);
      const now = Date.now();
      if (body.leaving === true) { tabs.delete(tab); leavingAt = now; } else { tabs.set(tab, now); lastHeartbeat = now; leavingAt = 0; }
      res.writeHead(204, headers); return res.end();
    }
    // X-Synapse-Intent is the former header name, still accepted so an older open tab can end its session.
    const intent = req.headers['x-shellback-intent'] ?? req.headers['x-synapse-intent'];
    if (intent !== 'end-session') { res.writeHead(403, headers); return res.end('Forbidden'); }
    res.writeHead(200, headers); res.end('Stopping');
    shutdown('End session was chosen in the browser; stopping.');
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(rootDir, rel));
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "frame-ancestors 'none'",
  };
  if (url.pathname === '/api/heartbeat' || url.pathname === '/api/session/stop') return lifecycle(req, res, url, headers);
  if (!file.startsWith(rootDir + path.sep) && file !== rootDir) { res.writeHead(403, headers); return res.end('Forbidden'); }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers); return res.end('Method not allowed'); }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, headers); return res.end('Not found'); }
    headers['Content-Type'] = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    headers['Content-Length'] = stat.size;
    if (file.endsWith('sw.js')) headers['Service-Worker-Allowed'] = '/';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

stopRunningShellback(appRoot, 'serve');
server.listen(port, '127.0.0.1', () => {
  const { port: p } = server.address();
  console.log(`Shellback: serving ${rootDir} at http://127.0.0.1:${p}/  (Ctrl+C to stop${autoStop ? '; stops by itself when the last tab closes' : ''})`);
  if (autoStop) setInterval(() => { if (browserGone(Date.now())) shutdown('the browser tab closed; stopping (--stay or SHELLBACK_AUTO_STOP=0 keeps it running).'); }, Math.min(1000, leavingMs / 2)).unref();
});
