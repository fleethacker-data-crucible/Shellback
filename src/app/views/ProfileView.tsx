import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { SAMPLE_RESUME, SKILL_BY_ID } from '../../core/taxonomy';
import { PERSONAS } from '../../core/personas';
import { parseWorkspace } from '../../core/schema';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import { applyScan, clearProfile, confirmSkill, loadSyntheticProfile, pendingCredentialCandidates, removeSkill, setConsent } from '../state/actions';
import { scanResume, scanRunsInWorker } from '../../storage/scan-client';
import { useDialogs } from '../components/ui/dialogs';
import { Button, Checkbox, Empty, Field, Panel, PanelHeading, Pill, Select, SectionIntro, Stat, Switch, Textarea } from '../components/ui/primitives';
import { SKILL_OPTIONS, modeLabel } from '../lib/options';
import { readFileText } from '../lib/files';

export function ProfileView() {
  const { ws, navigate, flash, replace, update, intent, consumeIntent } = useStore();
  const act = useAction();
  const dialogs = useDialogs();
  const [resume, setResume] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState('');
  const [persona, setPersona] = useState(ws.profile.demoPersona && PERSONAS.some((p) => p.id === ws.profile.demoPersona) ? ws.profile.demoPersona : '');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const manualRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (intent?.type === 'manual-add') { setManual(intent.skillId); consumeIntent(); setTimeout(() => manualRef.current?.focus(), 0); }
    else if (intent?.type === 'credential-review') consumeIntent();
  }, [intent, consumeIntent]);

  const pendingCreds = pendingCredentialCandidates(ws).length;
  const confirmedCount = ws.profile.confirmed.length;
  const surveyCount = Object.keys(ws.profile.surveys).filter((id) => ws.profile.confirmed.includes(id)).length;

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
      flash('Résumé processed locally; review suggested skills in your galaxy and radar.');
    } catch (err) { flash(err instanceof Error ? err.message : 'Could not read that file.'); }
  }
  async function loadPersona() {
    const p = PERSONAS.find((x) => x.id === persona);
    if (!p) { flash('Choose a fictional employee.'); return; }
    if (!(await dialogs.confirm(<>Replace the current local workspace with <b>{p.name}</b> (fictional)? Export your current profile first if you need it.</>, { title: 'Load fictional profile', confirmLabel: 'Replace workspace', danger: true }))) return;
    const parsed = parseWorkspace(p.workspace);
    const keepShareId = ws.profile.shareId;
    parsed.workspace.profile.shareId = parsed.workspace.profile.shareId || keepShareId;
    replace(parsed.workspace, `Loaded fictional ${p.role} profile. The spider web now shows this employee's attested skills.`);
    navigate('radar');
  }
  async function loadSynthetic() {
    const hasData = ws.profile.confirmed.length || Object.keys(ws.profile.surveys).length || ws.profile.credentials.length;
    if (hasData && !(await dialogs.confirm('Replace the local profile with fully fictional demonstration data? Export first if needed.', { confirmLabel: 'Replace profile', danger: true }))) return;
    act(loadSyntheticProfile);
    navigate('radar');
  }
  async function clear() {
    if (!(await dialogs.confirm('Clear your confirmed skills, surveys, and credentials? This cannot be undone without a backup.', { title: 'Clear my profile', confirmLabel: 'Clear profile', danger: true }))) return;
    act(clearProfile);
  }

  return (
    <section id="profile" className="space-y-5">
      <SectionIntro eyebrow="YOUR WORKSPACE / EMPLOYEE OWNED" title="My capability profile.">Draft a profile from relevant experience, confirm suggestions, and submit optional confidence surveys. Nothing is silently inferred as demonstrated proficiency.</SectionIntro>

      <Panel className="flex flex-wrap items-end gap-4">
        <div>
          <Button id="loadDemoProfile" onClick={loadSynthetic}>✦ Populate synthetic example profile</Button>
          <p className="note mt-1">Fictional survey data only. Replaces the current local profile after confirmation.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Try a different fictional employee" htmlFor="demoPersona">
            <Select id="demoPersona" className="w-[300px]" value={persona} onChange={setPersona} placeholder="Choose an employee" options={PERSONAS.map((p) => ({ value: p.id, label: `${p.name} · ${p.role}` }))} />
          </Field>
          <Button id="loadPersona" onClick={loadPersona}>Load fictional profile</Button>
        </div>
        <p id="demoPersonaState" aria-live="polite" className="note w-full">
          {ws.profile.demoPersona && ws.profile.displayName ? `Viewing fictional profile: ${ws.profile.displayName}. This is a local demo, not a signed-in user.` : "Viewing this browser's local profile. No authenticated account is active."}
        </p>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat id="profileCount" label="Confirmed skills" value={confirmedCount} />
        <Stat id="surveyCount" label="Task pulse responses" value={surveyCount} />
        <Stat id="sharingState" label="Sharing" value={ws.profile.consent ? 'ON' : 'OFF'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeading eyebrow="A / EXPERIENCE INTAKE" title="Résumé-assisted onboarding">Upload a résumé to immediately preview amber skill candidates in your radar and galaxy. Confirm each candidate to turn its marker mint. Neither status changes your confidence rating.</PanelHeading>
          <Field label="Upload a plain-text résumé (.txt; processed immediately)" htmlFor="resumeFile">
            <input ref={fileRef} id="resumeFile" type="file" accept=".txt,text/plain" className="control file:mr-3 file:rounded-sm file:border-0 file:bg-panel2 file:px-3 file:py-1 file:text-[12px] file:font-bold file:text-text" onChange={onFile} />
          </Field>
          <Field label="Or paste selected experience" htmlFor="resumeText">
            <Textarea id="resumeText" rows={6} value={resume} onChange={setResume} placeholder="Designed AWS infrastructure, wrote SQL pipelines, used Power BI ..." />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button id="scanResume" variant="primary" disabled={scanning} onClick={() => runScanOn(resume)}>{scanning ? 'Scanning…' : 'Find candidate skills'}</Button>
            <Button id="loadResumeSample" onClick={() => { setResume(SAMPLE_RESUME); void runScanOn(SAMPLE_RESUME); }}>Use synthetic example</Button>
          </div>
          <p className="note mt-3">Résumé upload → <b>amber suggestions</b> → your confirmation → <b>mint markers</b>. Optional confidence pulses add a separate shape to the radar. All processing is local{scanRunsInWorker() ? ' in a background worker' : ''}; résumé text is never stored.</p>
          <div id="candidateBox" className="mt-4">
            {ws.profile.candidates.length ? (
              <>
                <h4 className="mb-2 text-[13px]">{ws.profile.candidates.length} candidate skill{ws.profile.candidates.length === 1 ? '' : 's'} · awaiting your confirmation</h4>
                <div className="space-y-1.5">
                  {ws.profile.candidates.map((id) => { const s = SKILL_BY_ID.get(id)!; return (
                    <div key={id} className="row-card border-amber/40">
                      <span><strong className="block text-[13px]">{s.name}</strong><small className="text-quiet">{s.domain} · Résumé keyword match, not proficiency evidence</small></span>
                      <Button size="sm" variant="primary" data-confirm={id} onClick={() => act((d) => confirmSkill(d, id))}>Confirm</Button>
                    </div>
                  ); })}
                </div>
              </>
            ) : <Empty>No unconfirmed matches. Add skills manually, or expand the experience text.</Empty>}
          </div>
          <div id="credentialScanSummary" aria-live="polite" className="mt-3 rounded-md border border-stroke bg-panel2/50 p-3 text-[13px]">
            {pendingCreds ? (
              <><strong>{pendingCreds} possible certification{pendingCreds === 1 ? '' : 's'} found in your résumé</strong><p className="text-muted">They are not inventory records until you review them.</p><Button id="openCredentialSuggestions" size="sm" className="mt-2" onClick={() => navigate('credentials')}>Review credential suggestions ↗</Button></>
            ) : <span className="text-muted">Credential mentions are checked locally during résumé scanning. Matching does not prove you hold a certification.</span>}
          </div>
        </Panel>

        <Panel>
          <div className="eyebrow">B / REFLECT</div>
          <h3 className="mt-1 text-[17px]">Give confirmed skills their shine</h3>
          <p className="mt-1 text-[13px] text-muted">Your confidence pulse lives beside your spider web, where each response immediately changes a skill's glow. Confirm skills here first, then open the web to reflect.</p>
          <Button id="openPulseFromProfile" variant="primary" className="mt-3" onClick={() => {
            const target = ws.profile.confirmed.find((k) => !ws.profile.surveys[k]) ?? ws.profile.confirmed[0];
            if (!target) { flash('Attest to at least one skill first.'); return; }
            navigate('radar', { type: 'pulse', skillId: target });
          }}>Open my confidence pulse ↗</Button>
          <p className="note mt-2">Only attested skills can be rated. You can also open a pulse directly from each skill in your confirmed list.</p>
        </Panel>
      </div>

      <Panel>
        <PanelHeading eyebrow="C / CONTROL & CORRECTION" title="My confirmed capabilities" action={<Button id="clearMyData" variant="danger" size="sm" onClick={clear}>Clear my profile</Button>}>Mark skills you want represented. Résumé suggestions stay pending until individually confirmed.</PanelHeading>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Add any skill manually" htmlFor="manualSkill">
            <select ref={manualRef} id="manualSkill" className="control w-[320px]" value={manual} onChange={(e: ChangeEvent<HTMLSelectElement>) => setManual(e.target.value)}>
              <option value="">Select a skill</option>
              {SKILL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Button id="manualAdd" onClick={() => { if (!manual) { flash('Choose a skill to add.'); return; } if (act((d) => confirmSkill(d, manual)) !== undefined) setManual(''); }}>Add skill</Button>
        </div>
        <div id="mySkills" className="mt-4 grid gap-2 md:grid-cols-2">
          {ws.profile.confirmed.length ? ws.profile.confirmed.map((id) => {
            const s = SKILL_BY_ID.get(id); if (!s) return null;
            const v = ws.profile.surveys[id];
            return (
              <div key={id} className="row-card">
                <div><strong className="block text-[13px]">{s.name}</strong><small className="block text-quiet">{s.domain}</small><em className="text-[12px] not-italic text-mint">{v ? `Confidence ${v.confidence}/4 · ${modeLabel(v.method)}` : 'Confidence not rated'}</em></div>
                <div className="flex gap-1.5">
                  <Button size="sm" data-pulse-skill={id} onClick={() => navigate('radar', { type: 'pulse', skillId: id })}>{v ? 'Update pulse' : 'Rate confidence'} ↗</Button>
                  <Button size="icon" variant="danger" data-remove={id} aria-label={`Remove ${s.name}`} onClick={() => act((d) => removeSkill(d, id))}>✕</Button>
                </div>
              </div>
            );
          }) : <Empty>No skills confirmed yet. Start with a résumé or add one manually.</Empty>}
        </div>
        <div className="mt-5 grid gap-4 rounded-md border border-stroke bg-panel2/50 p-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h4 className="text-[14px]">Contribute to team coverage aggregates</h4>
            <p className="note">Optional. Switching this on adds <b>your confirmed skill list only</b> to the local team tools in this browser (coverage, team composer, knowledge watch), shown in groups of 3 or more. Confidence responses, notes and résumé text are never included.</p>
            <div className="mt-2 space-y-1">
              <Checkbox id="shareMentoringLocally" checked={ws.profile.shareMentoringLocally} onChange={(v) => update((d) => { d.profile.shareMentoringLocally = v; })}>Also let local <b>mentor discovery</b> see my mentoring opt-in, topics and availability.</Checkbox>
              <Checkbox id="shareCredentialsLocally" checked={ws.profile.shareCredentialsLocally} onChange={(v) => update((d) => { d.profile.shareCredentialsLocally = v; })}>Also let local <b>TEAMFORGE</b> matching see my self-entered credential names (unverified).</Checkbox>
            </div>
          </div>
          <label className="toggle"><Switch id="shareToggle" checked={ws.profile.consent} onChange={(v) => act((d) => setConsent(d, v))} label="Contribute to team coverage aggregates" /></label>
        </div>
        {ws.profile.candidates.length > 0 && <p className="note mt-3"><Pill tone="amber">{ws.profile.candidates.length} pending</Pill> suggestions are shown in amber on the web and galaxy until you confirm them.</p>}
      </Panel>
    </section>
  );
}
