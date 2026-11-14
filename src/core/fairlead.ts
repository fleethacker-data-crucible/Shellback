/**
 * Fleet intelligence router (Fairlead). Fleet apps that call a model send the call to one local
 * address and Fairlead picks the engine. This module is the only place Shellback names that address.
 * Only the loopback origin is built in: nothing here names a remote host.
 */
import type { RemoteProviderConfig } from './intelligence';

export const FAIRLEAD_ORIGIN = 'http://127.0.0.1:8776';
export const FAIRLEAD_PRIVACY_HEADER = 'X-Fairlead-Privacy';
export const FAIRLEAD_LABEL_HEADER = 'X-Fairlead-Label';
export const SHELLBACK_FAIRLEAD_LABEL = 'Shellback';
/** The local server forwards this prefix to Fairlead and attaches the account token. */
export const FAIRLEAD_PROXY_PREFIX = '/api/fairlead';

const originOf = (url: string): string | null => { try { return new URL(url).origin; } catch { return null; } };

export const isFairleadOrigin = (endpoint: string): boolean => originOf(endpoint) === FAIRLEAD_ORIGIN;

/** Extra headers for router calls: `local` asks Fairlead to keep the call on engines on this workstation. */
export function privacyHeaders(endpoint: string): Record<string, string> {
  return isFairleadOrigin(endpoint) ? { [FAIRLEAD_PRIVACY_HEADER]: 'local' } : {};
}

/** The settings the Intelligence form fills in when the user chooses the router on this computer. */
export function fairleadPreset(): RemoteProviderConfig {
  return {
    kind: 'openai',
    label: 'Fairlead (local router)',
    endpoint: `${FAIRLEAD_ORIGIN}/v1`,
    model: '',
    dataHandling: 'Text you scan and aggregate team numbers go to the Fairlead router on this computer, which chooses the engine. Shellback asks for local engines only (X-Fairlead-Privacy: local). With no key typed here, the served app sends Fairlead\'s account token from this Windows user and does not put that token in the browser. Your workspace, peer cards and names are never sent.',
  };
}

/** Origin of this page when it was opened from the loopback server, which can attach the account token. */
export function loopbackPageOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const { protocol, hostname, origin } = window.location;
    if (protocol !== 'http:') return null;
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') return null;
    return origin;
  } catch { return null; }
}

/**
 * Where one OpenAI-style call goes.
 * A sealed browser key is sent to the endpoint itself.
 * The Fairlead preset with no key goes to this page's server (`/api/fairlead`), which adds the account token.
 */
export function fairleadTransport(endpoint: string, apiPath: string, browserToken: string | null, pageOrigin: string | null): { url: string; sendBrowserToken: boolean } | { error: string } {
  const suffix = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const base = endpoint.replace(/\/+$/, '');
  if (browserToken) return { url: `${base}${suffix}`, sendBrowserToken: true };
  if (!isFairleadOrigin(endpoint)) return { error: 'No API key unlocked. Add or unlock the key under Program → Intelligence.' };
  if (!pageOrigin) return { error: 'The Fairlead preset without a typed key needs the served app (Launch-Shellback.bat). On the single-file page, add a key under Program → Intelligence.' };
  let pathname = '/v1';
  try { pathname = new URL(base).pathname.replace(/\/+$/, '') || '/v1'; } catch { pathname = '/v1'; }
  return { url: `${pageOrigin.replace(/\/+$/, '')}${FAIRLEAD_PROXY_PREFIX}${pathname}${suffix}`, sendBrowserToken: false };
}
