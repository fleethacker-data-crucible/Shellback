import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from './state/store';
import { navKey, t } from './lib/i18n';
import { useDialogs } from './components/ui/dialogs';
import { Button, Notice, cn } from './components/ui/primitives';
import { pendingCredentialCandidates } from './state/actions';
import { parseWorkspace } from '../core/schema';
import { buildWorkspaceExport } from '../core/share';
import { decryptJson, encryptJson, isEncryptedEnvelope } from '../core/crypto';
import { downloadJson, readJsonFile } from './lib/files';
import { applyTheme, type Theme, type ViewId } from '../storage/settings';
import { HomeView } from './views/HomeView';
import { ProfileView } from './views/ProfileView';
import { ExploreView } from './views/ExploreView';
import { TeamView } from './views/TeamView';
import { ProgramView } from './views/ProgramView';
import { PulseDrawer } from './components/PulseDrawer';
import { Emblem } from './components/Emblem';
import { Icon, type IconName } from './components/icons';
import { endSession, hasLocalServer } from './lib/session';

const NAV: ReadonlyArray<{ id: ViewId; icon: IconName; label: string; title: string; hint: string }> = [
  { id: 'home', icon: 'home', label: 'Home', title: 'Home', hint: 'Your journey and next step' },
  { id: 'profile', icon: 'profile', label: 'My profile', title: 'My capability profile', hint: 'Intake · skills · credentials · growth' },
  { id: 'explore', icon: 'explore', label: 'Explore', title: 'Explore', hint: 'Spider web · galaxy' },
  { id: 'team', icon: 'team', label: 'Team', title: 'Team', hint: 'Sharing · coverage · missions · mentors · knowledge' },
  { id: 'program', icon: 'program', label: 'Program', title: 'Program', hint: 'Trust & data · ROI' },
];

export function App() {
  const store = useStore();
  const { ws, view, navigate, flashMessage, ready, loadInfo, replace, flash, settings, setSettings } = store;
  const dialogs = useDialogs();
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Modal dialogs (confirm, the pulse drawer) live in the browser's top layer and would hide the toast.
  // Promote the toast into the top layer too (Popover API) whenever a message is showing.
  const flashRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = flashRef.current as (HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void; matches: (s: string) => boolean }) | null;
    if (!el || typeof el.showPopover !== 'function') return;
    try {
      if (flashMessage) { el.setAttribute('popover', 'manual'); if (!el.matches(':popover-open')) el.showPopover!(); }
      else if (el.matches(':popover-open')) el.hidePopover!();
    } catch { /* popover unsupported or element not connected */ }
  }, [flashMessage]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ended, setEnded] = useState(false);
  const toReview = pendingCredentialCandidates(ws).length + ws.profile.candidates.length;
  const current = NAV.find((n) => n.id === view) ?? NAV[0]!;

  useEffect(() => { document.documentElement.dataset.reducedMotion = String(settings.reducedMotion); }, [settings.reducedMotion]);
  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme]);
  useEffect(() => { setMenuOpen(false); }, [view]);

  async function exportWorkspace() {
    const mode = await dialogs.choose(
      <>Protect this backup with a passphrase? The file is encrypted in your browser (AES-256-GCM). Without the passphrase it cannot be opened — there is no recovery.</>,
      { title: 'Export my workspace', choices: [{ value: 'plain', label: 'Plain JSON' }, { value: 'encrypt', label: 'Encrypt with passphrase', primary: true }] },
    );
    if (mode === null) return;
    const protect = mode === 'encrypt';
    const payload = buildWorkspaceExport(ws);
    const stamp = ws.meta.updated;
    if (protect) {
      const pass = await dialogs.prompt('Choose a passphrase for this backup.', { title: 'Encrypt backup', label: 'Passphrase', password: true, minLength: 8 });
      if (pass === null) return;
      try {
        downloadJson(await encryptJson(payload, pass, 'synapse-workspace'), `shellback-workspace-${stamp}.encrypted.json`);
        flash('Encrypted backup created. Keep the passphrase somewhere safe.');
      } catch (err) { flash(err instanceof Error ? err.message : 'Encryption failed.'); }
      return;
    }
    downloadJson(payload, `shellback-workspace-${stamp}.json`);
    flash('Local JSON export created. Protect this file like other personal records.');
  }

  async function quit() {
    const ok = await dialogs.confirm(
      <>Stop the local Shellback server now? Your workspace is already saved in this browser. Open Shellback again later with <code>Launch-Shellback.bat</code>.</>,
      { title: 'End this Shellback session?', confirmLabel: 'End session' },
    );
    if (!ok) return;
    if (await endSession()) setEnded(true);
    else flash('The local server did not answer. It may already be stopped; tools\\Stop-Shellback.ps1 stops any that are left.');
  }

  if (ended) {
    return (
      <main id="sessionEnded" className="mx-auto flex max-w-[60ch] flex-col items-center px-6 py-12 text-center">
        <Emblem size={280} />
        <h1 className="mt-4 text-[28px]">Shellback session ended</h1>
        <p className="mt-3 text-muted">The local server has stopped. Your workspace stays saved in this browser. You can close this tab; run <code>Launch-Shellback.bat</code> to start again.</p>
      </main>
    );
  }

  async function importWorkspace(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let data = await readJsonFile(file, 2_000_000);
      if (isEncryptedEnvelope(data)) {
        const pass = await dialogs.prompt(`"${file.name}" is an encrypted Shellback file. Enter its passphrase to continue.`, { title: 'Decrypt file', label: 'Passphrase', password: true });
        if (pass === null) return;
        data = await decryptJson(data, pass);
      }
      const parsed = parseWorkspace(data);
      const ok = await dialogs.confirm(
        <>Replace your current local workspace with the data from <b>{file.name}</b>?{parsed.migratedFrom ? ' (Upgraded from the v1 MVP format.)' : ''}{parsed.warnings.length ? <><br />Notes: {parsed.warnings.join(' ')}</> : null}</>,
        { title: 'Import workspace', confirmLabel: 'Replace workspace', danger: true },
      );
      if (!ok) return;
      replace(parsed.workspace, 'Local workspace imported and validated.');
    } catch (err) {
      flash(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="flex min-h-screen pb-7">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-mint focus:px-3 focus:py-2 focus:text-bg">{t('app.skip')}</a>
      <aside aria-label="Main navigation" className={cn('fixed top-0 bottom-7 left-0 z-40 flex w-[240px] flex-col overflow-y-auto border-r border-stroke bg-side py-3 transition-transform lg:sticky lg:h-[calc(100vh-28px)] lg:translate-x-0', menuOpen ? 'translate-x-0' : '-translate-x-full')}>
        {/* The full emblem with its wordmark (UNIFIED-UI 5 and 8). */}
        <div className="flex flex-col items-center border-b border-stroke px-3 pb-2">
          <Emblem size={184} />
          <small className="text-[12px] font-bold tracking-[0.12em] text-quiet">CAPABILITY INTELLIGENCE</small>
        </div>
        <div className="px-4 pb-2 pt-3 text-[12px] font-bold tracking-[0.1em] text-quiet">WORKSPACE <span className="text-mint">· SYNTHETIC PILOT</span></div>
        <nav id="nav" aria-label="Application sections" className="fl-nav flex flex-col gap-px">
          {NAV.map((n) => (
            <button key={n.id} type="button" data-view={n.id} aria-current={view === n.id ? 'page' : undefined}
              className={cn('flex min-h-10 items-center gap-3 px-4 py-1.5 text-left text-[14px] font-semibold text-muted transition-colors hover:bg-panel2 hover:text-text', view === n.id && 'bg-panel2 text-mint')}
              onClick={() => { setMenuOpen(false); navigate(n.id); }}>
              <Icon name={n.icon} size={20} className="shrink-0" />
              <span className="flex-1"><span className="block">{t(navKey(n.id))}</span><small className="block text-[12px] font-normal text-quiet">{n.hint}</small></span>
              {n.id === 'profile' && toReview > 0 && <span id="profileNavBadge" aria-label={`${toReview} suggestions to review`} className="rounded-full bg-amber px-2 text-[12px] font-bold text-on-accent">{toReview}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-stroke px-4 pt-3">
          <p className="text-[12px] text-quiet">Your work stays in this browser unless you explicitly export it. This pilot does not establish qualifications or clearances.</p>
          <Button id="exportBtn" full className="mt-3" disabled={!ready} onClick={exportWorkspace}><Icon name="export" />Export my workspace</Button>
          {hasLocalServer() && <Button id="endSessionBtn" variant="ghost" size="sm" full className="mt-2" title="Stop the local Shellback server (it also stops by itself when this tab closes)" onClick={quit}><Icon name="power" />End session</Button>}
          <div role="radiogroup" aria-label="Theme" id="themeSwitch" className="mt-3 flex gap-1 rounded-md border border-stroke bg-bg/40 p-1">
            {(['system', 'dark', 'light'] as Theme[]).map((t) => <button key={t} type="button" role="radio" aria-checked={settings.theme === t} data-theme-choice={t} title={t === 'system' ? 'Follow Windows' : t === 'dark' ? 'Night watch' : 'Chart room'} className={cn('flex min-h-8 flex-1 items-center justify-center gap-1 rounded-sm px-1 text-[12px] font-semibold text-quiet hover:text-text', settings.theme === t && 'bg-panel2 text-text')} onClick={() => setSettings({ theme: t })}><Icon name={t === 'system' ? 'themeSystem' : t === 'dark' ? 'themeDark' : 'themeLight'} />{t === 'system' ? 'Auto' : t === 'dark' ? 'Night' : 'Chart'}</button>)}
          </div>
        </div>
      </aside>
      {menuOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <main id="main" className="min-w-0 flex-1 px-4 pb-10 pt-4 md:px-7">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Icon name="menu" /></Button>
            <div>
              <div className="eyebrow">DATA CRUCIBLE <span className="text-mint">/</span> WORKFORCE INTELLIGENCE</div>
              <h1 id="pageTitle" className="text-[20px]">{current.title}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="demo-identity inline-flex items-center gap-2 rounded-full border border-stroke px-3 py-1 text-[12px] font-bold text-muted hover:text-text" data-view="program" title="This offline demo has no authenticated sign-in" onClick={() => navigate({ view: 'program', tab: 'governance' })}>
              <span className="text-mint">●</span> Local demo · No login
            </button>
            <Button id="importBtn" onClick={() => fileRef.current?.click()}><Icon name="import" />Import data</Button>
            <input ref={fileRef} id="importFile" hidden type="file" accept=".json,application/json" onChange={importWorkspace}  aria-label="Import a Shellback file"/>
            <button type="button" className="h-9 w-9 rounded-full bg-gradient-to-br from-mint to-blue text-[12px] font-extrabold text-on-accent" data-view="profile" aria-label="Open my capability profile" title={`${ws.profile.displayName.trim() ? `${ws.profile.displayName.trim()} — your initials` : 'Your initials appear here once you set a display name (Team → Share your card)'} · open My profile`} onClick={() => navigate('profile')}>
              {ws.profile.displayName.trim() ? ws.profile.displayName.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'ME'}
            </button>
          </div>
        </header>

        <div id="flash" ref={flashRef} role="status" aria-live="polite" className={cn('flash pointer-events-none fixed bottom-4 right-4 z-50 max-w-[420px] rounded-md border border-mint/40 bg-panel2 px-4 py-3 text-[13px] text-text shadow-panel', flashMessage && 'show')}>{flashMessage}</div>

        {loadInfo?.recovered && (
          <Notice tone="warn" className="mb-4">
            <b>Stored data could not be validated and was set aside, not deleted.</b> Reason: {loadInfo.recovered.reason} A raw copy is kept under <code>{loadInfo.recovered.key}</code>; you can download it from Program → Trust &amp; data → Recovery.
          </Notice>
        )}
        {loadInfo?.source === 'legacy-v1' && <Notice className="mb-4">Your earlier Shellback MVP data was found in this browser and upgraded to the new format. The original copy was left untouched.</Notice>}

        {!ready ? <p className="text-muted">Loading local workspace…</p> : (
          <>
            {view === 'home' && <HomeView />}
            {view === 'profile' && <ProfileView />}
            {view === 'explore' && <ExploreView />}
            {view === 'team' && <TeamView />}
            {view === 'program' && <ProgramView />}
          </>
        )}
        <PulseDrawer />
      </main>
      {/* Status bar (UNIFIED-UI 5): engine state as a dot and a word, the address, session, version. */}
      <footer aria-label="Status" className="fixed inset-x-0 bottom-0 z-40 flex h-7 items-center gap-4 overflow-hidden whitespace-nowrap border-t border-stroke bg-side px-4 text-[12px] text-quiet">
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className={cn('inline-block h-2 w-2 rounded-full', hasLocalServer() ? 'bg-ok' : 'bg-blue')} />{hasLocalServer() ? 'Running' : 'Standalone file'}</span>
        <span className="font-mono">{location.host || 'file://'}</span>
        <span>Local demo · no login · synthetic data</span>
        <span className="ml-auto">Shellback v{__SHELLBACK_VERSION__} · build {document.documentElement.dataset.build ?? 'dev'} · {document.documentElement.dataset.edition ?? 'dev'} edition</span>
      </footer>
    </div>
  );
}
