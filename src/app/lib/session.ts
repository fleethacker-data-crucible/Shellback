/**
 * Server lifecycle (TechStack "Lifecycle rules"): the browser tab owns the loopback server.
 *
 * Every 5 s the tab POSTs /api/heartbeat; on pagehide it sends a navigator.sendBeacon "leaving"
 * signal. Start-Shellback.ps1 stops itself 20 s after the last heartbeat from any tab, or 5 s after a
 * leaving signal with no new heartbeat, so a reload (which heartbeats at once) never stops it.
 *
 * Only the served edition has a server. The standalone file:// edition and the dev build skip all of
 * this. Shellback has no session token: the server accepts these routes only from its own Origin/Host.
 * Workspace data lives in IndexedDB, so stopping the server never loses work.
 */

const HEARTBEAT = '/api/heartbeat';
const STOP = '/api/session/stop';

/** True when this page was loaded from a Shellback loopback server (not file://, not a dev build). */
export function hasLocalServer(): boolean {
  return location.protocol.startsWith('http') && document.documentElement.dataset.edition === 'served';
}

let stopActive: (() => void) | null = null;

function newTabId(): string {
  try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

/** Starts the heartbeat for this tab and returns a function that stops it. */
export function startHeartbeat(intervalMs = 5000): () => void {
  if (!hasLocalServer()) return () => {};
  const tab = newTabId();
  const send = (leaving: boolean) => {
    try {
      void fetch(HEARTBEAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, leaving }),
        keepalive: true,
        cache: 'no-store',
      }).catch(() => { /* the server is gone; the app keeps working from this browser */ });
    } catch { /* nothing to do */ }
  };
  const onHide = () => {
    // sendBeacon is what browsers reliably deliver during unload; it cannot set headers, so the body carries everything.
    let sent = false;
    try { sent = navigator.sendBeacon(HEARTBEAT, new Blob([JSON.stringify({ tab, leaving: true })], { type: 'application/json' })); } catch { sent = false; }
    if (!sent) send(true);
  };
  const onShow = () => send(false);
  const onVisible = () => { if (document.visibilityState === 'visible') send(false); };
  send(false);
  const timer = window.setInterval(() => send(false), intervalMs);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('pageshow', onShow);
  document.addEventListener('visibilitychange', onVisible);
  const stop = () => {
    window.clearInterval(timer);
    window.removeEventListener('pagehide', onHide);
    window.removeEventListener('pageshow', onShow);
    document.removeEventListener('visibilitychange', onVisible);
    if (stopActive === stop) stopActive = null;
  };
  stopActive = stop;
  return stop;
}

/** Asks the server to stop now ("End session"). Resolves true when the server acknowledged. */
export async function endSession(): Promise<boolean> {
  if (!hasLocalServer()) return false;
  try {
    const r = await fetch(STOP, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shellback-Intent': 'end-session' }, body: '{}', cache: 'no-store' });
    // The server is going away: stop heartbeating so this tab does not log failed requests.
    if (r.ok && stopActive) stopActive();
    return r.ok;
  } catch {
    return false;
  }
}
