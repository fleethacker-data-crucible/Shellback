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
export function privacyHeaders(endpoint: string, cloudAllowed = false): Record<string, string> {
  return isFairleadOrigin(endpoint) && !cloudAllowed ? { [FAIRLEAD_PRIVACY_HEADER]: 'local' } : {};
}

/** What the person is told about router calls, matching what is actually sent. */
export const FAIRLEAD_LOCAL_NOTICE = fairleadPreset().dataHandling ?? '';
export const FAIRLEAD_CLOUD_NOTICE = 'Text you scan and aggregate team numbers go to the Fairlead router on this computer, which may pass them to a cloud engine you have connected there. Shellback does not ask for local-only engines. Use this only with synthetic or non-sensitive text. Your workspace, peer cards and names are never sent.';

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
