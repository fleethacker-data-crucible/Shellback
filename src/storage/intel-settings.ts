/**
 * Intelligence configuration. Non-secret parts (provider choice, endpoint, model, label) live in
 * localStorage. The bearer token is stored only as an AES-GCM envelope sealed with a passphrase the
 * user types; it is decrypted into memory for the current tab and never written back in clear, never
 * exported, and never included in a workspace backup.
 */
import { decryptJson, encryptJson, isEncryptedEnvelope, type EncryptedEnvelope } from '../core/crypto';
import { createRemoteProvider, endpointOrigin, getProvider, localRulesProvider, registerProvider, unregisterProvider, type IntelligenceProvider, type RemoteProviderConfig } from '../core/intelligence';

export const INTEL_KEY = 'synapse-intel-v1';
export type ProviderChoice = 'local-rules' | 'remote-http';

export interface IntelSettings {
  provider: ProviderChoice;
  remote: RemoteProviderConfig;
  tokenEnvelope: EncryptedEnvelope | null;
}

export const DEFAULT_INTEL: IntelSettings = { provider: 'local-rules', remote: { label: '', endpoint: '', model: '', dataHandling: '' }, tokenEnvelope: null };

/** Origins the build allows in connect-src (besides 'self'). Injected by tools/build.mjs. */
export const ALLOWED_INTEL_HOSTS: readonly string[] = typeof __SYNAPSE_INTEL_HOSTS__ !== 'undefined' ? __SYNAPSE_INTEL_HOSTS__ : [];

export function isHostAllowed(endpoint: string): boolean {
  const origin = endpointOrigin(endpoint);
  if (!origin) return false;
  if (typeof location !== 'undefined' && origin === location.origin) return true;
  return ALLOWED_INTEL_HOSTS.includes(origin);
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export function loadIntelSettings(): IntelSettings {
  try {
    const raw = localStorage.getItem(INTEL_KEY);
    if (!raw) return structuredClone(DEFAULT_INTEL);
    const v = JSON.parse(raw) as Partial<IntelSettings> & { remote?: Partial<RemoteProviderConfig> };
    return {
      provider: v.provider === 'remote-http' ? 'remote-http' : 'local-rules',
      remote: { label: str(v.remote?.label, 80), endpoint: str(v.remote?.endpoint, 500), model: str(v.remote?.model, 120), dataHandling: str(v.remote?.dataHandling, 600) },
      tokenEnvelope: isEncryptedEnvelope(v.tokenEnvelope) ? v.tokenEnvelope : null,
    };
  } catch { return structuredClone(DEFAULT_INTEL); }
}

export function saveIntelSettings(s: IntelSettings): void {
  try { localStorage.setItem(INTEL_KEY, JSON.stringify(s)); } catch { /* settings are a convenience only */ }
}

// ----------------------------------------------------------------------------- token in memory
let unlockedToken: string | null = null;
export const tokenUnlocked = (): boolean => unlockedToken !== null;
export function lockToken(): void { unlockedToken = null; }

export async function sealToken(token: string, passphrase: string): Promise<EncryptedEnvelope> {
  const env = await encryptJson({ token }, passphrase, 'synapse-intel-token-v1');
  unlockedToken = token;
  return env;
}

export async function unlockToken(envelope: EncryptedEnvelope, passphrase: string): Promise<boolean> {
  try {
    const v = (await decryptJson(envelope, passphrase)) as { token?: unknown };
    if (typeof v?.token !== 'string') return false;
    unlockedToken = v.token;
    return true;
  } catch { return false; }
}

// ----------------------------------------------------------------------------- active provider
let current: IntelSettings = typeof localStorage !== 'undefined' ? loadIntelSettings() : structuredClone(DEFAULT_INTEL);

/** (Re)register the remote provider from settings and return the one that is active. */
export function applyIntelSettings(s: IntelSettings): IntelligenceProvider {
  current = s;
  saveIntelSettings(s);
  unregisterProvider('remote-http');
  if (s.remote.endpoint) registerProvider(createRemoteProvider(s.remote, { fetch: (...a) => fetch(...a), token: () => unlockedToken }));
  return activeProvider();
}

/** A provider for unsaved form values (connection test) that can still use the unlocked token. */
export function previewProvider(cfg: RemoteProviderConfig): IntelligenceProvider {
  return createRemoteProvider(cfg, { fetch: (...a) => fetch(...a), token: () => unlockedToken, timeoutMs: 15_000 });
}

export function currentIntelSettings(): IntelSettings { return current; }

export function activeProvider(): IntelligenceProvider {
  if (current.provider !== 'remote-http' || !current.remote.endpoint) return localRulesProvider;
  return getProvider('remote-http');
}

// register on load so views can use activeProvider() immediately
if (typeof localStorage !== 'undefined' && current.remote.endpoint) registerProvider(createRemoteProvider(current.remote, { fetch: (...a) => fetch(...a), token: () => unlockedToken }));
