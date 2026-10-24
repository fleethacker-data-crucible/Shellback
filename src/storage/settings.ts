/** UI settings live in localStorage (TechStack: IndexedDB for data, localStorage for settings). */
export type ViewId = 'home' | 'profile' | 'explore' | 'team' | 'program';
export const VIEW_IDS: readonly ViewId[] = ['home', 'profile', 'explore', 'team', 'program'];

export type ProfileTab = 'intake' | 'skills' | 'credentials' | 'growth';
export type ExploreTab = 'web' | 'galaxy';
export type TeamTab = 'roster' | 'coverage' | 'missions' | 'mentors' | 'knowledge';
export type ProgramTab = 'governance' | 'intelligence' | 'roi';

export const PROFILE_TABS: readonly ProfileTab[] = ['intake', 'skills', 'credentials', 'growth'];
export const EXPLORE_TABS: readonly ExploreTab[] = ['web', 'galaxy'];
export const TEAM_TABS: readonly TeamTab[] = ['roster', 'coverage', 'missions', 'mentors', 'knowledge'];
export const PROGRAM_TABS: readonly ProgramTab[] = ['governance', 'intelligence', 'roi'];

export interface Settings {
  view: ViewId;
  profileTab: ProfileTab;
  exploreTab: ExploreTab;
  teamTab: TeamTab;
  programTab: ProgramTab;
  galaxyMode: 'confirmed' | 'pathways';
  reducedMotion: boolean;
  theme: Theme;
}
export type Theme = 'system' | 'dark' | 'light';
export const THEMES: readonly Theme[] = ['system', 'dark', 'light'];

const KEY = 'synapse-settings-v3';
export const DEFAULT_SETTINGS: Settings = {
  view: 'home', profileTab: 'intake', exploreTab: 'web', teamTab: 'roster', programTab: 'governance', galaxyMode: 'confirmed', reducedMotion: false, theme: 'system',
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      view: pick(v.view, VIEW_IDS, 'home'),
      profileTab: pick(v.profileTab, PROFILE_TABS, 'intake'),
      exploreTab: pick(v.exploreTab, EXPLORE_TABS, 'web'),
      teamTab: pick(v.teamTab, TEAM_TABS, 'roster'),
      programTab: pick(v.programTab, PROGRAM_TABS, 'governance'),
      galaxyMode: v.galaxyMode === 'pathways' ? 'pathways' : 'confirmed',
      reducedMotion: v.reducedMotion === true,
      theme: pick(v.theme, THEMES, 'system'),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* settings are a convenience only */ }
}

/** A place in the app: a top-level view plus (optionally) its sub-tab. */
export type Route =
  | { view: 'home' }
  | { view: 'profile'; tab?: ProfileTab }
  | { view: 'explore'; tab?: ExploreTab }
  | { view: 'team'; tab?: TeamTab }
  | { view: 'program'; tab?: ProgramTab };

/** Resolve and apply the theme to <html data-theme>. 'system' follows prefers-color-scheme. */
export function applyTheme(theme: Theme): 'dark' | 'light' {
  const resolved = theme === 'system' ? (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeSetting = theme;
  return resolved;
}
