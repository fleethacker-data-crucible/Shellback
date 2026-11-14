/**
 * Forwards Fairlead calls for the served app (issue 62).
 * The browser never sees the account token. tools/Fairlead-Proxy.ps1 is the same rule for Windows PowerShell 5.1.
 * Never log the token, and never put it on a command line.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const FAIRLEAD_ORIGIN = 'http://127.0.0.1:8776';
export const FAIRLEAD_LABEL = 'Shellback';
export const MAX_TOKEN_BYTES = 4096;
export const MAX_BODY_BYTES = 524288;
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export function localTokenDisabled(env) {
  const v = String(env.FAIRLEAD_LOCAL_TOKEN ?? '').trim().toLowerCase();
  return v === 'off' || v === '0' || v === 'false' || v === 'no';
}

export function localTokenFile(env) {
  if (env.FAIRLEAD_LOCAL_TOKEN_FILE) return env.FAIRLEAD_LOCAL_TOKEN_FILE;
  if (!env.LOCALAPPDATA) return null;
  return path.join(env.LOCALAPPDATA, 'Fairlead', 'local-token');
}

/** First line of a local-token file, or null when it is missing, huge, or empty. */
export function readLocalTokenText(text) {
  if (typeof text !== 'string') return null;
  if (Buffer.byteLength(text) > MAX_TOKEN_BYTES) return null;
  const line = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim();
  if (!line || line.length > 2000) return null;
  return line;
}

export function readLocalTokenFile(file, readFile = fs.readFileSync) {
  try {
    if (!file) return null;
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_TOKEN_BYTES) return null;
    return readLocalTokenText(readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export function allowedForward(method, pathname) {
  const m = String(method || '').toUpperCase();
  if (m === 'GET' && pathname === '/v1/models') return true;
  if (m === 'POST' && pathname === '/v1/chat/completions') return true;
  return false;
}

export function parseFairleadId(value) {
  if (!value || typeof value !== 'object') return { ok: false, error: 'Fairlead did not identify itself, so the account token was not sent.' };
  const tool = value.tool;
  if (tool !== 'fairlead') {
    const who = typeof tool === 'string' && /^[A-Za-z0-9._-]{1,40}$/.test(tool) ? `"${tool}"` : 'something else';
    return { ok: false, error: `The program on the Fairlead port is ${who}, not Fairlead, so the account token was not sent.` };
  }
  const pid = Number(value.pid);
  if (!Number.isInteger(pid) || pid <= 0) return { ok: false, error: 'Fairlead did not report the process that holds its port, so the account token was not sent.' };
  const reported = typeof value.path === 'string' ? value.path.trim() : '';
  if (!reported) return { ok: false, error: 'Fairlead did not report its program path, so the account token was not sent.' };
  return { ok: true, pid, path: reported };
}

export function pathsEqual(a, b) {
  const norm = (p) => String(p || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  const left = norm(a);
  const right = norm(b);
  return !!left && left === right;
}

/** listenerPids null means the check could not run: refuse. */
export function identityDecision(id, listenerPids, processPaths) {
  if (!id?.ok) return { ok: false, error: id?.error || 'Fairlead did not identify itself, so the account token was not sent.' };
  if (listenerPids == null) return { ok: false, error: 'Shellback could not see which program listens on the Fairlead port, so the account token was not sent.' };
  if (listenerPids.length === 0) return { ok: false, error: 'Fairlead is not running on 127.0.0.1:8776. Start Fairlead, then try again. The account token was not sent.' };
  if (listenerPids.length !== 1 || listenerPids[0] !== id.pid) {
    return { ok: false, error: 'Something other than the program that identified itself as Fairlead is holding port 8776, so the account token was not sent.' };
  }
  const paths = Array.isArray(processPaths) ? processPaths : [];
  if (!paths.some((p) => pathsEqual(p, id.path))) {
    return { ok: false, error: 'The program on port 8776 reports a path that is not what that process runs, so the account token was not sent.' };
  }
  return { ok: true };
}

export function scrub(text, token) {
  if (!text) return '';
  let out = token ? String(text).split(token).join('[key]') : String(text);
  out = out.replace(/[\u0000-\u001F\u007F]+/g, ' ').trim();
  if (out.length > 300) out = `${out.slice(0, 300)}...`;
  return out;
}

function textResult(status, message) {
  return { status, contentType: 'text/plain; charset=utf-8', body: Buffer.from(message) };
}

function relayPath(pathname) {
  const prefix = '/api/fairlead';
  let rel = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  if (!rel.startsWith('/')) rel = `/${rel}`;
  return rel;
}

/**
 * @param {{ method: string, pathname: string, body?: Buffer, originOk: boolean, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch, listenerPids: () => number[] | null, processPaths: (pid: number) => string[], readToken?: () => string | null }} input
 */
export async function handleFairleadProxy(input) {
  const method = String(input.method || '').toUpperCase();
  if (!input.originOk) return textResult(403, 'Forbidden');
  if (input.pathname.includes('?')) return textResult(400, 'Bad request');
  const rel = relayPath(input.pathname.split('?')[0]);
  if (!allowedForward(method, rel)) {
    if (method !== 'GET' && method !== 'POST') return textResult(405, 'Method not allowed');
    return textResult(404, 'Not found');
  }
  const body = input.body ?? Buffer.alloc(0);
  if (body.length > MAX_BODY_BYTES) return textResult(413, 'Too large');
  if (localTokenDisabled(input.env)) {
    return textResult(503, 'Fairlead account token is turned off (FAIRLEAD_LOCAL_TOKEN=off). Add a key under Program → Intelligence, or turn the switch back on.');
  }
  const token = (input.readToken ? input.readToken() : readLocalTokenFile(localTokenFile(input.env)));
  if (!token) {
    return textResult(503, 'Fairlead has no account token for this Windows account yet. Start Fairlead once so it can write %LOCALAPPDATA%\\Fairlead\\local-token, or add a key under Program → Intelligence.');
  }
  let idRaw;
  try {
    const idRes = await input.fetchImpl(`${FAIRLEAD_ORIGIN}/__fleethacker/id`, { method: 'GET', redirect: 'manual', headers: { accept: 'application/json' } });
    if (!idRes.ok) return textResult(502, 'Fairlead did not identify itself, so the account token was not sent.');
    const idText = await idRes.text();
    if (idText.length > MAX_TOKEN_BYTES) return textResult(502, 'Fairlead did not identify itself, so the account token was not sent.');
    idRaw = JSON.parse(idText);
  } catch {
    return textResult(502, 'Fairlead is not running on 127.0.0.1:8776, or it did not identify itself. The account token was not sent.');
  }
  const id = parseFairleadId(idRaw);
  let listeners = null;
  let paths = [];
  try { listeners = input.listenerPids(); } catch { listeners = null; }
  if (id.ok) {
    try { paths = input.processPaths(id.pid) ?? []; } catch { paths = []; }
  }
  const decision = identityDecision(id, listeners, paths);
  if (!decision.ok) return textResult(decision.error?.includes('could not see') ? 503 : 502, decision.error);
  let upstream;
  try {
    const headers = {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'x-fairlead-label': FAIRLEAD_LABEL,
      'x-fairlead-privacy': 'local',
    };
    if (method === 'POST') headers['content-type'] = 'application/json';
    upstream = await input.fetchImpl(`${FAIRLEAD_ORIGIN}${rel}`, {
      method,
      redirect: 'manual',
      headers,
      body: method === 'POST' ? body : undefined,
    });
  } catch (err) {
    return textResult(502, scrub(err instanceof Error ? err.message : 'Fairlead could not be reached.', token) || 'Fairlead could not be reached.');
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    return textResult(502, 'Fairlead redirected the request, so Shellback stopped.');
  }
  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length > MAX_RESPONSE_BYTES) return textResult(502, 'Fairlead sent an answer larger than Shellback accepts.');
  const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
  let out = bytes;
  if (/json|text/i.test(contentType) && bytes.includes(Buffer.from(token))) {
    out = Buffer.from(bytes.toString('utf8').split(token).join('[key]'));
  }
  return { status: upstream.status, contentType, body: out };
}

export function linuxProcessPaths(pid, procRoot = '/proc') {
  const paths = [];
  const dir = path.join(procRoot, String(pid));
  try { paths.push(fs.readlinkSync(path.join(dir, 'exe'))); } catch { /* process gone */ }
  try {
    const args = fs.readFileSync(path.join(dir, 'cmdline')).toString('utf8').split('\0').filter(Boolean);
    const i = args.findIndex((a) => a.toLowerCase() === '-file');
    if (i >= 0 && args[i + 1]) paths.push(args[i + 1]);
  } catch { /* no command line */ }
  return paths;
}

export function linuxListenerPids(port, procRoot = '/proc') {
  let text;
  try { text = fs.readFileSync(path.join(procRoot, 'net/tcp'), 'utf8'); } catch { return null; }
  const inodes = new Set(parseProcNetTcp(text, port));
  if (!inodes.size) return [];
  let names;
  try { names = fs.readdirSync(procRoot); } catch { return null; }
  const pids = new Set();
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue;
    let fds;
    try { fds = fs.readdirSync(path.join(procRoot, name, 'fd')); } catch { continue; }
    for (const fd of fds) {
      try {
        const link = fs.readlinkSync(path.join(procRoot, name, 'fd', fd));
        const match = /^socket:\[(\d+)\]$/.exec(link);
        if (match && inodes.has(match[1])) pids.add(Number(name));
      } catch { /* unreadable fd */ }
    }
  }
  return [...pids];
}

export function windowsListenerPids(port) {
  try {
    const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', timeout: 4000, windowsHide: true });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] !== 'TCP' || parts[3] !== 'LISTENING') continue;
      const local = parts[1] ?? '';
      const colon = local.lastIndexOf(':');
      if (colon < 0 || local.slice(colon + 1) !== String(port)) continue;
      const host = local.slice(0, colon);
      if (host !== '127.0.0.1' && host !== '0.0.0.0' && host !== '[::1]' && host !== '[::]') continue;
      const pid = Number(parts[4]);
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch { return null; }
}

export function windowsProcessPaths(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return [];
  const script = `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${n}"; if ($p.ExecutablePath) { $p.ExecutablePath }; if ($p.CommandLine -match '(?i)-File\\s+"([^"]+)"') { $Matches[1] } elseif ($p.CommandLine -match '(?i)-File\\s+(\\S+)') { $Matches[1] }`;
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

export function discoverListenerPids(port) {
  if (process.platform === 'linux') return linuxListenerPids(port);
  if (process.platform === 'win32') return windowsListenerPids(port);
  return null;
}

export function discoverProcessPaths(pid) {
  if (process.platform === 'linux') return linuxProcessPaths(pid);
  if (process.platform === 'win32') return windowsProcessPaths(pid);
  return [];
}

export function parseProcNetTcp(text, port) {
  const portHex = port.toString(16).toUpperCase().padStart(4, '0');
  const inodes = [];
  for (const line of String(text).split('\n').slice(1)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10) continue;
    const local = parts[1] ?? '';
    const colon = local.lastIndexOf(':');
    if (colon < 0) continue;
    const ip = local.slice(0, colon).toUpperCase();
    const phex = local.slice(colon + 1).toUpperCase();
    if (phex !== portHex || parts[3] !== '0A') continue;
    const loopback = ip === '0100007F' || ip === '00000000' || ip === '00000000000000000000000001000000' || ip === '00000000000000000000000000000000';
    if (!loopback) continue;
    inodes.push(parts[9]);
  }
  return inodes;
}
