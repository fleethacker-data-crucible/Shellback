/**
 * Program → Intelligence. Choose where suggestions come from.
 * Local rules is the default and needs nothing. A remote provider is a conscious, visible choice:
 * the user sees exactly what will leave this workstation before anything can be sent.
 */
import { useState } from 'react';
import { useStore } from '../state/store';
import { useDialogs } from '../components/ui/dialogs';
import { Button, Field, Input, Notice, Panel, PanelHeading, Pill, SectionIntro, Textarea } from '../components/ui/primitives';
import { TEAM_BRIEF_FIELDS, validateEndpoint } from '../../core/intelligence';
import { ALLOWED_INTEL_HOSTS, activeProvider, applyIntelSettings, currentIntelSettings, isHostAllowed, lockToken, previewProvider, sealToken, tokenUnlocked, unlockToken, type IntelSettings } from '../../storage/intel-settings';

export function IntelligenceView() {
  const { flash } = useStore();
  const dialogs = useDialogs();
  const [s, setS] = useState<IntelSettings>(() => structuredClone(currentIntelSettings()));
  const [, rerender] = useState(0);
  const [test, setTest] = useState<{ ok: boolean; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const endpointError = s.remote.endpoint ? validateEndpoint(s.remote.endpoint) : null;
  const remoteReady = !!s.remote.endpoint && !endpointError;
  const hostAllowed = remoteReady && isHostAllowed(s.remote.endpoint);
  const live = activeProvider().describe();

  const setRemote = (patch: Partial<IntelSettings['remote']>) => setS({ ...s, remote: { ...s.remote, ...patch } });
  const save = (next: IntelSettings = s) => { applyIntelSettings(next); setS(structuredClone(next)); flash(next.provider === 'remote-http' ? 'Remote provider selected. Suggestions will go through it from now on.' : 'Local rules selected. Nothing leaves this workstation.'); rerender((n) => n + 1); };

  async function saveToken() {
    const token = await dialogs.prompt('Paste the bearer token issued to you for this provider. It is encrypted with a passphrase you choose and is never exported.', { title: 'Provider token', label: 'Token', password: true, confirmLabel: 'Next' });
    if (!token) return;
    const pass = await dialogs.prompt('Choose a passphrase (8+ characters). You will type it once per browser session to unlock the token.', { title: 'Seal the token', label: 'Passphrase', password: true, minLength: 8, confirmLabel: 'Encrypt & save' });
    if (!pass) return;
    setBusy(true);
    try { const env = await sealToken(token.trim(), pass); const next = { ...s, tokenEnvelope: env }; applyIntelSettings(next); setS(next); flash('Token sealed and unlocked for this session.'); }
    catch (err) { flash(`Could not seal the token: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setBusy(false); }
  }
  async function unlock() {
    if (!s.tokenEnvelope) return;
    const pass = await dialogs.prompt('Enter the passphrase you chose when saving the token.', { title: 'Unlock token', label: 'Passphrase', password: true, confirmLabel: 'Unlock' });
    if (!pass) return;
    setBusy(true);
    const ok = await unlockToken(s.tokenEnvelope, pass);
    setBusy(false);
    flash(ok ? 'Token unlocked for this session.' : 'Wrong passphrase.');
    rerender((n) => n + 1);
  }
  async function forgetToken() {
    if (!(await dialogs.confirm('Remove the stored token? You can paste a new one at any time.', { title: 'Forget token', confirmLabel: 'Forget', danger: true }))) return;
    lockToken();
    const next = { ...s, tokenEnvelope: null };
    applyIntelSettings(next); setS(next); rerender((n) => n + 1);
  }
  async function runTest() {
    setBusy(true); setTest(null);
    // Test the form values, not the saved ones, so a typo is caught before saving.
    try { setTest(await previewProvider(s.remote).ping()); } finally { setBusy(false); }
  }

  return (
    <section id="intelligence" className="space-y-5">
      <SectionIntro eyebrow="PROGRAM / INTELLIGENCE" title="Where suggestions come from.">
        Synapse never needs a model to work. Local rules match keywords in this browser. If your organization runs an authorized AI platform, you can point Synapse at it here; the page tells you exactly what would be sent before anything is.
      </SectionIntro>

      <Panel id="intelProvider">
        <PanelHeading eyebrow="ACTIVE PROVIDER" title={<>{live.label} <Pill tone={live.offline ? 'mint' : 'amber'}>{live.offline ? 'offline' : 'sends data'}</Pill></>}>{live.dataHandling}</PanelHeading>
        <div role="radiogroup" aria-label="Intelligence provider" className="grid gap-3 md:grid-cols-2">
          <label className={`cursor-pointer rounded-md border p-4 ${s.provider === 'local-rules' ? 'border-mint/60 bg-mint/5' : 'border-stroke'}`}>
            <input type="radio" name="intelProvider" value="local-rules" data-provider="local-rules" className="mr-2 accent-mint" checked={s.provider === 'local-rules'} onChange={() => save({ ...s, provider: 'local-rules' })} />
            <strong>Local rules</strong><Pill tone="mint" className="ml-2">default</Pill>
            <p className="note mt-1">Deterministic keyword and certification matching. Works offline, nothing is sent anywhere, results are explainable.</p>
          </label>
          <label className={`cursor-pointer rounded-md border p-4 ${s.provider === 'remote-http' ? 'border-amber/60 bg-amber/5' : 'border-stroke'} ${!remoteReady ? 'opacity-70' : ''}`}>
            <input type="radio" name="intelProvider" value="remote-http" data-provider="remote-http" className="mr-2 accent-mint" disabled={!remoteReady} checked={s.provider === 'remote-http'} onChange={() => save({ ...s, provider: 'remote-http' })} />
            <strong>Remote provider</strong>{!remoteReady && <Pill className="ml-2">configure below first</Pill>}
            <p className="note mt-1">A model hosted on a platform your organization has authorized (for example an IL5-accredited enterprise AI service). Synapse speaks a small JSON contract; the platform team implements it.</p>
          </label>
        </div>
      </Panel>

      <Panel id="intelRemote">
        <PanelHeading eyebrow="REMOTE PROVIDER" title="Connection">Settings here are stored in this browser. The token is encrypted with a passphrase and is never part of any export or backup.</PanelHeading>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Display name" htmlFor="intelLabel"><Input id="intelLabel" value={s.remote.label} onChange={(v) => setRemote({ label: v })} placeholder="e.g. Enterprise AI (accredited)" maxLength={80} /></Field>
          <Field label="Model / deployment (optional)" htmlFor="intelModel"><Input id="intelModel" value={s.remote.model ?? ''} onChange={(v) => setRemote({ model: v })} placeholder="forwarded verbatim" maxLength={120} /></Field>
          <div className="md:col-span-2">
            <Field label="Endpoint (HTTPS, accepts POST)" htmlFor="intelEndpoint" hint={endpointError ?? undefined}>
              <Input id="intelEndpoint" value={s.remote.endpoint} onChange={(v) => setRemote({ endpoint: v.trim() })} placeholder="https://ai.example.mil/synapse/v1" maxLength={500} />
            </Field>
            {remoteReady && !hostAllowed && (
              <Notice tone="warn" className="mt-2">
                <b>This build does not allow connections to that host.</b> Synapse ships with a Content-Security-Policy that blocks every origin except its own; the browser will refuse the request no matter what is configured here. To allow it, rebuild with <code>SYNAPSE_INTEL_HOST={new URL(s.remote.endpoint).origin}</code> (see LOCAL-DEV.md). {ALLOWED_INTEL_HOSTS.length ? <>Allowed by this build: {ALLOWED_INTEL_HOSTS.join(', ')}.</> : 'This build allows no remote hosts.'}
              </Notice>
            )}
          </div>
          <div className="md:col-span-2">
            <Field label="What users are told (optional; replaces the default disclosure)" htmlFor="intelDisclosure">
              <Textarea id="intelDisclosure" value={s.remote.dataHandling ?? ''} onChange={(v) => setRemote({ dataHandling: v })} rows={2} maxLength={600} placeholder="e.g. Processed inside the accredited enclave; retained 0 days; approved for PII under ATO #…" />
            </Field>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button id="intelSave" variant="primary" disabled={!!endpointError} onClick={() => save()}>Save connection</Button>
          <Button id="intelTest" disabled={!remoteReady || busy} onClick={runTest}>{busy ? 'Testing…' : 'Test connection'}</Button>
          <span className="mx-1 h-5 border-l border-stroke" aria-hidden="true" />
          {s.tokenEnvelope ? (
            <>
              <Pill tone={tokenUnlocked() ? 'mint' : 'amber'}>{tokenUnlocked() ? 'token unlocked' : 'token sealed'}</Pill>
              {!tokenUnlocked() && <Button id="intelUnlock" size="sm" onClick={unlock} disabled={busy}>Unlock for this session</Button>}
              <Button id="intelReplaceToken" size="sm" onClick={saveToken} disabled={busy}>Replace token</Button>
              <Button id="intelForgetToken" size="sm" variant="danger" onClick={forgetToken} disabled={busy}>Forget token</Button>
            </>
          ) : <Button id="intelSaveToken" size="sm" onClick={saveToken} disabled={busy}>Add bearer token…</Button>}
        </div>
        {test && <p id="intelTestResult" role="status" className={`mt-3 rounded-md border px-3 py-2 text-[13px] ${test.ok ? 'border-mint/50 text-mint' : 'border-danger/50 text-danger'}`}>{test.ok ? '✓ ' : '✕ '}{test.detail}</p>}
      </Panel>

      <Panel id="intelDisclosurePanel">
        <PanelHeading eyebrow="WHAT LEAVES THIS WORKSTATION" title="Per task, with the remote provider selected">Local rules send nothing for any task. The same table is shown on Trust &amp; data.</PanelHeading>
        <DataLeavesTable />
      </Panel>
    </section>
  );
}

export function DataLeavesTable() {
  const rows: Array<[string, string, string]> = [
    ['Résumé scan', 'The text you pasted or the file you chose (up to 100,000 characters), the ids of skills you already confirmed, and the public taxonomy.', 'Your name, workspace, teammates, confidence answers, credentials: never.'],
    ['Skill mapping (imports, manual add)', 'The free-text skill names being mapped and the public taxonomy.', 'Who typed them.'],
    ['Team brief (supervisor)', TEAM_BRIEF_FIELDS.join('; ') + '.', 'Names, per-person rows, peer cards, org codes, anything about an individual.'],
    ['Connection test', 'A ping with no user content.', 'Everything.'],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" id="intelDataTable">
        <thead><tr className="text-left text-[11px] uppercase tracking-wider text-quiet"><th className="py-1 pr-3">Task</th><th className="py-1 pr-3">Sent</th><th className="py-1">Never sent</th></tr></thead>
        <tbody>{rows.map(([t, sent, never]) => <tr key={t} className="border-t border-stroke align-top"><td className="py-2 pr-3 font-bold">{t}</td><td className="py-2 pr-3 text-muted">{sent}</td><td className="py-2 text-muted">{never}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
