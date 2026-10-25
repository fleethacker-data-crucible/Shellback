import { useMemo, useState } from 'react';
import { skillName } from '../../core/taxonomy';
import { STAGE_BY_ID, STAGE_DEFS, type Stage } from '../../core/contribution';
import { activeTeam, mentorMatches, missionCoverage, participants, renewalLabel, renewalState } from '../../core/analytics';
import { buildKnowledgePackage } from '../../core/share';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import * as A from '../state/actions';
import { useDialogs } from '../components/ui/dialogs';
import { Button, Checkbox, Empty, Field, Input, Notice, Panel, PanelHeading, Pill, Select, Stat, Textarea } from '../components/ui/primitives';
import { SKILL_OPTIONS_SHORT } from '../lib/options';
import { downloadJson } from '../lib/files';

const AVAIL = [['unknown', 'Not specified'], ['available', 'Available'], ['limited', 'Limited'], ['unavailable', 'Unavailable']].map(([value, label]) => ({ value: value!, label: label! }));

// ---------------------------------------------------------------------------- QUALFORGE
function QualForge() {
  const { ws, flash } = useStore();
  const act = useAction();
  const dialogs = useDialogs();
  const w = ws.workforce;
  const [form, setForm] = useState({ title: '', skill: 'qualification-planning', source: '', question: '', answer: '', scenario: '' });
  const [outline, setOutline] = useState({ skill: 'qualification-planning', text: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [draftAnswer, setDraftAnswer] = useState('');
  const m = w.modules.find((x) => x.id === selectedId) ?? w.modules[0];
  const needsRevisit = w.modules.filter((mod) => { const last = [...w.attempts].reverse().find((a) => a.moduleId === mod.id); return last?.result === 'practice'; }).length;

  async function importOutline() {
    try {
      // Dry run to count, then confirm, then apply.
      const preview = A.importOutline(structuredClone(ws), outline.text, outline.skill);
      if (!(await dialogs.confirm(`Create ${preview.created} unreviewed study drafts from your supplied outline? No answers or qualification results will be generated.`, { confirmLabel: 'Create drafts' }))) return;
      const r = act((d) => A.importOutline(d, outline.text, outline.skill));
      if (r) { setOutline({ ...outline, text: '' }); setRevealed(false); flash(`Created ${r.created} review-required study drafts. Supply the source-checked answer for each before recording practice.`); }
    } catch (err) { if (err instanceof A.ActionError) flash(err.message); else throw err; }
  }

  return (
    <div data-workforce-pane="qualforge" className="space-y-5">
      <div className="max-w-[78ch]"><div className="eyebrow">01 / QUALFORGE</div><h3 className="text-[20px]">Qualification study without counterfeit sign-offs.</h3><p className="text-[13px] text-muted">Create guides from material you are authorized to use, practice scenario prompts, and review your progress. Responses are learning records only.</p></div>
      <div id="wfQualStats" className="grid gap-3 sm:grid-cols-3"><Stat label="Study guides" value={w.modules.length} /><Stat label="Self-review attempts" value={w.attempts.length} /><Stat label="Needs revisit" value={needsRevisit} /></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="text-[16px]">Create a study guide</h3>
          <Field label="Guide or task name" htmlFor="wfModuleTitle"><Input id="wfModuleTitle" value={form.title} onChange={(v) => setForm({ ...form, title: v })} maxLength={120} placeholder="Synthetic example: Validate an incident handoff" /></Field>
          <Field label="Capability area" htmlFor="wfModuleSkill"><Select id="wfModuleSkill" value={form.skill} onChange={(v) => setForm({ ...form, skill: v })} options={SKILL_OPTIONS_SHORT} /></Field>
          <Field label="Approved source reference (optional)" htmlFor="wfModuleSource"><Input id="wfModuleSource" value={form.source} onChange={(v) => setForm({ ...form, source: v })} maxLength={220} placeholder="Synthetic exercise / locally approved reference" /></Field>
          <Field label="Knowledge-check prompt" htmlFor="wfModuleQuestion"><Textarea id="wfModuleQuestion" rows={3} value={form.question} onChange={(v) => setForm({ ...form, question: v })} placeholder="What checks should happen before an incident turnover?" /></Field>
          <Field label="Employee-authored reference answer" htmlFor="wfModuleAnswer"><Textarea id="wfModuleAnswer" rows={4} value={form.answer} onChange={(v) => setForm({ ...form, answer: v })} placeholder="Document state, unresolved risks, responsible owner..." /></Field>
          <Field label="Applied scenario (optional)" htmlFor="wfModuleScenario"><Textarea id="wfModuleScenario" rows={3} value={form.scenario} onChange={(v) => setForm({ ...form, scenario: v })} placeholder="A shift change occurs with an unresolved maintenance issue..." /></Field>
          <Button id="wfModuleCreate" variant="primary" className="mt-3" onClick={() => { const r = act((d) => A.addStudyModule(d, form)); if (r !== undefined) { setForm({ ...form, title: '', source: '', question: '', answer: '', scenario: '' }); setSelectedId(null); setRevealed(false); } }}>Create study guide</Button>
          <hr className="my-5 border-stroke" />
          <h4 className="text-[14px]">Import approved plain-text PQS-style outline</h4>
          <p className="note">Paste nonsensitive, authorized task lines such as "1.1 Explain the turnover process." Shellback creates draft questions only; it never fabricates reference answers or qualification sign-offs.</p>
          <Field label="Skill domain for imported tasks" htmlFor="wfOutlineSkill"><Select id="wfOutlineSkill" value={outline.skill} onChange={(v) => setOutline({ ...outline, skill: v })} options={SKILL_OPTIONS_SHORT} /></Field>
          <Field label="Approved outline excerpt (up to 12,000 characters)" htmlFor="wfOutlineText"><Textarea id="wfOutlineText" rows={4} maxLength={12000} value={outline.text} onChange={(v) => setOutline({ ...outline, text: v })} placeholder={'1.1 Describe the incident turnover process\n1.2 Explain escalation requirements'} /></Field>
          <Button id="wfOutlineImport" className="mt-3" onClick={importOutline}>Convert outline into review-required study drafts</Button>
        </Panel>
        <Panel>
          <h3 className="text-[16px]">Practice a guide</h3>
          <Field label="Select guide" htmlFor="wfModuleSelect"><Select id="wfModuleSelect" value={m?.id ?? ''} onChange={(v) => { setSelectedId(v); setRevealed(false); setDraftAnswer(''); }} options={w.modules.map((x) => ({ value: x.id, label: x.title }))} /></Field>
          <div id="wfStudyArea" className="mt-3 text-[13px]">
            {m ? (
              <>
                <div className="eyebrow">LOCAL STUDY / UNVERIFIED</div>
                <h4 className="mt-1 text-[16px]">{m.title}</h4>
                <p className="text-muted">{skillName(m.skill)} · Source: {m.source || 'Unspecified employee-supplied reference'}</p>
                <h4 className="mt-3 text-[14px]">Knowledge check</h4>
                <p>{m.question}</p>
                {m.answer ? (
                  <>
                    {revealed && <div id="wfStudyAnswer" className="mt-2 rounded-md border border-mint/30 bg-mint/5 p-3"><strong>Employee-supplied reference answer</strong><p>{m.answer}</p></div>}
                    <Button id="wfReveal" size="sm" className="mt-2" onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide reference' : 'Show reference'}</Button>
                  </>
                ) : (
                  <>
                    <Notice tone="warn" className="mt-2">REVIEW REQUIRED — outline intake does not generate answer keys or validate official content. Add an answer checked against the approved source before recording self-practice.</Notice>
                    <Field label="Employee-reviewed reference answer" htmlFor="wfDraftReference"><Textarea id="wfDraftReference" rows={4} maxLength={1600} value={draftAnswer} onChange={setDraftAnswer} /></Field>
                    <Button id="wfDraftSave" variant="primary" className="mt-2" onClick={() => { if (act((d) => A.setModuleAnswer(d, m.id, draftAnswer)) !== undefined) setDraftAnswer(''); }}>Complete study draft</Button>
                  </>
                )}
                <h4 className="mt-3 text-[14px]">Scenario reflection</h4>
                <p className="text-muted">{m.scenario || 'Explain when and how you would apply this task, and who would verify completion.'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button id="wfReviewed" variant="primary" size="sm" disabled={!m.answer} onClick={() => act((d) => A.recordAttempt(d, m.id, 'reviewed'))}>I reviewed this task</Button>
                  <Button id="wfPractice" size="sm" disabled={!m.answer} onClick={() => act((d) => A.recordAttempt(d, m.id, 'practice'))}>Needs more practice</Button>
                  <Button id="wfDeleteModule" variant="danger" size="sm" onClick={async () => { if (await dialogs.confirm('Delete this local study guide and its practice history?', { confirmLabel: 'Delete guide', danger: true })) { setSelectedId(null); act((d) => A.deleteModule(d, m.id)); } }}>Delete guide</Button>
                </div>
                <p className="note mt-2">Self-review records are learning activity only. No PQS sign-off, demonstration verification or readiness prediction is created.</p>
              </>
            ) : <Empty>Create a study guide using approved, nonsensitive learning material. No official PQS content is bundled or generated.</Empty>}
          </div>
        </Panel>
      </div>
      <Panel>
        <h3 className="text-[16px]">Voluntary study history</h3>
        <div id="wfStudyHistory" className="mt-2 space-y-1 text-[12px]">
          {w.attempts.length ? [...w.attempts].reverse().slice(0, 12).map((a, i) => <div key={i} className="row-card py-1"><span>{w.modules.find((x) => x.id === a.moduleId)?.title ?? 'Retired guide'}</span><small className="text-quiet">{a.result === 'reviewed' ? 'Self-reviewed' : 'Needs practice'} · {a.date}</small></div>) : <p className="note">No study history yet.</p>}
        </div>
        <p className="note mt-2">A self-review is not PQS completion, observed task execution, or an independent qualification assessment.</p>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------- SKILLFLEET
function GoalsAndRenewals() {
  const { ws, update } = useStore();
  const act = useAction();
  const [goal, setGoal] = useState({ skill: 'sql-pipelines', target: '', due: '' });
  return (
    <div className="grid gap-5 lg:grid-cols-2" data-workforce-pane="skillfleet">
      <Panel>
        <PanelHeading eyebrow="GROWTH PLAN" title="Development goals">Voluntary learning or cross-training goals. Visible only to you unless you choose to share them.</PanelHeading>
        <Field label="Skill to develop" htmlFor="wfGoalSkill"><Select id="wfGoalSkill" value={goal.skill} onChange={(v) => setGoal({ ...goal, skill: v })} options={SKILL_OPTIONS_SHORT} /></Field>
        <Field label="Learning outcome or cross-training intention" htmlFor="wfGoalTarget"><Input id="wfGoalTarget" value={goal.target} onChange={(v) => setGoal({ ...goal, target: v })} maxLength={250} placeholder="Pair with teammate to learn dashboard validation" /></Field>
        <Field label="Voluntary target date" htmlFor="wfGoalDue"><Input id="wfGoalDue" type="date" value={goal.due} onChange={(v) => setGoal({ ...goal, due: v })} /></Field>
        <Button id="wfGoalAdd" variant="primary" className="mt-3" onClick={() => { if (act((d) => A.addGoal(d, goal)) !== undefined) setGoal({ ...goal, target: '' }); }}>Add development goal</Button>
        <div id="wfGoalRows" className="mt-3 space-y-1.5">
          {ws.workforce.goals.length ? ws.workforce.goals.map((g) => <div key={g.id} className="row-card"><div><strong className="block text-[13px]">{skillName(g.skill)}</strong><small className="text-quiet">{g.target}{g.due ? ` · target ${g.due}` : ''}</small></div><div className="flex gap-1.5"><Button size="sm" data-wfgoal={g.id} onClick={() => update((d) => A.toggleGoal(d, g.id))}>{g.status === 'done' ? 'Reopen' : 'Mark reviewed'}</Button><Button size="icon" variant="danger" data-wfgoaldel={g.id} aria-label="Delete goal" onClick={() => update((d) => A.deleteGoal(d, g.id))}>×</Button></div></div>) : <p className="note">No goals yet.</p>}
        </div>
      </Panel>
      <Panel>
        <PanelHeading eyebrow="RENEWALS" title="Credential renewal signals">From your self-entered renewal dates. Unverified.</PanelHeading>
        <div id="wfCredentialStatus" className="space-y-1.5">{ws.profile.credentials.length ? ws.profile.credentials.map((c) => { const r = renewalState(c); return <div key={c.id} className="row-card"><strong className="text-[13px]">{c.name}</strong><small className={r.state === 'past' ? 'text-danger' : r.state === 'soon' ? 'text-amber' : 'text-quiet'}>{renewalLabel(r)}</small></div>; }) : <p className="note">No self-entered credentials yet.</p>}</div>
      </Panel>
    </div>
  );
}

/** Profile → Growth: personal study guides plus goals and renewals. */
export function GrowthPanel() {
  return (
    <div className="space-y-6">
      <GoalsAndRenewals />
      <QualForge />
    </div>
  );
}

// ---------------------------------------------------------------------------- TEAMFORGE
export function MissionsPanel() {
  const { ws, update } = useStore();
  const act = useAction();
  const team = activeTeam(ws);
  const people = useMemo(() => participants(ws, team), [ws, team]);
  const ids = people.map((p) => p.id);
  const [req, setReq] = useState({ skill: 'aws-architecture', min: '2', credential: '', stage: '' });
  const mission = ws.workforce.mission;
  const selected = mission.teamId === (team?.id ?? '') ? mission.selected.filter((id) => ids.includes(id)) : ids;
  const roster = people.filter((p) => selected.includes(p.id));
  const results = missionCoverage(roster, mission.requirements);
  const toggle = (id: string, on: boolean) => update((d) => { A.syncMissionRoster(d, team?.id ?? '', ids); A.setMissionSelected(d, id, on); });
  return (
    <div data-workforce-pane="teamforge" className="space-y-5">
      <div className="max-w-[78ch]"><div className="eyebrow">03 / TEAMFORGE</div><h3 className="text-[20px]">Explainable mission staffing constraints.</h3><p className="text-[13px] text-muted">Identify required skills, minimum contributors, claimed qualifications and voluntarily shared availability. This is a gap-checking tool—not an automated staffing or personnel assignment decision.</p></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="text-[16px]">Mission requirements</h3>
          <Field label="Needed capability" htmlFor="wfMissionSkill"><Select id="wfMissionSkill" value={req.skill} onChange={(v) => setReq({ ...req, skill: v })} options={SKILL_OPTIONS_SHORT} /></Field>
          <Field label="Minimum contributors" htmlFor="wfMissionMin"><Input id="wfMissionMin" type="number" inputMode="numeric" min={1} max={20} value={req.min} onChange={(v) => setReq({ ...req, min: v })} /></Field>
          <Field label="Qualification or certification text (optional; unverified matching)" htmlFor="wfMissionQualification"><Input id="wfMissionQualification" value={req.credential} onChange={(v) => setReq({ ...req, credential: v })} maxLength={100} placeholder="Example: synthetic certification category" /></Field>
          <Field label="Stage of work this needs (optional)" htmlFor="wfMissionStage"><Select id="wfMissionStage" value={req.stage} onChange={(v) => setReq({ ...req, stage: v })} placeholder="No particular stage" options={STAGE_DEFS.map((st) => ({ value: st.id, label: st.label }))} /></Field>
          <Button id="wfMissionAdd" variant="primary" className="mt-3" onClick={() => { if (act((d) => A.addRequirement(d, req)) !== undefined) setReq({ ...req, credential: '', stage: '' }); }}>Add mission requirement</Button>
          <div id="wfMissionRequirements" className="mt-3 space-y-1.5">{mission.requirements.length ? mission.requirements.map((r) => <div key={r.id} className="row-card"><div><strong className="block text-[13px]">{skillName(r.skill)}</strong><small className="text-quiet">{r.min} contributors · {r.credential ? `Qualification text: ${r.credential}` : 'No qualification requirement'}{r.stage ? ` · energized by ${STAGE_BY_ID.get(r.stage)?.label.toLowerCase()}` : ''}</small></div><Button size="icon" variant="danger" data-wfneeddelete={r.id} aria-label="Delete requirement" onClick={() => update((d) => A.deleteRequirement(d, r.id))}>×</Button></div>) : <p className="note">Add mission requirements to compare declared coverage and optional qualification claims.</p>}</div>
        </Panel>
        <Panel>
          <h3 className="text-[16px]">Considered opt-in contributors</h3>
          <p className="note">Roster for team "{team?.name ?? '—'}". Switching teams resets the selection to everyone in that team.</p>
          <div id="wfMissionRoster" className="mt-2 space-y-1">{people.length ? people.map((x) => <Checkbox key={x.id} checked={selected.includes(x.id)} onChange={(v) => toggle(x.id, v)}><strong className="text-text" data-wfstaff={x.id}>{x.name}</strong><br /><small>{x.availability === 'unknown' ? 'Availability unknown' : x.availability} · {x.synthetic ? 'Synthetic example' : x.self ? 'Local opt-in' : 'Voluntarily shared card'}</small></Checkbox>) : <Empty>No opt-in contributors have been shared with this team.</Empty>}</div>
        </Panel>
      </div>
      <Panel>
        <h3 className="text-[16px]">Mission coverage explanation</h3>
        <div id="wfMissionResults" className="mt-2 space-y-2">
          {results.length ? results.map((r, i) => (
            <div key={mission.requirements[i]!.id} className="rounded-md border border-stroke bg-panel2/60 p-3 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong>{skillName(r.skill)}</strong><Pill tone={r.gap ? 'amber' : 'mint'}>{r.covered.length}/{r.min} shared mentions</Pill></div>
              <p className="mt-1">{r.credential ? `${r.qualified.length} self-declared qualification match(es) (unverified)` : 'No formal qualification requirement entered'} · {r.available.length} explicitly available · {r.limited.length} limited · {r.unknown.length} unknown availability</p>
              {r.stage && <p className="mt-1">{r.energized.length} of the {r.covered.length} covering people said <b>{STAGE_BY_ID.get(r.stage as Stage)?.label.toLowerCase()}</b> energizes them{r.energized.length ? `: ${r.energized.map((p) => p.name).join(', ')}` : ' (or did not share preferences)'}.{r.stagePartners.length > 0 && <> Energized by that stage but without the skill yet: <span data-stage-partners>{r.stagePartners.map((p) => p.name).join(', ')}</span> — a pairing or stretch opportunity, not a gap.</>}</p>}
              <p className="note">{r.gap ? 'Potential coverage gap; consider cross-training or outreach.' : 'Declared skill mentions meet the requested count; operational eligibility remains unverified.'}</p>
            </div>
          )) : <Empty>Add a task requirement to generate a transparent team coverage comparison.</Empty>}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------- MENTORLINK
export function MentorsPanel() {
  const { ws, update } = useStore();
  const people = useMemo(() => participants(ws), [ws]);
  const m = ws.workforce.mentorship;
  const [topicToAdd, setTopicToAdd] = useState('aws-architecture');
  const [search, setSearch] = useState<string>('all');
  const [problem, setProblem] = useState('');
  const matched = mentorMatches(people, search);
  const target = search === 'all' ? 'a relevant capability' : skillName(search);
  const draft = `Hello, I'm looking to learn about ${target.toLowerCase()}.${problem.trim() ? '\nSpecifically: ' + problem.trim() : ''}\nWould you be open to a voluntary knowledge-sharing conversation? I understand that this request does not imply an assigned mentoring role.`;
  return (
    <div data-workforce-pane="mentorlink" className="space-y-5">
      <div className="max-w-[78ch]"><div className="eyebrow">04 / MENTORLINK</div><h3 className="text-[20px]">Find willing mentors, not just experienced people.</h3><p className="text-[13px] text-muted">Search peer profiles only when they have chosen to share mentoring availability. A self-reported skill alone does not make someone an assigned mentor.</p></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="text-[16px]">My voluntary mentoring offer</h3>
          <Checkbox id="wfMentorEnabled" className="mt-2" checked={m.enabled} onChange={(v) => update((d) => A.setMentorship(d, { enabled: v }))}>I am open to voluntary mentoring conversations</Checkbox>
          <Field label="Availability to share" htmlFor="wfMentorAvailability"><Select id="wfMentorAvailability" value={m.availability} onChange={(v) => update((d) => A.setMentorship(d, { availability: v as typeof m.availability }))} options={AVAIL} /></Field>
          <Field label="Short introduction (shared only with extra card opt-in)" htmlFor="wfMentorIntro"><Textarea id="wfMentorIntro" rows={3} maxLength={500} value={m.intro} onChange={(v) => update((d) => A.setMentorship(d, { intro: v }))} placeholder="Topics I am happy to discuss..." /></Field>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Field label="Add a mentoring topic" htmlFor="wfMentorAdd"><Select id="wfMentorAdd" className="w-[260px]" value={topicToAdd} onChange={setTopicToAdd} options={SKILL_OPTIONS_SHORT} /></Field>
            <Button id="wfMentorTopicAdd" onClick={() => update((d) => A.setMentorship(d, { topics: [...new Set([...d.workforce.mentorship.topics, topicToAdd])] }))}>Add topic</Button>
          </div>
          <div id="wfMentorTopics" className="mt-2 flex flex-wrap gap-1.5">{m.topics.length ? m.topics.map((t) => <span key={t} className="focus-pill">{skillName(t)}<button type="button" data-wfmentordel={t} aria-label="Remove topic" className="ml-1" onClick={() => update((d) => A.setMentorship(d, { topics: d.workforce.mentorship.topics.filter((x) => x !== t) }))}>×</button></span>) : <p className="note">No mentoring topics selected.</p>}</div>
          <p className="note mt-2">Changes stay local until you explicitly export an updated peer card with mentoring information enabled{ws.profile.consent && !ws.profile.shareMentoringLocally ? ' — and, for this browser\'s own team tools, until you tick "let local mentor discovery see my mentoring opt-in" in My capability profile' : ''}.</p>
        </Panel>
        <Panel>
          <h3 className="text-[16px]">Opt-in expert directory</h3>
          <Field label="Capability to learn" htmlFor="wfMentorSearch"><Select id="wfMentorSearch" value={search} onChange={setSearch} options={[{ value: 'all', label: 'All capabilities' }, ...SKILL_OPTIONS_SHORT]} /></Field>
          <div id="wfMentorMatches" className="mt-3 space-y-1.5">{matched.length ? matched.map((x) => <div key={x.id} className="row-card"><div><strong className="block text-[13px]">{x.name}</strong><small className="text-quiet">Opt-in · {x.availability === 'unknown' ? 'availability unknown' : x.availability}{x.mentorIntro ? ` · ${x.mentorIntro}` : ''} · {x.synthetic ? 'Synthetic example' : x.self ? 'Local' : 'Imported card'}</small></div><Pill>{x.mentorTopics.length} offered topic(s)</Pill></div>) : <Empty>No peers have shared mentoring opt-in for this topic. Self-reported skill mentions alone do not imply willingness to mentor.</Empty>}</div>
          {search !== 'all' && (() => {
            const others = people.filter((x) => x.skills.includes(search) && !matched.includes(x));
            return others.length ? (
              <div id="wfSkillPeers" className="mt-4">
                <h4 className="text-[13px]">Also shared {skillName(search)} <span className="text-quiet">(not a mentoring offer)</span></h4>
                <div className="mt-1.5 space-y-1">{others.map((x) => { const r = x.surveys[search]; return <div key={x.id} className="row-card py-1.5"><span className="text-[13px]">{x.name}{x.synthetic ? ' · synthetic' : ''}</span><Pill>{r ? `Shared self-report ${r.confidence}/4 · ${r.method}` : 'Confidence not shared'}</Pill></div>; })}</div>
              </div>
            ) : null;
          })()}
          <h4 className="mt-4 text-[14px]">Voluntary outreach draft</h4>
          <Field label="Question or problem" htmlFor="wfMentorProblem"><Textarea id="wfMentorProblem" rows={2} value={problem} onChange={setProblem} placeholder="I want to learn how to validate data pipelines..." /></Field>
          <Textarea id="wfMentorDraft" className="mt-2" rows={5} readOnly value={draft} onChange={() => undefined} aria-label="Mentorship outreach draft" />
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- KNOWLEDGE RELAY
export function KnowledgePanel() {
  const { ws, update, flash } = useStore();
  const act = useAction();
  const dialogs = useDialogs();
  const team = activeTeam(ws);
  const people = useMemo(() => participants(ws, team), [ws, team]);
  const w = ws.workforce;
  const [form, setForm] = useState({ topic: '', skill: 'qualification-planning', owner: '', context: '', steps: '', handoff: '', source: '' });
  const [query, setQuery] = useState('');
  const [approvedOnly, setApprovedOnly] = useState(false);
  const q = query.trim().toLowerCase().slice(0, 120);
  const records = w.knowledge.filter((k) => (!approvedOnly || k.approved) && (!q || `${k.topic} ${skillName(k.skill)} ${k.context} ${k.steps} ${k.owner}`.toLowerCase().includes(q)));
  const watchIds = [...new Set([...(team?.priorities ?? []), ...w.mission.requirements.map((r) => r.skill)])];
  return (
    <div data-workforce-pane="relay" className="space-y-5">
      <div className="max-w-[78ch]"><div className="eyebrow">05 / KNOWLEDGE RELAY</div><h3 className="text-[20px]">Capture institutional know-how before it disappears.</h3><p className="text-[13px] text-muted">Use a structured, employee-reviewed interview and explicit source references. Keep notes in a local draft until an authorized owner marks them reviewed.</p></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="text-[16px]">Guided knowledge-transfer intake</h3>
          <Field label="Practice, lesson, or procedure" htmlFor="wfKnowledgeTopic"><Input id="wfKnowledgeTopic" value={form.topic} onChange={(v) => setForm({ ...form, topic: v })} maxLength={150} placeholder="Synthetic handoff: recurring dashboard data discrepancy" /></Field>
          <Field label="Related capability" htmlFor="wfKnowledgeSkill"><Select id="wfKnowledgeSkill" value={form.skill} onChange={(v) => setForm({ ...form, skill: v })} options={SKILL_OPTIONS_SHORT} /></Field>
          <Field label="Voluntary owner display name" htmlFor="wfKnowledgeOwner"><Input id="wfKnowledgeOwner" value={form.owner} onChange={(v) => setForm({ ...form, owner: v })} maxLength={90} placeholder="Synthetic domain SME" /></Field>
          <Field label="When does this situation arise? What could go wrong?" htmlFor="wfKnowledgeContext"><Textarea id="wfKnowledgeContext" rows={3} value={form.context} onChange={(v) => setForm({ ...form, context: v })} /></Field>
          <Field label="What is the practical process? How do you validate results?" htmlFor="wfKnowledgeSteps"><Textarea id="wfKnowledgeSteps" rows={5} value={form.steps} onChange={(v) => setForm({ ...form, steps: v })} /></Field>
          <Field label="Who or what is needed for the next handoff?" htmlFor="wfKnowledgeHandoff"><Textarea id="wfKnowledgeHandoff" rows={3} value={form.handoff} onChange={(v) => setForm({ ...form, handoff: v })} /></Field>
          <Field label="Approved source / document reference" htmlFor="wfKnowledgeSource"><Input id="wfKnowledgeSource" value={form.source} onChange={(v) => setForm({ ...form, source: v })} maxLength={250} placeholder="Reference only; no sensitive document content" /></Field>
          <Button id="wfKnowledgeAdd" variant="primary" className="mt-3" onClick={() => { if (act((d) => A.addKnowledge(d, form)) !== undefined) setForm({ ...form, topic: '', owner: '', context: '', steps: '', handoff: '', source: '' }); }}>Save unreviewed knowledge draft</Button>
        </Panel>
        <Panel>
          <h3 className="text-[16px]">Knowledge concentration watch</h3>
          <div id="wfOwnershipWatch" className="mt-2 space-y-1 text-[12px]">{watchIds.length ? watchIds.map((id) => { const n = people.filter((x) => x.skills.includes(id)).length; return <div key={id} className="row-card py-1"><span>{skillName(id)}</span><strong>{n === 0 ? 'No shared knowledge owner' : n === 1 ? 'Single contributor' : 'Multiple contributors'}</strong></div>; }) : <p className="note">Mark priority skills or mission needs to generate an expertise-concentration watchlist.</p>}</div>
          <p className="note mt-2">A missing owner here only means missing opt-in data—not that the organization lacks expertise.</p>
          <h4 className="mt-4 text-[14px]">Search and controlled export</h4>
          <Field label="Search records" htmlFor="wfKnowledgeSearch"><Input id="wfKnowledgeSearch" type="search" value={query} onChange={setQuery} placeholder="Search title, practice, skill..." /></Field>
          <Checkbox id="wfApprovedOnly" className="mt-2" checked={approvedOnly} onChange={setApprovedOnly}>Owner-marked reviewed records only</Checkbox>
          <Button id="wfKnowledgeExport" className="mt-3" onClick={() => { try { downloadJson(buildKnowledgePackage(ws), `shellback-approved-knowledge-${ws.meta.updated}.json`); flash('Exported owner-marked reviewed records only. This is not an authority accreditation.'); } catch (err) { flash(err instanceof Error ? err.message : String(err)); } }}>Export reviewed knowledge package</Button>
        </Panel>
      </div>
      <Panel>
        <h3 className="text-[16px]">Local lessons and transfer records</h3>
        <div id="wfKnowledgeRecords" className="mt-2 space-y-2">
          {records.length ? records.map((k) => (
            <article key={k.id} className="rounded-md border border-stroke bg-panel2/60 p-3 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-[15px]">{k.topic}</h4><Pill tone={k.approved ? 'mint' : 'amber'}>{k.approved ? 'Owner-marked approved' : 'Draft / unreviewed'}</Pill></div>
              <p className="text-muted">{skillName(k.skill)} · {k.owner || 'Owner not supplied'} · {k.created}</p>
              <p className="mt-1"><strong>Situation / context:</strong> {k.context || 'Not supplied'}</p>
              <p><strong>Transfer steps:</strong> {k.steps || 'Not supplied'}</p>
              <p><strong>Next handoff:</strong> {k.handoff || 'Not supplied'}</p>
              <p className="text-muted">Source reference: {k.source || 'Unspecified'}</p>
              <div className="mt-2 flex gap-2"><Button size="sm" data-wfapprove={k.id} onClick={() => update((d) => A.toggleKnowledgeApproved(d, k.id))}>{k.approved ? 'Return to draft' : 'Mark approved (owner-reviewed)'}</Button><Button size="sm" variant="danger" data-wfknowdel={k.id} onClick={async () => { if (await dialogs.confirm('Delete this local knowledge record?', { confirmLabel: 'Delete', danger: true })) update((d) => A.deleteKnowledge(d, k.id)); }}>Delete</Button></div>
            </article>
          )) : <Empty>No matching knowledge-transfer records. Capture an approved, nonsensitive lesson or start with a synthetic example.</Empty>}
        </div>
      </Panel>
    </div>
  );
}
