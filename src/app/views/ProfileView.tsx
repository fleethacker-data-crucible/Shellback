import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { SAMPLE_RESUME, SKILL_BY_ID } from '../../core/taxonomy';
import { PERSONAS } from '../../core/personas';
import { parseWorkspace } from '../../core/schema';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import { applyScan, clearProfile, confirmSkill, dismissSkillCandidate, loadSyntheticProfile, pendingCredentialCandidates, removeSkill, setConsent, setOrg } from '../state/actions';
import { orgAncestors, orgLevelName } from '../../core/org';
import { ContributionCard } from '../components/ContributionCard';
import { scanResume, scanRunsInWorker } from '../../storage/scan-client';
import type { ProfileTab } from '../../storage/settings';
import { useDialogs } from '../components/ui/dialogs';
import { Button, Checkbox, Empty, Field, Input, Panel, PanelHeading, Pill, Select, SectionIntro, Switch, Tabs, Textarea } from '../components/ui/primitives';
import { StatusChip } from '../components/SkillActions';
import { SKILL_OPTIONS, modeLabel } from '../lib/options';
import { readFileText } from '../lib/files';
import { CredentialsView } from './CredentialsView';
import { GrowthPanel } from './WorkforcePanels';

export function ProfileView() {
  const { ws, settings, navigate } = useStore();
  const tab = settings.profileTab;
  const pending = ws.profile.candidates.length;
  const pendingCreds = pendingCredentialCandidates(ws).length;
  const rated = ws.profile.confirmed.filter((id) => ws.profile.surveys[id]).length;
  // Résumé text lives here so it survives switching tabs (it is never persisted).
  const [resume, setResume] = useState('');

  return (
    <section id="profile" className="space-y-5">
      <SectionIntro eyebrow="YOUR WORKSPACE · EMPLOYEE OWNED" title="My capability profile.">
        Everything here is yours: suggestions stay suggestions until you confirm them, and confidence is optional.
      </SectionIntro>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<ProfileTab> label="Profile sections" value={tab} onChange={(t) => navigate({ view: 'profile', tab: t })} items={[
          { id: 'intake', label: pending ? `1 · Intake (${pending} to review)` : '1 · Intake', testId: 'tab-intake' },
          { id: 'skills', label: `2 · Skills (${ws.profile.confirmed.length})`, testId: 'tab-skills' },
          { id: 'credentials', label: pendingCreds ? `3 · Credentials (${pendingCreds} to review)` : '3 · Credentials', testId: 'tab-credentials' },
          { id: 'growth', label: '4 · Growth', testId: 'tab-growth' },
        ]} />
        <div className="flex flex-wrap gap-4 text-[12px] text-muted">
          <span><b id="profileCount" className="text-text">{ws.profile.confirmed.length}</b> confirmed</span>
          <span><b id="surveyCount" className="text-text">{rated}</b> rated</span>
          <span>Sharing <b id="sharingState" className="text-text">{ws.profile.consent ? 'ON' : 'OFF'}</b></span>
        </div>
      </div>
      {tab === 'intake' && <IntakeTab resume={resume} setResume={setResume} />}
      {tab === 'skills' && <SkillsTab />}
      {tab === 'credentials' && <CredentialsView embedded />}
      {tab === 'growth' && <GrowthPanel />}
    </section>
  );
}

// ---------------------------------------------------------------------------- 1 · Intake
function IntakeTab({ resume, setResume }: { resume: string; setResume: (v: string) => void }) {
  const { ws, navigate, flash, replace } = useStore();
  const act = useAction();
  const dialogs = useDialogs();
  const [scanning, setScanning] = useState(false);
  const [persona, setPersona] = useState(ws.profile.demoPersona && PERSONAS.some((p) => p.id === ws.profile.demoPersona) ? ws.profile.demoPersona : '');
  const pendingCreds = pendingCredentialCandidates(ws).length;

  async function runScanOn(text: string) {
    if (!text.trim()) { flash('Paste selected experience or load the synthetic example first.'); return; }
    setScanning(true);
    try {
      const result = await scanResume({ text, confirmed: ws.profile.confirmed });
      act((d) => applyScan(d, result));
    } catch (err) {
      flash(`The résumé could not be scanned: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setScanning(false); }
  }
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/\.txt$/i.test(f.name)) { flash('Please select a plain-text .txt file under 500 KB.'); return; }
    try {
      const text = (await readFileText(f, 512_000)).slice(0, 100_000);
      setResume(text);
      await runScanOn(text);
    } catch (err) { flash(err instanceof Error ? err.message : 'Could not read that file.'); }
  }
  async function loadPersona() {
    const p = PERSONAS.find((x) => x.id === persona);
    if (!p) { flash('Choose a fictional employee.'); return; }
    if (!(await dialogs.confirm(<>Replace the current local workspace with <b>{p.name}</b> (fictional)? Export your current profile first if you need it.</>, { title: 'Load fictional profile', confirmLabel: 'Replace workspace', danger: true }))) return;
    const parsed = parseWorkspace(p.workspace);
    parsed.workspace.profile.shareId = parsed.workspace.profile.shareId || ws.profile.shareId;
    replace(parsed.workspace, `Loaded fictional ${p.role} profile.`);
    navigate({ view: 'explore', tab: 'web' });
  }
  async function loadSynthetic() {
    const hasData = ws.profile.confirmed.length || Object.keys(ws.profile.surveys).length || ws.profile.credentials.length;
    if (hasData && !(await dialogs.confirm('Replace the local profile with fully fictional demonstration data? Export first if needed.', { confirmLabel: 'Replace profile', danger: true }))) return;
    act(loadSyntheticProfile);
    navigate({ view: 'explore', tab: 'web' });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel>
        <PanelHeading eyebrow="ADD EXPERIENCE" title="Scan a résumé">Synapse looks for skill and certification names locally{scanRunsInWorker() ? ' in a background worker' : ''}. The text is never stored, only the suggestions you then review.</PanelHeading>
        <Field label="Upload a plain-text résumé (.txt)" htmlFor="resumeFile">
          <input id="resumeFile" type="file" accept=".txt,text/plain" className="control file:mr-3 file:rounded-sm file:border-0 file:bg-panel2 file:px-3 file:py-1 file:text-[12px] file:font-bold file:text-text" onChange={onFile} />
        </Field>
        <Field label="Or paste selected experience" htmlFor="resumeText">
          <Textarea id="resumeText" rows={7} value={resume} onChange={setResume} placeholder="Designed AWS infrastructure, wrote SQL pipelines, used Power BI ..." />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button id="scanResume" variant="primary" disabled={scanning} onClick={() => runScanOn(resume)}>{scanning ? 'Scanning…' : 'Find skill suggestions'}</Button>
          <Button id="loadResumeSample" onClick={() => { setResume(SAMPLE_RESUME); void runScanOn(SAMPLE_RESUME); }}>Use synthetic résumé</Button>
        </div>
        <details className="mt-5 rounded-md border border-stroke bg-panel2/40 p-3 text-[13px]" open={!ws.profile.confirmed.length || !!ws.profile.demoPersona}>
          <summary className="cursor-pointer font-bold">Just exploring? Use fictional data</summary>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Fictional employee" htmlFor="demoPersona">
              <Select id="demoPersona" className="w-[280px]" value={persona} onChange={setPersona} placeholder="Choose an employee" options={PERSONAS.map((p) => ({ value: p.id, label: `${p.name} · ${p.role}` }))} />
            </Field>
            <Button id="loadPersona" onClick={loadPersona}>Load</Button>
            <Button id="loadDemoProfile" variant="ghost" onClick={loadSynthetic}>Generic synthetic profile</Button>
          </div>
          <p id="demoPersonaState" aria-live="polite" className="note mt-2">
            {ws.profile.demoPersona && ws.profile.displayName ? `Viewing fictional profile: ${ws.profile.displayName}. This is a local demo, not a signed-in user.` : "Viewing this browser's local profile. No authenticated account is active."}
          </p>
        </details>
      </Panel>

      <Panel>
        <PanelHeading eyebrow="REVIEW" title={ws.profile.candidates.length ? `${ws.profile.candidates.length} suggestion${ws.profile.candidates.length === 1 ? '' : 's'} waiting for you` : 'Suggestions'}>
          A suggestion is a keyword match, not evidence. Confirm what's true for you; dismiss the rest. Dismissed suggestions won't come back on later scans.
        </PanelHeading>
        <div id="candidateBox" className="space-y-1.5">
          {ws.profile.candidates.length ? ws.profile.candidates.map((id) => { const s = SKILL_BY_ID.get(id)!; return (
            <div key={id} className="row-card border-amber/40">
              <span className="min-w-0"><strong className="block text-[13px]">{s.name}</strong><small className="text-quiet">{s.domain}</small></span>
              <span className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="primary" data-confirm={id} onClick={() => act((d) => confirmSkill(d, id))}>Confirm</Button>
                <Button size="sm" variant="ghost" data-dismiss={id} aria-label={`Dismiss ${s.name}`} onClick={() => act((d) => dismissSkillCandidate(d, id))}>Dismiss</Button>
              </span>
            </div>
          ); }) : <Empty>{ws.profile.lastScan ? 'All suggestions reviewed. Scan more text, or add skills manually in the Skills tab.' : 'Scan a résumé to see suggestions here.'}</Empty>}
        </div>
        {ws.profile.candidateDismissed.length > 0 && (
          <p className="note mt-2">{ws.profile.candidateDismissed.length} dismissed suggestion{ws.profile.candidateDismissed.length === 1 ? '' : 's'} hidden from future scans. <button type="button" className="text-mint underline" onClick={() => act((d) => { d.profile.candidateDismissed = []; return 'Dismissed suggestions will be offered again on the next scan.'; })}>Reset</button></p>
        )}
        <div id="credentialScanSummary" aria-live="polite" className="mt-4 rounded-md border border-stroke bg-panel2/50 p-3 text-[13px]">
          {pendingCreds ? (
            <div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{pendingCreds} possible certification{pendingCreds === 1 ? '' : 's'} found</strong><br /><span className="text-muted">Not in your inventory until you approve each one.</span></span><Button id="openCredentialSuggestions" size="sm" onClick={() => navigate({ view: 'profile', tab: 'credentials' })}>Review credentials ↗</Button></div>
          ) : <span className="text-muted">Certification names are checked during the same scan. A match never proves you hold one.</span>}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------- 2 · Skills
function SkillsTab() {
  const { ws, flash, update, intent, consumeIntent, openPulse } = useStore();
  const act = useAction();
  const dialogs = useDialogs();
  const [manual, setManual] = useState('');
  const manualRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (intent?.type === 'manual-add') { setManual(intent.skillId); consumeIntent(); setTimeout(() => manualRef.current?.focus(), 0); }
  }, [intent, consumeIntent]);

  async function clear() {
    if (!(await dialogs.confirm('Clear your confirmed skills, surveys, and credentials? This cannot be undone without a backup.', { title: 'Clear my profile', confirmLabel: 'Clear profile', danger: true }))) return;
    act(clearProfile);
  }

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeading eyebrow="CONFIRMED" title="My confirmed skills" action={<Button id="clearMyData" variant="danger" size="sm" onClick={clear}>Clear my profile</Button>}>
          These are the skills you attest to. They build your web and galaxy. Rate confidence whenever you like; it only changes how brightly a skill shines.
        </PanelHeading>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Add any skill manually" htmlFor="manualSkill">
            <select ref={manualRef} id="manualSkill" className="control w-[320px]" value={manual} onChange={(e: ChangeEvent<HTMLSelectElement>) => setManual(e.target.value)}>
              <option value="">Select a skill</option>
              {SKILL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Button id="manualAdd" onClick={() => { if (!manual) { flash('Choose a skill to add.'); return; } if (act((d) => confirmSkill(d, manual)) !== undefined) setManual(''); }}>Add skill</Button>
          {ws.profile.confirmed.some((id) => !ws.profile.surveys[id]) && <Button id="openPulseFromProfile" variant="primary" onClick={() => openPulse()}>Rate unrated skills</Button>}
        </div>
        <div id="mySkills" className="mt-4 grid gap-2 md:grid-cols-2">
          {ws.profile.confirmed.length ? ws.profile.confirmed.map((id) => {
            const s = SKILL_BY_ID.get(id); if (!s) return null;
            const v = ws.profile.surveys[id];
            return (
              <div key={id} className="row-card">
                <div className="min-w-0">
                  <strong className="block text-[13px]">{s.name}</strong>
                  <small className="block text-quiet">{s.domain}</small>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5"><StatusChip status="confirmed" rated={!!v} />{v && <small className="text-muted">{v.confidence}/4 · {modeLabel(v.method)}</small>}</span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant={v ? 'secondary' : 'primary'} data-pulse-skill={id} onClick={() => openPulse(id)}>{v ? 'Update' : 'Rate'}</Button>
                  <Button size="icon" variant="danger" data-remove={id} aria-label={`Remove ${s.name}`} onClick={() => act((d) => removeSkill(d, id))}>✕</Button>
                </div>
              </div>
            );
          }) : <Empty>No skills confirmed yet. Review suggestions in Intake, or add one above.</Empty>}
        </div>
      </Panel>

      <OrgCard />
      <ContributionCard />

      <Panel>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <PanelHeading eyebrow="CONSENT" title="Contribute to team tools in this browser">
              Off by default. On adds <b>your confirmed skill list only</b> to the local team views (groups of 3 or more). Confidence, notes and résumé text are never included.
            </PanelHeading>
            <div className="space-y-1">
              <Checkbox id="shareMentoringLocally" checked={ws.profile.shareMentoringLocally} onChange={(v) => update((d) => { d.profile.shareMentoringLocally = v; })}>Also let local <b>mentor discovery</b> see my mentoring offer, topics and availability.</Checkbox>
              <Checkbox id="shareCredentialsLocally" checked={ws.profile.shareCredentialsLocally} onChange={(v) => update((d) => { d.profile.shareCredentialsLocally = v; })}>Also let local <b>mission planning</b> see my self-entered credential names (unverified).</Checkbox>
              <Checkbox id="shareOrgLocally" checked={ws.profile.shareOrgLocally} onChange={(v) => update((d) => { d.profile.shareOrgLocally = v; })}>Also include my <b>org code and title</b> so coverage can roll up by unit.</Checkbox>
              <Checkbox id="shareContributionLocally" checked={ws.profile.shareContributionLocally} onChange={(v) => update((d) => { d.profile.shareContributionLocally = v; })}>Also include my <b>contribution preferences</b> in the team's stage map.</Checkbox>
            </div>
          </div>
          <label className="toggle"><Switch id="shareToggle" checked={ws.profile.consent} onChange={(v) => act((d) => setConsent(d, v))} label="Contribute to team tools in this browser" /></label>
        </div>
        {ws.profile.candidates.length > 0 && <p className="note mt-3"><Pill tone="amber">{ws.profile.candidates.length} suggestions</Pill> are still waiting in Intake and are never shared.</p>}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------- Org code
function OrgCard() {
  const { ws, update } = useStore();
  const [code, setCode] = useState(ws.profile.orgCode);
  const [title, setTitle] = useState(ws.profile.orgTitle);
  useEffect(() => { setCode(ws.profile.orgCode); setTitle(ws.profile.orgTitle); }, [ws.profile.orgCode, ws.profile.orgTitle]);
  const dirty = code !== ws.profile.orgCode || title !== ws.profile.orgTitle;
  const chain = ws.profile.orgCode ? [...orgAncestors(ws.profile.orgCode).reverse(), ws.profile.orgCode] : [];
  return (
    <Panel id="orgCard">
      <PanelHeading eyebrow="WHERE I SIT" title="Organization code">
        Optional. Codes nest by prefix (1500 → 1510 → 1513 → 1513.1), so Synapse can roll team coverage up through departments, divisions and branches without a fixed org chart.
      </PanelHeading>
      <div className="grid gap-3 md:grid-cols-[200px_1fr_auto] md:items-end">
        <Field label="My code" htmlFor="orgCode"><Input id="orgCode" value={code} onChange={setCode} maxLength={24} placeholder="e.g. 1513" /></Field>
        <Field label="Title (optional)" htmlFor="orgTitle"><Input id="orgTitle" value={title} onChange={setTitle} maxLength={80} placeholder="e.g. Branch Head, Engineer" /></Field>
        <Button id="orgSave" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} onClick={() => update((d) => { setOrg(d, code, title); return 'Organization code saved.'; })}>Save</Button>
      </div>
      {chain.length > 0 && (
        <p id="orgChain" className="note mt-3">
          {chain.map((c, i) => <span key={c}>{i > 0 && <span className="mx-1 text-quiet">›</span>}<Pill tone={i === chain.length - 1 ? 'mint' : 'neutral'}>{orgLevelName(c)} {c}</Pill></span>)}
          {ws.profile.orgTitle && <span className="ml-2 text-muted">· {ws.profile.orgTitle}</span>}
        </p>
      )}
    </Panel>
  );
}
