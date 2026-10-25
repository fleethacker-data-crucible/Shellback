/**
 * Rename (Synapse → Shellback) compatibility guards.
 *  - Browser storage names stay on the former name: existing users' data lives there.
 *  - Export format ids stay on the former name: old files must import, older copies must read new ones.
 *  - The service worker deletes the pre-rename `synapse-*` cache instead of orphaning it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parsePeerCard } from '../../src/core/schema';

const root = process.env.SHELLBACK_ROOT ?? process.env.SYNAPSE_ROOT ?? process.cwd();
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

test('browser storage names are unchanged by the rename', () => {
  const idb = src('src/storage/idb.ts');
  assert.match(idb, /const DB_NAME = 'synapse';/);
  assert.match(idb, /LEGACY_LOCAL_KEY = 'synapse-mvp-v1'/);
  assert.match(idb, /FALLBACK_LOCAL_KEY = 'synapse-workspace-v2'/);
  assert.match(idb, /new BroadcastChannel\('synapse-workspace'\)/);
  assert.match(idb, /'synapse-backup-'/);
  assert.match(src('src/storage/settings.ts'), /const KEY = 'synapse-settings-v3';/);
  assert.match(src('src/storage/intel-settings.ts'), /INTEL_KEY = 'synapse-intel-v1'/);
});

test('a peer card exported before the rename still imports', () => {
  const card = JSON.parse(src('examples/employees/casey-rivera-peer-card.json'));
  assert.equal(card.format, 'synapse-peer-card');
  assert.doesNotThrow(() => parsePeerCard(card));
});

test('service worker removes pre-rename caches on activate', async () => {
  const code = src('public/sw.js').replace('{{BUILD_ID}}', 'abc123').replace('{{PRECACHE}}', '[]');
  const listeners: Record<string, (e: unknown) => void> = {};
  const store = new Set(['synapse-oldbuild', 'shellback-abc123', 'shellback-older']);
  const self = { addEventListener: (t: string, f: (e: unknown) => void) => { listeners[t] = f; }, clients: { claim: async () => undefined }, location: { origin: 'http://127.0.0.1:8765' }, skipWaiting: async () => undefined };
  const caches = { keys: async () => [...store], delete: async (k: string) => store.delete(k), open: async () => ({ addAll: async () => undefined }) };
  vm.runInNewContext(code, { self, caches, URL, fetch: async () => { throw new Error('offline'); } });
  let done: Promise<unknown> = Promise.resolve();
  listeners.activate!({ waitUntil: (p: Promise<unknown>) => { done = p; } });
  await done;
  assert.deepEqual([...store], ['shellback-abc123']);
});
