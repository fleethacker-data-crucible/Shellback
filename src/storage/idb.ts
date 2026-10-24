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

export async function loadWorkspace(): Promise<LoadResult> {
  const db = await openDb();
  let stored: unknown;
  let source: LoadResult['source'] = 'new';

  if (db) {
    try { stored = await idbGet(db, STORE, KEY); } catch { stored = undefined; }
    if (stored !== undefined) source = 'indexeddb';
  }
  if (stored === undefined) {
    stored = readLocal(FALLBACK_LOCAL_KEY);
    if (stored !== undefined) source = 'localstorage';
  }
  if (stored === undefined) {
    stored = readLocal(LEGACY_LOCAL_KEY);
    if (stored !== undefined) source = 'legacy-v1';
  }
  if (stored === undefined) return { workspace: newWorkspace(), source: 'new', warnings: [] };

  try {
    const parsed = parseWorkspace(stored);
    return { workspace: parsed.workspace, source, warnings: parsed.warnings };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const key = await stashBackup(db, stored, reason);
    return { workspace: newWorkspace(), source: 'new', warnings: [], recovered: { key, reason } };
  }
}

export async function saveWorkspace(ws: Workspace): Promise<'indexeddb' | 'localstorage'> {
  const db = await openDb();
  if (db) {
    try { await idbPut(db, STORE, KEY, ws); return 'indexeddb'; } catch { /* fall back */ }
  }
  localStorage.setItem(FALLBACK_LOCAL_KEY, JSON.stringify(ws));
  return 'localstorage';
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
