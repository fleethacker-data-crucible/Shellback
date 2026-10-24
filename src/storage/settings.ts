/** UI settings live in localStorage (TechStack: IndexedDB for data, localStorage for settings). */
export type ViewId = 'overview' | 'radar' | 'graph' | 'profile' | 'credentials' | 'team' | 'workforce' | 'roi' | 'trust';
export const VIEW_IDS: readonly ViewId[] = ['overview', 'radar', 'graph', 'profile', 'credentials', 'team', 'workforce', 'roi', 'trust'];

export interface Settings {
  view: ViewId;
  galaxyMode: 'confirmed' | 'pathways';
  workforceTab: 'qualforge' | 'skillfleet' | 'teamforge' | 'mentorlink' | 'relay';
  labTab: 'compose' | 'mentors' | 'relay';
  reducedMotion: boolean;
}

const KEY = 'synapse-settings-v2';
export const DEFAULT_SETTINGS: Settings = { view: 'overview', galaxyMode: 'confirmed', workforceTab: 'qualforge', labTab: 'compose', reducedMotion: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      view: VIEW_IDS.includes(v.view as ViewId) ? (v.view as ViewId) : 'overview',
      galaxyMode: v.galaxyMode === 'pathways' ? 'pathways' : 'confirmed',
      workforceTab: ['qualforge', 'skillfleet', 'teamforge', 'mentorlink', 'relay'].includes(v.workforceTab ?? '') ? (v.workforceTab as Settings['workforceTab']) : 'qualforge',
      labTab: ['compose', 'mentors', 'relay'].includes(v.labTab ?? '') ? (v.labTab as Settings['labTab']) : 'compose',
      reducedMotion: v.reducedMotion === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* settings are a convenience only */ }
}
