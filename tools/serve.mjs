#!/usr/bin/env node
/**
 * Development / CI static server for dist/. Mirrors tools/Serve-Synapse.ps1:
 * loopback only, no directory listing, no path traversal, correct MIME types,
 * and the security headers the PowerShell server sends.
 *
 *   node tools/serve.mjs [--port 8765] [--root dist] [--no-open]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const port = Number(opt('port', process.env.PORT || 0));
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', opt('root', 'dist'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(rootDir, rel));
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
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

server.listen(port, '127.0.0.1', () => {
  const { port: p } = server.address();
  console.log(`Synapse: serving ${rootDir} at http://127.0.0.1:${p}/  (Ctrl+C to stop)`);
});
