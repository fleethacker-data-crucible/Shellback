/**
 * Application store: one validated Workspace document + UI settings.
 *
 * Mutations go through `update(fn)`: the workspace is structurally cloned, the mutator
 * edits the clone, the result becomes the new state and is persisted (debounced) to
 * IndexedDB. Business rules live in ./actions.ts as pure mutators so they are unit-testable.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { newWorkspace, today, type Workspace } from '../../core/schema';
import { defaultTeams } from '../../core/analytics';
import { loadWorkspace, saveWorkspace, storageDescription, type LoadResult } from '../../storage/idb';
import { loadSettings, saveSettings, type Settings, type ViewId } from '../../storage/settings';

export type Intent =
  | { type: 'pulse'; skillId: string }
  | { type: 'manual-add'; skillId: string }
  | { type: 'radar-domain'; di: number }
  | { type: 'credential-review' };

export interface Store {
  ws: Workspace;
  ready: boolean;
  loadInfo: LoadResult | null;
  storage: string;
  update: (fn: (draft: Workspace) => void | string) => void;
  replace: (ws: Workspace, message?: string) => void;
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  view: ViewId;
  navigate: (view: ViewId, intent?: Intent) => void;
  intent: Intent | null;
  consumeIntent: () => void;
  flash: (message: string) => void;
  flashMessage: string;
}

const StoreContext = createContext<Store | null>(null);
export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore outside <StoreProvider>');
  return s;
}

/** Ensure invariants that older data may lack (default team, active team pointer). */
export function normalizeLoaded(ws: Workspace): Workspace {
  if (!ws.teams.items.length) ws.teams = defaultTeams();
  if (!ws.teams.items.some((t) => t.id === ws.teams.active)) ws.teams.active = ws.teams.items[0]!.id;
  return ws;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ws, setWs] = useState<Workspace>(() => normalizeLoaded(newWorkspace()));
  const [ready, setReady] = useState(false);
  const [loadInfo, setLoadInfo] = useState<LoadResult | null>(null);
  const [storage, setStorage] = useState('');
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [intent, setIntent] = useState<Intent | null>(null);
  const [flashMessage, setFlashMessage] = useState('');
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Workspace>(ws);
  const dirty = useRef(false);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await loadWorkspace();
      const desc = await storageDescription();
      if (cancelled) return;
      const normalized = normalizeLoaded(result.workspace);
      latest.current = normalized;
      setWs(normalized);
      setLoadInfo(result);
      setStorage(desc);
      setReady(true);
      if (result.source === 'legacy-v1' || result.recovered) {
        dirty.current = true;
        void saveWorkspace(normalized);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const flush = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (!dirty.current) return;
    dirty.current = false;
    void saveWorkspace(latest.current).catch(() => flash('Browser storage is unavailable. Export to keep your changes.'));
  }, []);

  const schedulePersist = useCallback(() => {
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 250);
  }, [flush]);

  useEffect(() => {
    const onHide = () => flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); };
  }, [flush]);

  function flash(message: string) {
    setFlashMessage(message);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashMessage(''), 4200);
  }

  const update = useCallback((fn: (draft: Workspace) => void | string) => {
    const draft = structuredClone(latest.current);
    const message = fn(draft);
    draft.meta.updated = today();
    latest.current = draft;
    setWs(draft);
    schedulePersist();
    if (typeof message === 'string' && message) flash(message);
  }, [schedulePersist]);

  const replace = useCallback((next: Workspace, message?: string) => {
    const normalized = normalizeLoaded(structuredClone(next));
    latest.current = normalized;
    setWs(normalized);
    schedulePersist();
    if (message) flash(message);
  }, [schedulePersist]);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => { const next = { ...prev, ...patch }; saveSettings(next); return next; });
  }, []);

  const navigate = useCallback((view: ViewId, nextIntent?: Intent) => {
    setSettings({ view });
    if (nextIntent) setIntent(nextIntent);
    window.scrollTo({ top: 0 });
  }, [setSettings]);

  const value = useMemo<Store>(() => ({
    ws, ready, loadInfo, storage, update, replace, settings, setSettings, view: settings.view, navigate,
    intent, consumeIntent: () => setIntent(null), flash, flashMessage,
  }), [ws, ready, loadInfo, storage, update, replace, settings, setSettings, navigate, intent, flashMessage]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
