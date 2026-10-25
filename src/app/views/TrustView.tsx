import { useEffect, useState } from 'react';
import { newWorkspace } from '../../core/schema';
import { useStore } from '../state/store';
import { useDialogs } from '../components/ui/dialogs';
import { listBackups, type BackupEntry } from '../../storage/idb';
import { scanRunsInWorker } from '../../storage/scan-client';
import { Button, Checkbox, Empty, Panel, PanelHeading, SectionIntro } from '../components/ui/primitives';
import { downloadJson } from '../lib/files';
import { activeProvider } from '../../storage/intel-settings';
import { DataLeavesTable } from './IntelligenceView';

const LANES = [
  ['01 · Résumé claim', 'A keyword match proposes a skill for review. It cannot establish ability or currency.'],
  ['02 · Confidence', 'Self-report to a task-specific prompt; not a verified measure of competency.'],
  ['03 · Execution mode', 'Independent, guided, and approved AI-assisted accomplishment are separate, not collapsed.'],
  ['04 · Recent activity', 'Only voluntary declarations. Missing or old records mean unknown, not deficient.'],
  ['05 · Credentials', 'Self-entered inventory; authoritative verification requires approved external systems.'],
  ['06 · Employee agency', 'Correct, withdraw sharing, export, or delete the local profile. No passive telemetry.'],
] as const;

export function TrustView() {
  const { ws, replace, storage, settings, setSettings, navigate } = useStore();
  const dialogs = useDialogs();
  const [backups, setBackups] = useState<BackupEntry[] | null>(null); // null = still checking
  useEffect(() => { void listBackups().then(setBackups); }, []);
  const edition = document.documentElement.dataset.edition ?? 'dev';
  const provider = activeProvider().describe();

  return (
    <section id="trust" className="space-y-5">
      <SectionIntro eyebrow="FOUNDATIONS / TRUST" title="Evidence stays in its lane.">Separating signals is a core product requirement. There is no opaque universal skill score and no automatic employment decision.</SectionIntro>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{LANES.map(([t, d]) => <Panel key={t} as="article" className="p-4"><strong className="block text-[13px] text-mint">{t}</strong><p className="mt-1 text-[13px] text-muted">{d}</p></Panel>)}</div>
      <Panel>
        <PanelHeading title="Data boundaries" />
        <p className="text-[13px]"><strong>Account status: Local demonstration — no login has been implemented.</strong> Neither a profile selector nor a browser lock is authentication. For government or enterprise deployment, connect to an approved organizational identity provider with server-enforced permissions and encrypted storage.</p>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]">
          <dt className="text-quiet">Workspace data</dt><dd id="storageStatus">{storage || 'detecting…'} — no remote scripts, telemetry, or API calls.</dd>
          <dt className="text-quiet">UI settings</dt><dd>localStorage (view, tabs, motion preference)</dd>
          <dt className="text-quiet">Résumé scanning</dt><dd>{scanRunsInWorker() ? 'Web Worker, local; résumé text is never persisted' : 'Main thread, local; résumé text is never persisted'}</dd>
          <dt className="text-quiet">Edition</dt><dd>{edition === 'served' ? 'Served from 127.0.0.1 (PowerShell/Node loopback server); offline cache via service worker' : edition === 'standalone' ? 'Single-file standalone (file://); no service worker' : 'development'}</dd>
          <dt className="text-quiet">Exports</dt><dd>Plain JSON, or AES-256-GCM encrypted with a passphrase (Web Crypto, PBKDF2-SHA-256). Encryption protects the file at rest, not the recipient's conduct.</dd>
          <dt className="text-quiet">Intelligence</dt><dd id="trustIntel">{provider.label}{provider.offline ? ' — nothing is sent anywhere.' : ` — sends task data to ${provider.origin}. `}{!provider.offline && <Button size="sm" variant="ghost" className="ml-1 underline" onClick={() => navigate({ view: 'program', tab: 'intelligence' })}>Change</Button>}</dd>
          <dt className="text-quiet">Network</dt><dd>Content-Security-Policy forbids any connection other than the page's own origin{!provider.offline ? ' and the provider host allowed at build time' : ''}.</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button id="downloadJson" onClick={() => document.getElementById('exportBtn')?.click()}>Export JSON backup</Button>
          <Button id="resetDemo" variant="danger" onClick={async () => { if (await dialogs.confirm('Reset the local Shellback workspace? Export first if you need a backup.', { title: 'Reset everything', confirmLabel: 'Reset workspace', danger: true })) { replace(newWorkspace(), 'Reset complete.'); navigate('home'); } }}>Reset everything to synthetic demo</Button>
        </div>
        <Checkbox className="mt-4" checked={settings.reducedMotion} onChange={(v) => setSettings({ reducedMotion: v })}>Reduce motion (also follows your operating-system preference automatically)</Checkbox>
        <p className="note mt-3">Local storage is accessible to anyone using the same browser profile. For real personnel data, deploy an approved backend with identity, access control, encryption, audit logging, records retention, privacy and labor review, and an ATO where required. Do not place actual personnel data into this offline prototype on a shared workstation.</p>
      </Panel>
      {!provider.offline && (
        <Panel id="trustIntelDisclosure">
          <PanelHeading eyebrow="WHAT LEAVES THIS WORKSTATION" title={`With ${provider.label} selected`}>{provider.dataHandling}</PanelHeading>
          <DataLeavesTable />
        </Panel>
      )}
      <Panel id="recovery">
        <PanelHeading title="Recovery">If stored data ever fails validation it is set aside here instead of being discarded. Download a copy, fix it, and import it again.</PanelHeading>
        {backups === null ? <p className="note" aria-live="polite">Checking for recovered data…</p> : backups.length ? <div className="space-y-1.5">{backups.map((b) => <div key={b.key} className="row-card"><div><strong className="block text-[13px]">{b.key}</strong><small className="text-quiet">{b.reason}</small></div><Button size="sm" onClick={() => downloadJson(b.raw, `${b.key}.json`)}>Download raw</Button></div>)}</div> : <Empty>No recovered data. Workspace last updated {ws.meta.updated}.</Empty>}
      </Panel>
    </section>
  );
}
