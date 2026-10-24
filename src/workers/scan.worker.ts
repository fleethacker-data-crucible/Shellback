/**
 * Résumé scan worker. Keeps keyword matching over up to 100 KB of text off the UI thread.
 * Bundled by tools/build.mjs and instantiated from a Blob URL (works for file:// too).
 *
 * Message protocol:
 *   in : { id: number, type: 'scan', request: ScanRequest }
 *   out: { id: number, type: 'result', response: ScanResponse } | { id, type: 'error', message }
 */
import { runScan, type ScanRequest } from '../core/scanners';

export interface ScanWorkerIn { id: number; type: 'scan'; request: ScanRequest }
export type ScanWorkerOut =
  | { id: number; type: 'result'; response: ReturnType<typeof runScan> }
  | { id: number; type: 'error'; message: string };

const scope = self as unknown as { onmessage: ((e: MessageEvent<ScanWorkerIn>) => void) | null; postMessage: (m: ScanWorkerOut) => void };

scope.onmessage = (e) => {
  const msg = e.data;
  if (!msg || msg.type !== 'scan') return;
  try {
    scope.postMessage({ id: msg.id, type: 'result', response: runScan(msg.request) });
  } catch (err) {
    scope.postMessage({ id: msg.id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
