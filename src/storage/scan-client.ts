/**
 * Main-thread client for the scan worker. Falls back to synchronous scanning when a
 * worker cannot be created (very old browser, blocked blob: URLs) so the feature always works.
 */
import workerSource from 'worker:scan';
import { runScan, type ScanRequest, type ScanResponse } from '../core/scanners';
import type { ScanWorkerIn, ScanWorkerOut } from '../workers/scan.worker';

let worker: Worker | null | undefined;
let seq = 0;
const pending = new Map<number, { resolve: (r: ScanResponse) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = (e: MessageEvent<ScanWorkerOut>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.type === 'result') p.resolve(e.data.response);
      else p.reject(new Error(e.data.message));
    };
    worker.onerror = () => {
      for (const p of pending.values()) p.reject(new Error('Scan worker failed.'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

export function scanResume(request: ScanRequest): Promise<ScanResponse> {
  const w = getWorker();
  if (!w) return Promise.resolve(runScan(request));
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    const msg: ScanWorkerIn = { id, type: 'scan', request };
    w.postMessage(msg);
  }).catch(() => runScan(request)) as Promise<ScanResponse>;
}

export const scanRunsInWorker = (): boolean => getWorker() !== null;
