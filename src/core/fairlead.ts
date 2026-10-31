/**
 * Fleet intelligence router (Fairlead). Fleet apps that call a model send the call to one local
 * address and Fairlead picks the engine. This module is the only place Shellback names that address.
 * Only the loopback origin is built in: nothing here names a remote host.
 */
import type { RemoteProviderConfig } from './intelligence';

export const FAIRLEAD_ORIGIN = 'http://127.0.0.1:8776';
export const FAIRLEAD_PRIVACY_HEADER = 'X-Fairlead-Privacy';

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
    dataHandling: 'Text you scan and aggregate team numbers go to the Fairlead router on this computer, which chooses the engine. Shellback asks for local engines only (X-Fairlead-Privacy: local). Your workspace, peer cards and names are never sent.',
  };
}
