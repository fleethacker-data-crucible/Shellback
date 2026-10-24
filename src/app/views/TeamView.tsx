import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { DOMAINS, SKILLS, skillName } from '../../core/taxonomy';
import { activeTeam, aggregate, benchSignals, coverageGaps, mentorMatches, participants, skillCoverage, MIN_AGGREGATE, DEMO_TEAM_ID } from '../../core/analytics';
import { parsePeerCard } from '../../core/schema';
import { buildPeerCard, describeCard } from '../../core/share';
import { decryptJson, encryptJson, isEncryptedEnvelope } from '../../core/crypto';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import { createTeam, deleteTeam, ensureShareId, fleetPlan, importMember, removeMember, selectTeam, togglePriority } from '../state/actions';
import { useDialogs } from '../components/ui/dialogs';
import { BarRow, Button, Checkbox, Empty, Field, Input, Notice, Panel, PanelHeading, Pill, Select, SectionIntro, Stat, Tabs } from '../components/ui/primitives';
import { SKILL_OPTIONS_SHORT } from '../lib/options';
import { downloadJson, readJsonFile } from '../lib/files';

export function TeamView() {
  const { ws, update, flash, settings, setSettings } = useStore();
  const act = useAction();
  const dialogs = useDialogs();
  const team = activeTeam(ws);
  const people = useMemo(() => participants(ws, team), [ws, team]);
  const agg = useMemo(() => aggregate(people), [people]);
  const [teamName, setTeamName] = useState('');
  const [shareName, setShareName] = useState(ws.profile.displayName || 'Demo participant');
  const [disclose, setDisclose] = useState({ confidence: false, mentoring: false, credentials: false });
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [priority, setPriority] = useState('aws-architecture');
  const [status, setStatus] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);
  const note = (m: string) => { setStatus(m); flash(m); };

  async function exportCard() {
    try {
      let shareId = ws.profile.shareId;
      if (!shareId) { act((d) => { shareId = ensureShareId(d); }); }
      const card = buildPeerCard(ws, shareName, disclose, shareId);
      const ok = await dialogs.confirm(<>Share {describeCard(card)} under the name <b>"{card.name}"</b>? The recipient can retain and redistribute this file; it cannot be recalled.</>, { title: 'Export opt-in card', confirmLabel: 'Export card' });
      if (!ok) return;
      const protect = await dialogs.confirm('Encrypt the card with a passphrase you will give the recipient separately?', { title: 'Protect the file', confirmLabel: 'Encrypt', cancelLabel: 'Plain JSON' });
      if (protect) {
        const pass = await dialogs.prompt('Passphrase for this card (share it over a different channel).', { label: 'Passphrase', password: true, minLength: 8 });
        if (pass === null) return;
        downloadJson(await encryptJson(card, pass, 'synapse-peer-card'), `synapse-peer-${card.issued}.encrypted.json`);
      } else downloadJson(card, `synapse-peer-${card.issued}.json`);
      update((d) => { d.profile.displayName = card.name; });
      note('Peer card exported. You control where to send it.');
    } catch (err) { note(err instanceof Error ? err.message : String(err)); }
  }

  async function importCard(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !team) return;
    try {
      let data = await readJsonFile(f, 256_000);
      if (isEncryptedEnvelope(data)) {
        const pass = await dialogs.prompt(`"${f.name}" is encrypted. Enter the passphrase the sender gave you.`, { label: 'Passphrase', password: true });
        if (pass === null) return;
        data = await decryptJson(data, pass);
      }
      const member = parsePeerCard(data);
      const existing = team.members.find((m) => m.id === member.id);
      const ok = await dialogs.confirm(
        <>Import <b>{member.name}</b>'s opt-in card ({member.skills.length} skills, {Object.keys(member.surveys).length} optional survey signals{member.mentorOptIn ? ', mentoring opt-in' : ''}{member.qualificationClaims.length ? ', unverified qualification claims' : ''}) into "{team.name}"?
          {existing && <><br /><b className="text-amber">This replaces the existing card for "{existing.name}" (same peer id).</b></>}</>,
        { title: 'Import peer card', confirmLabel: existing ? 'Replace card' : 'Import card' },
      );
      if (!ok) return;
      const outcome = act((d) => importMember(d, team.id, member));
      if (outcome) { setSelectedPeer(member.id); note(outcome.replaced ? `Replaced ${outcome.previousName}'s card with the new one from ${member.name}. Information is unverified.` : `Imported ${member.name}'s card. Information is unverified.`); }
    } catch (err) { note('Import blocked: ' + (err instanceof Error ? err.message : String(err))); }
  }

  async function removeTeam() {
    if (!team) return;
    if (!(await dialogs.confirm(`Delete local team "${team.name}" and its imported copies?`, { confirmLabel: 'Delete team', danger: true }))) return;
    setSelectedPeer(null);
    act((d) => deleteTeam(d, team.id));
  }

  const peer = people.find((p) => p.id === selectedPeer);
  const bench = benchSignals(agg);
  const gaps = coverageGaps(agg, team?.priorities ?? []);
  const prio = new Set(team?.priorities ?? []);

  return (
    <section id="team" className="space-y-5">
      <SectionIntro eyebrow="TEAM / EMPLOYEE CONSENT" title="Build a team. Find shared strength.">Create a local team, exchange employee-approved capability cards, and identify where coverage is thin or bench strength may need attention. Peer exchange is through JSON files: no live network service in this offline MVP.</SectionIntro>
      <Notice>A peer must deliberately export their own capability card. Only reviewed skill mentions are included by default; confidence, mentoring and credential names each require a separate opt-in. Claims are not qualifications or deployable readiness.</Notice>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeading eyebrow="01 / TEAM WORKSPACE" title="Manage your team" />
          <Field label="Active team" htmlFor="teamSelect">
            <Select id="teamSelect" value={team?.id ?? ''} onChange={(v) => { setSelectedPeer(null); update((d) => selectTeam(d, v)); }} options={ws.teams.items.map((t) => ({ value: t.id, label: `${t.name}${t.id === DEMO_TEAM_ID ? ' · synthetic' : ''}` }))} />
          </Field>
          <Field label="New team name" htmlFor="teamName"><Input id="teamName" value={teamName} onChange={setTeamName} maxLength={80} placeholder="e.g. Data Crucible pilot" /></Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button id="createTeam" variant="primary" onClick={() => { const r = act((d) => createTeam(d, teamName)); if (r !== undefined) { setTeamName(''); setSelectedPeer(null); setStatus(r); } }}>Create team</Button>
            <Button id="deleteTeam" variant="danger" onClick={removeTeam}>Delete selected team</Button>
          </div>
          <h4 className="mt-5 text-[14px]">Shared peer roster</h4>
          <div id="teamMemberList" className="mt-2 space-y-1.5">
            {people.length ? people.map((p) => (
              <div key={p.id} className="row-card team-member">
                <button type="button" className="text-left font-bold text-mint hover:underline" data-peerview={p.id} onClick={() => setSelectedPeer(p.id)}>{p.name}</button>
                <Pill>{p.synthetic ? 'Synthetic' : p.self ? 'Local' : 'Shared card'}</Pill>
                <span className="text-[12px] text-quiet">{p.skills.length} reviewed mentions</span>
                {!p.self && !p.synthetic && <Button size="sm" variant="danger" data-peerdel={p.id} onClick={async () => { if (await dialogs.confirm('Remove this imported peer card from your local team?', { confirmLabel: 'Remove', danger: true })) { setSelectedPeer(null); act((d) => removeMember(d, team!.id, p.id)); } }}>Remove</Button>}
              </div>
            )) : <Empty>Empty team. Add peers using their opt-in JSON cards.</Empty>}
          </div>
          <div id="teamPeerDetail" className="mt-3 rounded-md border border-stroke bg-panel2/60 p-3 text-[13px]">
            {peer ? (
              <>
                <div className="eyebrow">EMPLOYEE-SHARED FIELDS ONLY</div>
                <h4 className="mt-1 text-[15px]">{peer.name}</h4>
                <p className="text-muted">{peer.synthetic ? 'Entirely fictional.' : peer.self ? 'Only local profile claims included here.' : 'Voluntarily shared capability card; not authenticated or verified.'}{peer.issued && peer.issued !== 'Unknown' ? ` Issued ${peer.issued}.` : ''}</p>
                <div className="mt-2 flex flex-wrap gap-1">{peer.skills.length ? peer.skills.map((x) => <Pill key={x}>{skillName(x)}</Pill>) : 'No confirmed skill mentions'}</div>
                <p className="mt-2 text-muted">{Object.keys(peer.surveys).length} task confidence/execution response(s) voluntarily shared.{peer.synthetic ? ' (Synthetic responses)' : ''}</p>
                <div className="mt-1 space-y-1">{Object.entries(peer.surveys).map(([sid, r]) => <div key={sid} className="bench-row flex justify-between"><span>{skillName(sid)}</span><strong>{r.confidence}/4 · {r.method}</strong></div>)}</div>
                {peer.mentorOptIn && <p className="mt-2 text-muted">Mentoring opt-in shared · availability {peer.availability}{peer.mentorTopics.length ? ` · topics: ${peer.mentorTopics.map(skillName).join(', ')}` : ''}</p>}
                {peer.qualificationClaims.length > 0 && <p className="mt-2 text-muted">Unverified credential names shared: {peer.qualificationClaims.join('; ')}</p>}
              </>
            ) : <p className="text-muted">Select a peer to inspect only the fields they chose to share.</p>}
          </div>
        </Panel>

        <Panel>
          <PanelHeading eyebrow="02 / VOLUNTARY PEER EXCHANGE" title="Share your capability card">Choose your display name and disclosed fields, then pass the exported JSON file directly to a peer over an approved channel. Already shared files cannot be revoked remotely.</PanelHeading>
          <Field label="Display name included on card" htmlFor="shareName"><Input id="shareName" value={shareName} onChange={setShareName} maxLength={70} placeholder="e.g. Demo Analyst" /></Field>
          <div className="mt-3 space-y-1.5">
            <Checkbox id="includeSurveyShare" checked={disclose.confidence} onChange={(v) => setDisclose({ ...disclose, confidence: v })}>Also disclose task confidence and execution method</Checkbox>
            <Checkbox id="includeMentorShare" checked={disclose.mentoring} onChange={(v) => setDisclose({ ...disclose, mentoring: v })}>Also disclose my mentoring opt-in, chosen topics and availability</Checkbox>
            <Checkbox id="includeQualificationShare" checked={disclose.credentials} onChange={(v) => setDisclose({ ...disclose, credentials: v })}>Also disclose self-entered credential names (UNVERIFIED)</Checkbox>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button id="exportPeer" variant="primary" onClick={exportCard}>Export opt-in card ↗</Button>
            <Button id="importPeerBtn" onClick={() => importRef.current?.click()}>Import peer card ↧</Button>
            <input ref={importRef} hidden type="file" id="importPeerFile" accept=".json,application/json" onChange={importCard} />
          </div>
          <p id="teamExchangeStatus" role="status" className="note mt-2">{status}</p>
          <p className="note mt-3">Your card id stays the same across exports (so teammates' copies update instead of duplicating){ws.profile.shareId ? `: ${ws.profile.shareId}` : '.'}</p>
        </Panel>
      </div>

      <div id="teamStats" className="grid gap-3 sm:grid-cols-3">
        <Stat label="Voluntary profiles" value={agg.n} hint={team?.id === DEMO_TEAM_ID ? 'Synthetic sample' : 'Local team workspace'} />
        <Stat label="Domains represented" value={agg.allowed ? agg.domainCounts.filter((x) => x > 0).length : '—'} hint={agg.allowed ? 'Employee-declared, not verified' : `Suppressed until ${MIN_AGGREGATE} shared profiles`} />
        <Stat label="Priority skills" value={team?.priorities.length ?? 0} hint="Development focus, not ranking" />
      </div>

      <Panel>
        <PanelHeading eyebrow="03 / CAPABILITY INTELLIGENCE" title="Find gaps and develop bench strength">At least three voluntarily shared profiles are required to display coverage totals. Self-declared skill mentions and self-reported independent capability are distinct measures.</PanelHeading>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h4 className="text-[14px]">Domain coverage</h4>
            <div id="teamBars" className="mt-2">{agg.allowed ? DOMAINS.map((d) => <BarRow key={d.index} label={d.name} value={agg.domainCounts[d.index] ?? 0} max={agg.n} />) : <Empty>At least {MIN_AGGREGATE} opt-in profiles are needed for aggregate team analysis. Missing data must not be treated as a personnel gap.</Empty>}</div>
          </div>
          <div>
            <h4 className="text-[14px]">Bench-strength signals</h4>
            <div id="teamBench" className="mt-2 space-y-1 text-[12px]">
              {agg.allowed ? (<><p className="note">Self-reported independent method and confidence ≥3. "Unconfirmed bench" means no opt-in evidence, not lack of ability.</p>{bench.map((sk) => <div key={sk.id} className="bench-row flex justify-between"><span>{sk.name}</span><span className="text-quiet">{agg.benchCounts[sk.id]} self-reported independent / {agg.skillCounts[sk.id]} experience mentions</span></div>)}</>) : <Empty>Suppressed until {MIN_AGGREGATE} shared profiles.</Empty>}
            </div>
          </div>
        </div>
        <h4 className="mt-5 text-[14px]">Priority skills</h4>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <Field label="Focus capability" htmlFor="criticalSkill"><Select id="criticalSkill" className="w-[280px]" value={priority} onChange={setPriority} options={SKILL_OPTIONS_SHORT} /></Field>
          <Button id="addCritical" onClick={() => team && update((d) => togglePriority(d, team.id, priority, true))}>Track this skill</Button>
        </div>
        <div id="teamCritical" className="mt-2 flex flex-wrap gap-1.5">
          {team?.priorities.length ? team.priorities.map((sid) => <span key={sid} className="focus-pill">{skillName(sid)}{agg.allowed ? ` · ${agg.skillCounts[sid] ?? 0} declared` : ''} <button type="button" aria-label={`Remove priority ${skillName(sid)}`} data-criticalremove={sid} className="ml-1 text-mint/70 hover:text-mint" onClick={() => update((d) => togglePriority(d, team.id, sid, false))}>×</button></span>) : <p className="note">No priority skills selected.</p>}
        </div>
        <h4 className="mt-5 text-[14px]">Uncovered and single-person skills</h4>
        <div id="teamSkillGaps" className="mt-2 grid gap-1 text-[12px] md:grid-cols-2">
          {agg.allowed ? (gaps.length ? gaps.map((sk) => <div key={sk.id} className="bench-row row-card py-1"><span>{prio.has(sk.id) ? '★ ' : ''}{sk.name} <small className="text-quiet">· {sk.domain}</small></span><strong>{agg.skillCounts[sk.id] === 0 ? 'No claims' : 'One contributor'}</strong></div>) : <Empty>No uncovered or single-contributor skills in the shared dataset.</Empty>) : <Empty>Suppressed until {MIN_AGGREGATE} shared profiles.</Empty>}
        </div>
      </Panel>
      <p className="note">The default sample team is entirely synthetic. Other team workspaces are empty until cards are imported. The local UI is not an access-control boundary; an operational team-sharing service requires identity, authorization, encryption, labor/privacy review, and audit logging.</p>

      {team && <CapabilityLab teamId={team.id} people={people} priorities={team.priorities} tab={settings.labTab} setTab={(t) => setSettings({ labTab: t })} />}
    </section>
  );
}

function CapabilityLab({ teamId, people, priorities, tab, setTab }: { teamId: string; people: ReturnType<typeof participants>; priorities: string[]; tab: 'compose' | 'mentors' | 'relay'; setTab: (t: 'compose' | 'mentors' | 'relay') => void }) {
  const { ws, update } = useStore();
  const [addSkill, setAddSkill] = useState('aws-architecture');
  const [mentorSkill, setMentorSkill] = useState('aws-architecture');
  const ids = people.map((p) => p.id);
  const existing = ws.fleetPlans[teamId];
  const plan = {
    mission: (existing?.mission ?? priorities).filter((id) => SKILLS.some((s) => s.id === id)).slice(0, 25),
    selected: existing ? existing.selected.filter((id) => ids.includes(id)) : ids,
  };
  const chosen = people.filter((p) => plan.selected.includes(p.id));
  const coverage = skillCoverage(chosen, plan.mission);
  const relayIds = [...new Set([...plan.mission, ...priorities])];
  const allCovered = skillCoverage(people, relayIds);
  const single = allCovered.filter((x) => x.claimed.length <= 1);
  const watch = single.length ? single : allCovered;
  const mentors = people.filter((p) => p.skills.includes(mentorSkill));
  const edit = (fn: (p: { mission: string[]; selected: string[] }) => void) => update((d) => { const p = fleetPlan(d, teamId, ids); fn(p); });

  return (
    <Panel id="fleetLab" className="fleet-lab-panel">
      <PanelHeading eyebrow="04 / FLEETHACKER CAPABILITY LAB" title="Compose teams. Discover mentors. Protect knowledge.">Based on TEAMFORGE, MENTORLINK and KNOWLEDGE RELAY. Planning prompts use explicitly shared skill mentions; they do not establish qualifications.</PanelHeading>
      <Tabs label="Capability lab modules" value={tab} onChange={setTab} items={[{ id: 'compose', label: 'Team composer', testId: 'fleetTabCompose' }, { id: 'mentors', label: 'Mentor discovery', testId: 'fleetTabMentors' }, { id: 'relay', label: 'Knowledge relay', testId: 'fleetTabRelay' }]} />
      {tab === 'compose' && (
        <div id="fleetComposer" className="mt-4">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h4 className="text-[14px]">Mission skill needs</h4>
              <p className="note">Use your team priority skills or choose additional needs. Every score is a coverage signal, not a suitability or readiness judgment.</p>
              <div id="fleetMissionSkills" className="mt-2 flex flex-wrap gap-1.5">{plan.mission.length ? plan.mission.map((id) => <span key={id} className="focus-pill">{skillName(id)}<button type="button" data-fleetremove={id} aria-label="Remove mission skill" className="ml-1" onClick={() => edit((p) => { p.mission = p.mission.filter((x) => x !== id); })}>×</button></span>) : <p className="note">No mission needs yet. Add a capability to explore team coverage.</p>}</div>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <Field label="Add a mission capability" htmlFor="fleetAddSkill"><Select id="fleetAddSkill" className="w-[260px]" value={addSkill} onChange={setAddSkill} options={SKILL_OPTIONS_SHORT} /></Field>
                <Button id="fleetAddSkillBtn" onClick={() => edit((p) => { if (!p.mission.includes(addSkill) && p.mission.length < 25) p.mission.push(addSkill); })}>Add skill</Button>
              </div>
            </div>
            <div>
              <h4 className="text-[14px]">Proposed roster</h4>
              <p className="note">Select volunteers who supplied their profile cards. This selection stays local.</p>
              <div id="fleetRoster" className="mt-2 space-y-1">
                {people.length ? people.map((p) => <Checkbox key={p.id} checked={plan.selected.includes(p.id)} onChange={(v) => edit((pl) => { pl.selected = v ? [...new Set([...pl.selected, p.id])] : pl.selected.filter((x) => x !== p.id); })}><strong className="text-text" data-fleetperson={p.id}>{p.name}</strong><br /><small>{p.synthetic ? 'Synthetic sample' : p.self ? 'Local profile' : 'Voluntarily imported card'} · {p.skills.length} self-declared mentions</small></Checkbox>) : <Empty>Import voluntary peer cards into this team first.</Empty>}
              </div>
            </div>
          </div>
          <div id="fleetCompositionResult" className="mt-4 space-y-1.5">
            {plan.mission.length ? (<><h4 className="text-[14px]">Proposed team coverage ({chosen.length} opted-in profiles selected)</h4><p className="note">This planning comparison deliberately does not assign individuals any fit, readiness, or performance score.</p>
              {coverage.map((r) => <div key={r.id} className="row-card"><div><strong className="block text-[13px]">{skillName(r.id)}</strong><small className="text-quiet">{r.claimed.length} declared experience mention(s) · {r.independent.length} optional independent task response(s)</small></div><Pill tone={r.claimed.length === 0 ? 'danger' : r.claimed.length === 1 ? 'amber' : 'mint'}>{r.claimed.length === 0 ? 'No shared evidence' : r.claimed.length === 1 ? 'Single source' : 'Shared coverage'}</Pill></div>)}</>) : <Empty>Select or add mission skills to begin team composition.</Empty>}
          </div>
        </div>
      )}
      {tab === 'mentors' && (
        <div id="fleetMentors" className="mt-4">
          <h4 className="text-[14px]">Opt-in mentor discovery</h4>
          <p className="note">People appear only because their profile was deliberately shared with this team. Shared confidence is optional and not independently assessed. Contact/consent must be confirmed outside Synapse.</p>
          <Field label="Find shared expertise in" htmlFor="fleetMentorSkill"><Select id="fleetMentorSkill" className="w-[280px]" value={mentorSkill} onChange={setMentorSkill} options={SKILL_OPTIONS_SHORT} /></Field>
          <div id="fleetMentorMatches" className="mt-3 space-y-1.5">
            {mentors.length ? mentors.map((p) => { const r = p.surveys[mentorSkill]; return <div key={p.id} className="row-card"><div><strong className="block text-[13px]">{p.name}</strong><small className="text-quiet">{skillName(mentorSkill)} · reviewed mention{p.synthetic ? ' · SYNTHETIC' : ''}{p.mentorOptIn ? ' · mentoring opt-in shared' : ''}</small></div><Pill tone={r ? 'mint' : 'neutral'}>{r ? `Shared self-report ${r.confidence}/4 · ${r.method}` : 'Confidence not shared'}</Pill></div>; }) : <Empty>No peer has voluntarily shared a confirmed mention for this skill. This does not mean no expert exists.</Empty>}
          </div>
          <p className="note mt-2">{mentorMatches(people, mentorSkill).length} of these peers also opted in to mentoring for this topic. Open Workforce tools → MENTORLINK for the full directory.</p>
        </div>
      )}
      {tab === 'relay' && (
        <div id="fleetRelay" className="mt-4">
          <h4 className="text-[14px]">Knowledge transfer watchlist</h4>
          <p className="note">Highlights single-contributor and unrepresented skills, without predicting retirements, attrition, performance, or personal risk. Select priority skills to build a voluntary transfer plan.</p>
          <div id="fleetRelayList" className="mt-3 space-y-1.5">
            {watch.length ? watch.map((r) => <div key={r.id} className="row-card"><div><strong className="block text-[13px]">{skillName(r.id)}</strong><small className="text-quiet">{r.claimed.length === 0 ? 'Unrepresented in shared cards' : r.claimed.length === 1 ? 'Only one person has shared this skill' : 'Multiple shared mentions'}{r.claimed.length ? ` · ${r.claimed.map((p) => p.name).join(', ')}` : ''}</small></div><Pill>{r.independent.length} optional independent responses</Pill></div>) : <Empty>Set priority capabilities in the team area or add mission skills in Team composer to build a transfer watchlist.</Empty>}
          </div>
        </div>
      )}
      <p className="note mt-4">FLEETHACKER demo modules are offline-only. No automated qualification adjudication, personnel ranking, passive monitoring, or remote discovery. Production integrations would require consent, authoritative qualification checks, and access controls.</p>
    </Panel>
  );
}
