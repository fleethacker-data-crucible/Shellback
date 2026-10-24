/**
 * Intelligence provider seam.
 *
 * Synapse ships with exactly one provider, `local-rules`: deterministic keyword matching that runs
 * in the browser (see scanners.ts) and makes no network calls. A model-backed provider (for
 * example one hosted on an authorized enterprise platform) can implement this same interface and
 * be registered here. Selecting a provider is a user-visible setting; until one is registered and
 * chosen, every call below is answered locally and nothing leaves the workstation.
 *
 * Rules every provider must keep:
 *   - outputs are suggestions for the employee to confirm or dismiss, never conclusions;
 *   - no provider scores or ranks a person;
 *   - a provider that sends data off the workstation must say so in `describe()`, and the UI
 *     shows that text wherever the provider is used.
 */
import { runScan, type ScanRequest, type ScanResponse } from './scanners';

export interface ProviderInfo {
  id: string;
  label: string;
  /** Where processing happens and what leaves the workstation, in plain words. */
  dataHandling: string;
  offline: boolean;
}

export interface IntelligenceProvider {
  describe(): ProviderInfo;
  /** Suggest taxonomy skills and credential names from free text. */
  scanResume(req: ScanRequest): Promise<ScanResponse>;
}

export const localRulesProvider: IntelligenceProvider = {
  describe: () => ({
    id: 'local-rules',
    label: 'Local rules (no network)',
    dataHandling: 'Keyword and certification matching runs in this browser. Résumé text is never stored or sent anywhere.',
    offline: true,
  }),
  scanResume: async (req) => runScan(req),
};

const registry = new Map<string, IntelligenceProvider>([[localRulesProvider.describe().id, localRulesProvider]]);

export function registerProvider(p: IntelligenceProvider): void { registry.set(p.describe().id, p); }
export function listProviders(): ProviderInfo[] { return [...registry.values()].map((p) => p.describe()); }
export function getProvider(id: string | undefined): IntelligenceProvider { return (id && registry.get(id)) || localRulesProvider; }
