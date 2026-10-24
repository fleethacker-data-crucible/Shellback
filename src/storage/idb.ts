/**
 * Workspace persistence.
 *   data     → IndexedDB  (database "synapse", store "workspace", key "current")
 *   backups  → IndexedDB  (store "backups": raw copies of anything that failed validation)
 *   fallback → localStorage when IndexedDB is unavailable (private mode, blocked storage)
 *
 * Nothing is ever silently discarded: unparsable data is copied to the backups store and
 * surfaced to the employee, who can export it.
 */
import { parseWorkspace, newWorkspace, type Workspace } from '../core/schema';

const DB_NAME = 'synapse';
const DB_VERSION = 1;
const STORE = 'workspace';
const BACKUPS = 'backups';
const KEY = 'current';
export const LEGACY_LOCAL_KEY = 'synapse-mvp-v1';
export const FALLBACK_LOCAL_KEY = 'synapse-workspace-v2';

export interface LoadResult {
  workspace: Workspace;
  source: 'indexeddb' | 'localstorage' | 'legacy-v1' | 'new';
  warnings: string[];
  /** Set when stored data failed validation and was moved to the backups store. */
  recovered?: { key: string; reason: string };
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
/** Set when IndexedDB could not be read: we must not overwrite a record we never saw. */
let idbReadFailed = false;
const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('synapse-workspace') : null;

/** Notify other tabs of this origin that a newer revision was saved. */
export function onRemoteSave(cb: (rev: number) => void): () => void {
  if (!channel) return () => undefined;
  const handler = (e: MessageEvent<{ type: string; rev: number }>) => { if (e.data?.type === 'saved') cb(e.data.rev); };
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(BACKUPS)) db.createObjectStore(BACKUPS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function idbGet<T>(db: IDBDatabase, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(db: IDBDatabase, store: string, key: IDBValidKey, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
function idbKeys(db: IDBDatabase, store: string): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readLocal(key: string): unknown | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

async function stashBackup(db: IDBDatabase | null, raw: unknown, reason: string): Promise<string> {
  const key = `backup-${new Date().toISOString()}`;
  const value = { reason, raw, created: new Date().toISOString() };
  if (db) {
    try { await idbPut(db, BACKUPS, key, value); return key; } catch { /* fall through */ }
  }
  try { localStorage.setItem(`synapse-${key}`, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  return key;
}

/**
 * Reads every place a workspace can live and returns the newest valid one (highest meta.rev).
 * IndexedDB and the localStorage fallback can both hold data when an IndexedDB write once failed;
 * neither silently wins. Anything unparsable is copied to the backups store first.
 */
export async function loadWorkspace(): Promise<LoadResult> {
  const db = await openDb();
  const raw: Array<{ source: LoadResult['source']; value: unknown }> = [];
  idbReadFailed = false;
  if (db) {
    try {
      const v = await idbGet(db, STORE, KEY);
      if (v !== undefined) raw.push({ source: 'indexeddb', value: v });
    } catch {
      idbReadFailed = true; // keep going with other sources, but never overwrite IndexedDB this session
    }
  }
  const local = readLocal(FALLBACK_LOCAL_KEY);
  if (local !== undefined) raw.push({ source: 'localstorage', value: local });
  if (!raw.length) {
    const legacy = readLocal(LEGACY_LOCAL_KEY);
    if (legacy !== undefined) raw.push({ source: 'legacy-v1', value: legacy });
  }
  if (!raw.length) return { workspace: newWorkspace(), source: 'new', warnings: [] };

  let best: { source: LoadResult['source']; workspace: Workspace; warnings: string[] } | null = null;
  let recovered: LoadResult['recovered'];
  for (const r of raw) {
    try {
      const parsed = parseWorkspace(r.value);
      if (!best || parsed.workspace.meta.rev > best.workspace.meta.rev) best = { source: r.source, workspace: parsed.workspace, warnings: parsed.warnings };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      recovered = { key: await stashBackup(db, r.value, reason), reason };
    }
  }
  if (!best) return { workspace: newWorkspace(), source: 'new', warnings: [], ...(recovered ? { recovered } : {}) };
  return { workspace: best.workspace, source: best.source, warnings: best.warnings, ...(recovered ? { recovered } : {}) };
}

export async function saveWorkspace(ws: Workspace): Promise<'indexeddb' | 'localstorage'> {
  const db = await openDb();
  let where: 'indexeddb' | 'localstorage' = 'localstorage';
  if (db && !idbReadFailed) {
    try {
      await idbPut(db, STORE, KEY, ws);
      where = 'indexeddb';
      try { localStorage.removeItem(FALLBACK_LOCAL_KEY); } catch { /* ignore */ }
    } catch { /* fall back below */ }
  }
  if (where === 'localstorage') localStorage.setItem(FALLBACK_LOCAL_KEY, JSON.stringify(ws));
  channel?.postMessage({ type: 'saved', rev: ws.meta.rev });
  return where;
}

export interface BackupEntry { key: string; reason: string; created: string; raw: unknown }
export async function listBackups(): Promise<BackupEntry[]> {
  const out: BackupEntry[] = [];
  const db = await openDb();
  if (db) {
    try {
      for (const key of await idbKeys(db, BACKUPS)) {
        const v = await idbGet<{ reason: string; created: string; raw: unknown }>(db, BACKUPS, key);
        if (v) out.push({ key: String(key), ...v });
      }
    } catch { /* ignore */ }
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('synapse-backup-')) {
        const v = readLocal(k) as { reason: string; created: string; raw: unknown } | undefined;
        if (v) out.push({ key: k, ...v });
      }
    }
  } catch { /* ignore */ }
  return out.sort((a, b) => b.created.localeCompare(a.created));
}

export async function storageDescription(): Promise<string> {
  const db = await openDb();
  return db ? 'IndexedDB (this browser profile only)' : 'localStorage fallback (IndexedDB unavailable)';
}
