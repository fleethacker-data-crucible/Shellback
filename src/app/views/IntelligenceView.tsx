/**
 * Program → Intelligence. Choose where suggestions come from.
 * Local rules is the default and needs nothing. A remote provider is set up in four visible steps —
 * where, which key, which model, does it work — and the page says exactly what would leave this
 * workstation before anything can be sent.
 */
import { useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { EvaluationPanel } from './EvaluationPanel';
import { useDialogs } from '../components/ui/dialogs';
import { Button, Field, Input, Notice, Panel, PanelHeading, Pill, SectionIntro, Select, Textarea } from '../components/ui/primitives';
import { REMOTE_KIND_LABEL, TEAM_BRIEF_FIELDS, validateEndpoint, type RemoteKind } from '../../core/intelligence';
import { ALLOWED_INTEL_HOSTS, activeProvider, applyIntelSettings, currentIntelSettings, isHostAllowed, lockToken, previewProvider, sealToken, tokenUnlocked, unlockToken, type IntelSettings } from '../../storage/intel-settings';

export function IntelligenceView() {
  const { flash } = useStore();
  const dialogs = useDialogs();
  const [s, setS] = useState<IntelSettings>(() => structuredClone(currentIntelSettings()));
  const [, rerender] = useState(0);
  const [test, setTest] = useState<{ ok: boolean; detail: string } | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelsError, setModelsError] = useState('');
  const [busy, setBusy] = useState<'' | 'models' | 'test' | 'token'>('');
  const kind: RemoteKind = s.remote.kind ?? 'openai';
  const endpointError = s.remote.endpoint ? validateEndpoint(s.remote.endpoint) : null;
  const endpointOk = !!s.remote.endpoint && !endpointError;
  const hostAllowed = endpointOk && isHostAllowed(s.remote.endpoint);
  const keyReady = !!s.tokenEnvelope && tokenUnlocked();
  const modelReady = kind === 'synapse' || !!s.remote.model;
  const remoteReady = endpointOk && modelReady && (kind === 'synapse' || !!s.tokenEnvelope);
  const live = activeProvider().describe();
  const saved = currentIntelSettings();
  const dirty = JSON.stringify(saved.remote) !== JSON.stringify(s.remote);

  const setRemote = (patch: Partial<IntelSettings['remote']>) => { setS({ ...s, remote: { ...s.remote, ...patch } }); setTest(null); };
  const persist = (next: IntelSettings, msg?: string) => { applyIntelSettings(next); setS(structuredClone(next)); if (msg) flash(msg); rerender((n) => n + 1); };
  const saveConnection = () => persist(s, 'Connection saved.');
  const useProvider = (p: IntelSettings['provider']) => persist({ ...s, provider: p }, p === 'remote-http' ? `${s.remote.label || 'Remote provider'} selected. Suggestions will go through it from now on.` : 'Local rules selected. Nothing leaves this workstation.');

  async function addKey() {
    const token = await dialogs.prompt(kind === 'openai' ? 'Paste the API key for this gateway. Next you will choose a passphrase that encrypts it on this computer; the key is unlocked only in this browser session and never exported.' : 'Paste the bearer token for this endpoint. Next you will choose a passphrase that encrypts it; it is never exported.', { title: kind === 'openai' ? 'Step 1 of 2: API key' : 'Step 1 of 2: bearer token', label: kind === 'openai' ? 'API key' : 'Token', password: true, confirmLabel: 'Next: choose a passphrase' });
    if (!token) return;
    const pass = await dialogs.prompt(<>Key received. Now choose a <b>passphrase</b> (8+ characters) — not another token — that Shellback uses to encrypt the key on this computer. You will type it once per browser session to unlock the key.</>, { title: 'Step 2 of 2: protect the key with a passphrase', label: 'Passphrase (your choice)', password: true, minLength: 8, confirmLabel: 'Encrypt & save' });
    if (!pass) return;
    setBusy('token');
    try {
      const env = await sealToken(token.trim(), pass);
      persist({ ...s, tokenEnvelope: env }, 'Key sealed and unlocked for this session.');
      if (kind === 'openai' && endpointOk) void loadModels({ ...s, tokenEnvelope: env });
    }
    catch (err) { flash(`Could not seal the key: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setBusy(''); }
  }
  async function unlock() {
    if (!s.tokenEnvelope) return;
    const pass = await dialogs.prompt('Enter the passphrase you chose when saving the key.', { title: 'Unlock key', label: 'Passphrase', password: true, confirmLabel: 'Unlock' });
    if (!pass) return;
    setBusy('token');
    const ok = await unlockToken(s.tokenEnvelope, pass);
    setBusy('');
    flash(ok ? 'Key unlocked for this session.' : 'Wrong passphrase.');
    rerender((n) => n + 1);
  }
  async function forgetKey() {
    if (!(await dialogs.confirm('Remove the stored key? You can paste a new one at any time.', { title: 'Forget key', confirmLabel: 'Forget', danger: true }))) return;
    lockToken();
    persist({ ...s, tokenEnvelope: null, provider: 'local-rules' }, 'Key removed. Local rules are active.');
    setModels(null);
  }
  async function loadModels(from: IntelSettings = s) {
    setBusy('models'); setModelsError(''); setModels(null);
    try {
      const list = await previewProvider(from.remote).listModels!();
      setModels(list);
      if (!list.length) setModelsError('The gateway returned no models for this key.');
      else if (!from.remote.model || !list.includes(from.remote.model)) setS((cur) => ({ ...cur, remote: { ...cur.remote, model: list[0] } }));
    } catch (err) { setModelsError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(''); }
  }
  async function runTest() {
    setBusy('test'); setTest(null);
    try { setTest(await previewProvider(s.remote).ping()); } finally { setBusy(''); }
  }

  return (
    <section id="intelligence" className="space-y-5">
      <SectionIntro eyebrow="PROGRAM / INTELLIGENCE" title="Where suggestions come from.">
        Shellback never needs a model to work. Local rules match keywords in this browser. If your organization runs an authorized AI gateway, set it up below in four steps; the page tells you exactly what would be sent before anything is.
      </SectionIntro>

      <Panel id="intelProvider">
        <PanelHeading eyebrow="ACTIVE PROVIDER" title={<>{live.label} <Pill tone={live.offline ? 'mint' : 'amber'}>{live.offline ? 'offline' : 'sends data'}</Pill></>}>{live.dataHandling}</PanelHeading>
        <div role="radiogroup" aria-label="Intelligence provider" className="grid gap-3 md:grid-cols-2">
          <label className={`cursor-pointer rounded-md border p-4 ${s.provider === 'local-rules' ? 'border-mint/60 bg-mint/5' : 'border-stroke'}`}>
            <input type="radio" name="intelProvider" value="local-rules" data-provider="local-rules" className="mr-2 accent-mint" checked={s.provider === 'local-rules'} onChange={() => useProvider('local-rules')} />
            <strong>Local rules</strong><Pill tone="mint" className="ml-2">default</Pill>
            <p className="note mt-1">Deterministic keyword and certification matching. Works offline, nothing is sent anywhere, results are explainable.</p>
          </label>
          <label className={`cursor-pointer rounded-md border p-4 ${s.provider === 'remote-http' ? 'border-amber/60 bg-amber/5' : 'border-stroke'} ${!remoteReady ? 'opacity-70' : ''}`}>
            <input type="radio" name="intelProvider" value="remote-http" data-provider="remote-http" className="mr-2 accent-mint" disabled={!remoteReady || dirty} checked={s.provider === 'remote-http'} onChange={() => useProvider('remote-http')} />
            <strong>{s.remote.label || 'Remote provider'}</strong>{!remoteReady ? <Pill className="ml-2">{!endpointOk ? 'step 1: enter the endpoint' : kind === 'openai' && !s.tokenEnvelope ? 'step 2: add the API key' : !modelReady ? 'step 3: choose a model' : 'finish the steps below'}</Pill> : dirty ? <Pill className="ml-2">step 4: save, then select</Pill> : null}
            <p className="note mt-1">An AI gateway your organization has authorized (for example a service accredited for your data). You choose the model; Shellback sends only what the table at the bottom lists.</p>
          </label>
        </div>
      </Panel>

      <Panel id="intelRemote">
        <PanelHeading eyebrow="REMOTE PROVIDER" title="Set up in four steps" action={<Button id="intelSave" variant="primary" size="sm" disabled={!!endpointError || !dirty} onClick={saveConnection}>{dirty ? 'Save connection' : 'Saved'}</Button>}>
          Settings are stored in this browser. The key is encrypted with a passphrase and is never part of any export or backup.
        </PanelHeading>
        <div className="space-y-5">
          <Step n={1} title="Where is it?" done={endpointOk}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Field label="Kind of endpoint" htmlFor="intelKind">
                <Select id="intelKind" value={kind} onChange={(v) => { setRemote({ kind: v as RemoteKind, model: '' }); setModels(null); }} options={(Object.keys(REMOTE_KIND_LABEL) as RemoteKind[]).map((k) => ({ value: k, label: REMOTE_KIND_LABEL[k] }))} />
              </Field>
              <Field label="Display name" htmlFor="intelLabel"><Input id="intelLabel" value={s.remote.label} onChange={(v) => setRemote({ label: v })} placeholder="e.g. AI endpoint (accredited)" maxLength={80} /></Field>
            </div>
            <Field label={kind === 'openai' ? 'API base URL (usually ends in /v1)' : 'Endpoint URL (accepts the Shellback contract POST)'} htmlFor="intelEndpoint" hint={endpointError ?? (kind === 'openai' ? 'Shellback will call <base>/models and <base>/chat/completions.' : 'See docs/INTELLIGENCE_PROVIDERS.md for the contract.')}>
              <Input id="intelEndpoint" value={s.remote.endpoint} onChange={(v) => { setRemote({ endpoint: v.trim() }); setModels(null); }} placeholder={kind === 'openai' ? 'https://ai.example.com/v1' : 'https://ai.example.com/shellback'} maxLength={500} />
            </Field>
            {endpointOk && !hostAllowed && (
              <Notice tone="warn" className="mt-2">
                <b>This build does not allow connections to that host.</b> Shellback ships with a Content-Security-Policy that blocks every origin except its own, so the browser will refuse the request no matter what is configured here. Rebuild with <code>SHELLBACK_INTEL_HOST={new URL(s.remote.endpoint).origin}</code> (<code>npm run build:intel</code>), or run the loopback adapter on <code>http://127.0.0.1:8790</code> — see LOCAL-DEV.md. {ALLOWED_INTEL_HOSTS.length ? <>Allowed by this build: {ALLOWED_INTEL_HOSTS.join(', ')}.</> : 'This build allows no remote hosts.'}
              </Notice>
            )}
          </Step>

          <Step n={2} title={kind === 'openai' ? 'Which key?' : 'Which token? (optional if the endpoint needs none)'} done={!!s.tokenEnvelope}>
            <div className="flex flex-wrap items-center gap-2">
              {s.tokenEnvelope ? (
                <>
                  <Pill tone={tokenUnlocked() ? 'mint' : 'amber'}>{tokenUnlocked() ? 'key unlocked for this session' : 'key sealed · locked'}</Pill>
                  {!tokenUnlocked() && <Button id="intelUnlock" size="sm" onClick={unlock} disabled={!!busy}>Unlock…</Button>}
                  <Button id="intelReplaceToken" size="sm" onClick={addKey} disabled={!!busy}>Replace key…</Button>
                  <Button id="intelForgetToken" size="sm" variant="danger" onClick={forgetKey} disabled={!!busy}>Forget key</Button>
                </>
              ) : <Button id="intelSaveToken" size="sm" variant="primary" onClick={addKey} disabled={!!busy}>{kind === 'openai' ? 'Add API key…' : 'Add bearer token…'}</Button>}
              <span className="note">Encrypted at rest with your passphrase; decrypted into memory only while this tab is open.</span>
            </div>
          </Step>

          <Step n={3} title="Which model?" done={modelReady}>
            {kind === 'synapse' ? (
              <Field label="Model / deployment (optional, forwarded verbatim)" htmlFor="intelModel"><Input id="intelModel" value={s.remote.model ?? ''} onChange={(v) => setRemote({ model: v })} maxLength={120} placeholder="leave blank to let the endpoint decide" /></Field>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <Button id="intelLoadModels" size="sm" onClick={() => loadModels()} disabled={!endpointOk || !keyReady || busy === 'models'}>{busy === 'models' ? 'Loading…' : 'Load models'}</Button>
                  {models && models.length > 0 && (
                    <Field label={`Model (${models.length} available)`} htmlFor="intelModelSelect">
                      <Select id="intelModelSelect" className="w-[320px]" value={models.includes(s.remote.model ?? '') ? s.remote.model! : ''} onChange={(v) => setRemote({ model: v })} options={models.map((m) => ({ value: m, label: m }))} placeholder="Choose a model" />
                    </Field>
                  )}
                  <Field label="…or type it" htmlFor="intelModel"><Input id="intelModel" className="w-[260px]" value={s.remote.model ?? ''} onChange={(v) => setRemote({ model: v })} maxLength={120} placeholder="model or deployment name" /></Field>
                </div>
                {!keyReady && <p className="note mt-1">Add and unlock the key first; listing models needs it.</p>}
                {modelsError && <p id="intelModelsError" role="alert" className="mt-1 text-[12px] text-danger">{modelsError}</p>}
              </>
            )}
          </Step>

          <Step n={4} title="Does it work?" done={!!test?.ok}>
            <div className="flex flex-wrap items-center gap-2">
              <Button id="intelTest" size="sm" disabled={!endpointOk || busy === 'test' || (kind === 'openai' && !keyReady)} onClick={runTest}>{busy === 'test' ? 'Testing…' : 'Test connection'}</Button>
              {test && <span id="intelTestResult" role="status" className={`rounded-md border px-3 py-1 text-[13px] ${test.ok ? 'border-mint/50 text-mint' : 'border-danger/50 text-danger'}`}>{test.ok ? '✓ ' : '✕ '}{test.detail}</span>}
            </div>
            {remoteReady && !dirty && s.provider !== 'remote-http' && <p className="note mt-2">Ready. Select <b>{s.remote.label || 'Remote provider'}</b> at the top of the page to start using it.</p>}
            {dirty && <p className="note mt-2">Unsaved changes — <b>Save connection</b> (top right) before selecting the provider.</p>}
          </Step>
        </div>

        <details className="mt-5 rounded-md border border-stroke bg-panel2/40 p-3 text-[13px]">
          <summary className="cursor-pointer font-bold">Advanced: data-handling notice shown to employees</summary>
          <p className="note mt-2">Wherever a remote provider is used (résumé intake, team brief, Trust &amp; data) employees see a one-sentence notice about where their text goes. The default is generated from the host and model. If your platform has an approved statement — retention period, ATO, PII approval — paste it here and it replaces the default, verbatim.</p>
          <Textarea id="intelDisclosure" className="mt-2" value={s.remote.dataHandling ?? ''} onChange={(v) => setRemote({ dataHandling: v })} rows={2} maxLength={600} placeholder="e.g. Processed inside the accredited enclave; retained 0 days; approved for PII under ATO #…" />
        </details>
      </Panel>

      <Panel id="intelDisclosurePanel">
        <PanelHeading eyebrow="WHAT LEAVES THIS WORKSTATION" title="Per task, with the remote provider selected">Local rules send nothing for any task. The same table is shown on Trust &amp; data.</PanelHeading>
        <DataLeavesTable />
      </Panel>

      <EvaluationPanel />
    </section>
  );
}

/** Hoisted so typing inside a step never remounts the inputs. */
function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[auto_1fr] md:gap-4" data-step={n} data-done={done}>
      <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-extrabold ${done ? 'border-mint/60 bg-mint/15 text-mint' : 'border-stroke text-quiet'}`}>{done ? '✓' : n}</div>
      <div><strong className="block text-[13px]">{title}</strong><div className="mt-1">{children}</div></div>
    </div>
  );
}

export function DataLeavesTable() {
  const rows: Array<[string, string, string]> = [
    ['Résumé scan', 'The text you pasted or the file you chose (up to 100,000 characters), the ids of skills you already confirmed, and the public taxonomy.', 'Your name, workspace, teammates, confidence answers, credentials: never.'],
    ['Skill mapping (imports, manual add)', 'The free-text skill names being mapped and the public taxonomy.', 'Who typed them.'],
    ['Team brief (supervisor)', TEAM_BRIEF_FIELDS.join('; ') + '.', 'Names, per-person rows, peer cards, org codes, anything about an individual.'],
    ['Connection test / Load models', 'A request with no user content.', 'Everything.'],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]" id="intelDataTable">
        <thead><tr className="text-left text-[12px] uppercase tracking-wider text-quiet"><th className="py-1 pr-3">Task</th><th className="py-1 pr-3">Sent</th><th className="py-1">Never sent</th></tr></thead>
        <tbody>{rows.map(([t, sent, never]) => <tr key={t} className="border-t border-stroke align-top"><td className="py-2 pr-3 font-bold">{t}</td><td className="py-2 pr-3 text-muted">{sent}</td><td className="py-2 text-muted">{never}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
