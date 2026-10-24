import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from './state/store';
import { useDialogs } from './components/ui/dialogs';
import { Button, Notice, cn } from './components/ui/primitives';
import { pendingCredentialCandidates } from './state/actions';
import { parseWorkspace } from '../core/schema';
import { buildWorkspaceExport } from '../core/share';
import { decryptJson, encryptJson, isEncryptedEnvelope } from '../core/crypto';
import { downloadJson, readJsonFile } from './lib/files';
import type { ViewId } from '../storage/settings';
import { OverviewView } from './views/OverviewView';
import { SpiderWebView } from './views/SpiderWebView';
import { GalaxyView } from './views/GalaxyView';
import { ProfileView } from './views/ProfileView';
import { CredentialsView } from './views/CredentialsView';
import { TeamView } from './views/TeamView';
import { WorkforceView } from './views/WorkforceView';
import { RoiView } from './views/RoiView';
import { TrustView } from './views/TrustView';

const NAV: ReadonlyArray<{ id: ViewId; icon: string; label: string; title: string }> = [
  { id: 'overview', icon: '▦', label: 'Overview', title: 'Mission capability, made visible.' },
  { id: 'radar', icon: '◈', label: 'Skills spider web', title: 'Skills spider web' },
  { id: 'graph', icon: '⌘', label: 'Skills galaxy', title: 'Skills galaxy' },
  { id: 'profile', icon: '◉', label: 'My capability profile', title: 'My capability profile' },
  { id: 'credentials', icon: '▤', label: 'Credential desk', title: 'Credential desk' },
  { id: 'team', icon: '▥', label: 'Teams & sharing', title: 'Team intelligence' },
  { id: 'workforce', icon: '✧', label: 'Workforce tools', title: 'FLEETHACKER workforce' },
  { id: 'roi', icon: '◇', label: 'ROI laboratory', title: 'ROI laboratory' },
  { id: 'trust', icon: '⬡', label: 'Trust & governance', title: 'Trust & governance' },
];

export function App() {
  const store = useStore();
  const { ws, view, navigate, flashMessage, ready, loadInfo, replace, flash, settings } = store;
  const dialogs = useDialogs();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pendingCreds = pendingCredentialCandidates(ws).length;
  const current = NAV.find((n) => n.id === view) ?? NAV[0]!;

  useEffect(() => { document.documentElement.dataset.reducedMotion = String(settings.reducedMotion); }, [settings.reducedMotion]);
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
        downloadJson(await encryptJson(payload, pass, 'synapse-workspace'), `synapse-workspace-${stamp}.encrypted.json`);
        flash('Encrypted backup created. Keep the passphrase somewhere safe.');
      } catch (err) { flash(err instanceof Error ? err.message : 'Encryption failed.'); }
      return;
    }
    downloadJson(payload, `synapse-workspace-${stamp}.json`);
    flash('Local JSON export created. Protect this file like other personal records.');
  }

  async function importWorkspace(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let data = await readJsonFile(file, 2_000_000);
      if (isEncryptedEnvelope(data)) {
        const pass = await dialogs.prompt(`"${file.name}" is an encrypted Synapse file. Enter its passphrase to continue.`, { title: 'Decrypt file', label: 'Passphrase', password: true });
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
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-mint focus:px-3 focus:py-2 focus:text-bg">Skip to content</a>
      <aside aria-label="Main navigation" className={cn('fixed inset-y-0 left-0 z-40 flex w-[255px] flex-col border-r border-[#25334a] bg-gradient-to-br from-[#0d1729] to-[#0b1423] px-[15px] py-[26px] transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0', menuOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-3 px-[13px] pb-9">
          <div aria-hidden="true" className="relative h-[35px] w-[35px] drop-shadow-[0_0_14px_#5cf1cb50]">
            {[[1, 13], [13, 0], [13, 26], [27, 8], [27, 19]].map(([t, l], i) => <span key={i} className="absolute h-2 w-2 rounded-full bg-mint" style={{ top: t, left: l }} />)}
          </div>
          <div><strong className="block text-[20px] font-extrabold tracking-[0.14em]">SYNAPSE</strong><small className="block text-[8px] font-extrabold tracking-[0.15em] text-[#7d9bae]">CAPABILITY INTELLIGENCE</small></div>
        </div>
        <div className="px-[13px] pb-3 text-[10px] font-extrabold tracking-[0.1em] text-quiet">WORKSPACE <span className="mt-2 block text-mint">SYNTHETIC PILOT</span></div>
        <nav id="nav" aria-label="Application sections" className="flex flex-col gap-1">
          {NAV.map((n) => (
            <button key={n.id} type="button" data-view={n.id} aria-current={view === n.id ? 'page' : undefined}
              className={cn('flex items-center gap-3 rounded-md px-[13px] py-2 text-left text-[13px] font-bold text-muted transition-colors hover:bg-white/5 hover:text-text', view === n.id && 'bg-mint/10 text-mint')}
              onClick={() => { setMenuOpen(false); navigate(n.id); }}>
              <span className="w-4 text-center text-[13px]" aria-hidden="true">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.id === 'credentials' && pendingCreds > 0 && <span id="credentialNavBadge" aria-label="Pending credential suggestions" className="rounded-full bg-amber px-2 text-[11px] font-extrabold text-[#2b1a05]">{pendingCreds}</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-[13px] pt-6">
          <div className="text-[10px] font-extrabold tracking-[0.1em] text-mint">● &nbsp; OFFLINE DEMO · NO AUTHENTICATED ACCOUNT</div>
          <p className="mt-2 text-[11px] text-quiet">Your work stays in this browser unless you explicitly export it. This pilot does not establish qualifications or clearances.</p>
          <Button id="exportBtn" full className="mt-3" disabled={!ready} onClick={exportWorkspace}>↥ Export my workspace</Button>
        </div>
      </aside>
      {menuOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <main id="main" className="min-w-0 flex-1 px-4 pb-10 pt-4 md:px-7">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>☰</Button>
            <div>
              <div className="eyebrow">DATA CRUCIBLE <span className="text-mint">/</span> WORKFORCE INTELLIGENCE</div>
              <h1 id="pageTitle" className="text-[20px] md:text-[24px]">{current.title}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="demo-identity inline-flex items-center gap-2 rounded-full border border-stroke px-3 py-1 text-[12px] font-bold text-muted hover:text-text" data-view="trust" title="This offline demo has no authenticated sign-in" onClick={() => navigate('trust')}>
              <span className="text-mint">●</span> Local demo · No login
            </button>
            <Button id="importBtn" onClick={() => fileRef.current?.click()}>↧ Import data</Button>
            <input ref={fileRef} id="importFile" hidden type="file" accept=".json,application/json" onChange={importWorkspace} />
            <button type="button" className="h-9 w-9 rounded-full bg-gradient-to-br from-mint to-blue text-[12px] font-extrabold text-bg" data-view="profile" aria-label="Open my capability profile" onClick={() => navigate('profile')}>
              {ws.profile.displayName.trim() ? ws.profile.displayName.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'ME'}
            </button>
          </div>
        </header>

        <div id="flash" role="status" aria-live="polite" className={cn('flash pointer-events-none fixed top-4 right-4 z-50 max-w-[420px] rounded-md border border-mint/40 bg-[#0d1f2f] px-4 py-3 text-[13px] text-text shadow-panel', flashMessage && 'show')}>{flashMessage}</div>

        {loadInfo?.recovered && (
          <Notice tone="warn" className="mb-4">
            <b>Stored data could not be validated and was set aside, not deleted.</b> Reason: {loadInfo.recovered.reason} A raw copy is kept under <code>{loadInfo.recovered.key}</code>; you can download it from Trust &amp; governance → Recovery.
          </Notice>
        )}
        {loadInfo?.source === 'legacy-v1' && <Notice className="mb-4">Your earlier Synapse MVP data was found in this browser and upgraded to the new format. The original copy was left untouched.</Notice>}

        {!ready ? <p className="text-muted">Loading local workspace…</p> : (
          <>
            {view === 'overview' && <OverviewView />}
            {view === 'radar' && <SpiderWebView />}
            {view === 'graph' && <GalaxyView />}
            {view === 'profile' && <ProfileView />}
            {view === 'credentials' && <CredentialsView />}
            {view === 'team' && <TeamView />}
            {view === 'workforce' && <WorkforceView />}
            {view === 'roi' && <RoiView />}
            {view === 'trust' && <TrustView />}
          </>
        )}
        <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t border-stroke pt-4 text-[11px] text-quiet">
          <span>SYNAPSE <b>v{__SYNAPSE_VERSION__}</b> · build {document.documentElement.dataset.build ?? 'dev'} · {document.documentElement.dataset.edition ?? 'dev'} edition</span>
          <span>Designed for trust · Built for discovery · Synthetic demonstration</span>
        </footer>
      </main>
    </div>
  );
}
