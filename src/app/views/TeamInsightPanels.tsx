/**
 * Team → Coverage additions: the contribution (stage) map and organization roll-ups.
 * Both operate only on what people chose to share; units under the minimum fold into their parent.
 */
import { useMemo, useState } from 'react';
import { DOMAINS, SKILL_BY_ID } from '../../core/taxonomy';
import { MIN_AGGREGATE, type Participant } from '../../core/analytics';
import { hasContribution, stageCoverage, stageObservations, PHASE_LABEL, STAGE_PHASES, QUADRANT_LABEL, QUADRANT_DETAIL, type Quadrant } from '../../core/contribution';
import { QUADRANT_TONE } from '../components/ContributionCard';
import { buildOrgTree, flattenOrg, type OrgNode } from '../../core/org';
import { BarRow, Button, Empty, Panel, PanelHeading, Pill, cn } from '../components/ui/primitives';
import { printSheet } from '../lib/print';
import { recommendCrossTraining, recommendPairs } from '../../core/recommend';
import { TrustChip } from '../components/TrustChip';

export function ContributionMap({ people, teamName = 'Team' }: { people: Participant[]; teamName?: string }) {
  const sharers = people.filter((p) => hasContribution(p.contribution));
  const cov = stageCoverage(sharers);
  const notes = stageObservations(cov, sharers.length);
  const pairings = cov.filter((r) => r.drained.length > 0 && r.energized.length > 0).map((r) => ({ stage: r.stage, from: r.drained, to: r.energized }));
  return (
    <Panel id="contributionMap">
      <PanelHeading eyebrow="HOW THIS TEAM LIKES TO WORK" title="Energy by stage of work"
        action={sharers.length >= MIN_AGGREGATE ? <Button size="sm" id="workshopPrint" onClick={() => printSheet('workshopSheet')}>Print workshop sheet</Button> : undefined}>
        From the {sharers.length} of {people.length} people who shared contribution preferences. Preference is not ability: someone can be excellent at a stage that drains them.
      </PanelHeading>
      {sharers.length < MIN_AGGREGATE ? (
        <Empty>Shown once at least {MIN_AGGREGATE} people have shared their preferences ({sharers.length} so far).</Empty>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            {STAGE_PHASES.map((phase) => (
              <div key={phase} className="rounded-md border border-stroke bg-panel2/40 p-3">
                <div className="eyebrow mb-2">{PHASE_LABEL[phase]}</div>
                {cov.filter((r) => r.stage.phase === phase).map((r) => (
                  <div key={r.stage.id} data-stage-row={r.stage.id} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between gap-2"><strong className="text-[13px]">{r.stage.label}</strong><Pill tone={r.energized.length === 0 ? 'amber' : r.energized.length === 1 ? 'neutral' : 'mint'}>{r.energized.length} energized</Pill></div>
                    <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-bg/80" aria-hidden="true">
                      <i className="bg-mint" style={{ width: `${(r.energized.length / sharers.length) * 100}%` }} />
                      <i className="bg-[#56708f]" style={{ width: `${(r.neutral.length / sharers.length) * 100}%` }} />
                      <i className="bg-amber" style={{ width: `${(r.drained.length / sharers.length) * 100}%` }} />
                    </div>
                    <small className="mt-1 block text-[12px] text-quiet">{r.energized.length ? r.energized.join(', ') : 'No one energized'}{r.drained.length ? ` · drains ${r.drained.length}` : ''}</small>
                    <div className="mt-1 flex flex-wrap gap-1" data-quadrants={r.stage.id}>
                      {(['flow', 'growth', 'grind', 'avoid'] as Quadrant[]).filter((q) => r.quadrants[q].length).map((q) => <Pill key={q} tone={QUADRANT_TONE[q]} title={`${QUADRANT_DETAIL[q]} — ${r.quadrants[q].join(', ')}`}>{QUADRANT_LABEL[q]} {r.quadrants[q].length}</Pill>)}
                      {r.quadrants.unknown.length > 0 && r.quadrants.unknown.length === r.energized.length + r.drained.length && <small className="text-[12px] text-quiet">energy only · no fluency shared</small>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-quiet"><span><i className="mr-1 inline-block h-2 w-3 rounded-sm bg-mint align-middle" />energizes</span><span><i className="mr-1 inline-block h-2 w-3 rounded-sm bg-[#56708f] align-middle" />neutral</span><span><i className="mr-1 inline-block h-2 w-3 rounded-sm bg-amber align-middle" />drains</span><span>· <b>Flow</b> energized + practiced · <b>Growth edge</b> energized, learning · <b>Grind</b> practiced, drained · <b>Avoid / pair</b> neither</span></div>
          {notes.length > 0 && <ul id="contributionNotes" className="mt-3 space-y-1 text-[13px]">{notes.map((n) => <li key={n} className="rounded-md border border-stroke bg-panel2/50 px-3 py-2">{n}</li>)}</ul>}
          {pairings.length > 0 && (
            <div id="contributionPairings" className="mt-3 rounded-md border border-stroke bg-panel2/40 p-3 text-[13px]">
              <strong className="block text-[12px] uppercase tracking-wider text-quiet">Pairing ideas</strong>
              <p className="note">Where a stage drains someone, a teammate it energizes can take the lead or pair up. Suggestions, not assignments.</p>
              <ul className="mt-2 space-y-1">{pairings.map((p) => <li key={p.stage.id} data-pairing={p.stage.id}><b>{p.stage.label}</b>: {p.from.join(', ')} could lean on {p.to.join(', ')}.</li>)}</ul>
            </div>
          )}
          <WorkshopSheet teamName={teamName} cov={cov} sharers={sharers.length} total={people.length} notes={notes} />
        </>
      )}
    </Panel>
  );
}

/** Printable one-pager for a team conversation. Rendered hidden; printSheet() shows only this. */
function WorkshopSheet({ teamName, cov, sharers, total, notes }: { teamName: string; cov: ReturnType<typeof stageCoverage>; sharers: number; total: number; notes: string[] }) {
  return (
    <section id="workshopSheet" data-print-sheet aria-hidden="true">
      <h1>{teamName} · How we like to work</h1>
      <p className="sheet-mute">Printed from Shellback on {new Date().toISOString().slice(0, 10)}. {sharers} of {total} people shared their preferences. Preference is not ability; this sheet is for a conversation, not an evaluation.</p>
      <h2>Energy by stage</h2>
      <table>
        <thead><tr><th>Stage</th><th>Energizes</th><th>Neutral</th><th>Drains</th><th>Flow / Growth / Grind / Avoid</th></tr></thead>
        <tbody>{cov.map((r) => <tr key={r.stage.id}><td><b>{r.stage.label}</b><br /><span className="sheet-mute">{r.stage.detail}</span></td><td>{r.energized.join(', ') || '—'}</td><td>{r.neutral.join(', ') || '—'}</td><td>{r.drained.join(', ') || '—'}</td><td>{(['flow', 'growth', 'grind', 'avoid'] as Quadrant[]).map((q) => r.quadrants[q].length ? `${QUADRANT_LABEL[q]}: ${r.quadrants[q].join(', ')}` : '').filter(Boolean).join(' · ') || '—'}</td></tr>)}</tbody>
      </table>
      {notes.length > 0 && <><h2>What stands out</h2><ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul></>}
      <h2>Talk about it (20 minutes)</h2>
      <ol>
        <li>Each person: which stage energizes you most, and when did the team last let you do it?</li>
        <li>Which stage does nobody here love? Who carries it today, and is that sustainable?</li>
        <li>Anyone in <b>Grind</b> (good at it, drained by it)? What would it take to share that load? Anyone on a <b>Growth edge</b> who could pair with someone in <b>Flow</b>?</li>
        <li>Pick one upcoming piece of work. Who takes the lead at each stage, based on energy rather than title?</li>
        <li>What is one hand-off between stages that keeps going wrong?</li>
      </ol>
      <h2>Agreements</h2>
      <div className="sheet-box" />
      <p className="sheet-mute">Shellback records only what each person chose to share. Nothing on this page is a score or a ranking.</p>
    </section>
  );
}

export function OrgRollup({ people }: { people: Participant[] }) {
  const tree = useMemo(() => buildOrgTree(people), [people]);
  const units = useMemo(() => flattenOrg(tree), [tree]);
  const [selected, setSelected] = useState<string>('');
  const withCode = people.filter((p) => p.orgCode).length;
  const node = units.find((u) => u.code === selected) ?? units[0];
  if (!withCode) {
    return (
      <Panel id="orgRollup">
        <PanelHeading eyebrow="BY ORGANIZATION" title="Coverage by unit">Appears when people share an org code (My profile → Skills → Organization code, then the consent checkbox or the export checkbox).</PanelHeading>
        <Empty>No one in this team has shared an organization code yet.</Empty>
      </Panel>
    );
  }
  const visible = node ? node.all : [];
  const allowed = visible.length >= MIN_AGGREGATE;
  const counts = DOMAINS.map((d) => visible.filter((p) => p.skills.some((id) => SKILL_BY_ID.get(id)?.di === d.index)).length);
  return (
    <Panel id="orgRollup">
      <PanelHeading eyebrow="BY ORGANIZATION" title="Coverage by unit">
        {withCode} of {people.length} people shared a code. The tree below is derived from those codes. A unit with fewer than {MIN_AGGREGATE} people shows no numbers of its own; read its parent instead.
      </PanelHeading>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div id="orgTree" className="space-y-1">{tree.map((n) => <OrgTreeNode key={n.code} node={n} depth={0} selected={node?.code ?? ''} onSelect={setSelected} />)}</div>
        <div className="rounded-md border border-stroke bg-panel2/40 p-3">
          {node ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[14px]">{node.level} {node.code}</strong><Pill tone={allowed ? 'mint' : 'amber'}>{visible.length} people{node.children.length ? ' incl. sub-units' : ''}</Pill></div>
              {node.direct.some((p) => p.orgTitle) && <p className="note mt-1">{node.direct.filter((p) => p.orgTitle).map((p) => `${p.name} · ${p.orgTitle}`).join(' · ')}</p>}
              <div id="orgUnitBars" className="mt-3">
                {allowed ? DOMAINS.map((d) => <BarRow key={d.index} label={d.name} value={counts[d.index] ?? 0} max={visible.length} />) : <Empty>Fewer than {MIN_AGGREGATE} people here. Select the parent unit to see rolled-up coverage.</Empty>}
              </div>
            </>
          ) : <Empty>Select a unit.</Empty>}
        </div>
      </div>
    </Panel>
  );
}

function OrgTreeNode({ node, depth, selected, onSelect }: { node: OrgNode<Participant>; depth: number; selected: string; onSelect: (code: string) => void }) {
  return (
    <>
      <Button size="sm" variant={selected === node.code ? 'primary' : 'ghost'} full className={cn('justify-start border border-stroke', depth > 0 && 'border-l-0')} data-org-unit={node.code}
        onClick={() => onSelect(node.code)}>
        <span style={{ paddingLeft: depth * 14 }} className="flex items-center gap-2"><span className="opacity-70">{depth > 0 ? "└" : "▸"}</span>{node.level} {node.code}<Pill>{node.all.length}</Pill>{node.all.length < MIN_AGGREGATE && <span className="text-[12px] text-quiet">rolls up</span>}</span>
      </Button>
      {node.children.map((c) => <OrgTreeNode key={c.code} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />)}
    </>
  );
}

// ----------------------------------------------------------------------------- recommendations

export function RecommendationsPanel({ people, priorities }: { people: Participant[]; priorities: readonly string[] }) {
  const pairs = useMemo(() => recommendPairs(people), [people]);
  const cross = useMemo(() => recommendCrossTraining(people, priorities), [people, priorities]);
  const sharers = people.filter((p) => hasContribution(p.contribution)).length;
  return (
    <Panel id="teamRecommendations">
      <PanelHeading eyebrow="SUGGESTIONS FOR THE LEAD" title="Who might work well together, and who could pick up what">
        Computed from shared skills and contribution preferences only; every suggestion shows its reasons. Pairing and training are conversations to have, not assignments to make. <TrustChip kind="aggregate" />
      </PanelHeading>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h4 className="text-[14px]">Recommended pairs</h4>
          <p className="note">Complementary energy across the stages of work, a flow ↔ growth-edge match, or both — plus a shared domain to talk in.</p>
          <div id="teamPairs" className="mt-2 space-y-2">
            {people.length < MIN_AGGREGATE ? <Empty>Needs at least {MIN_AGGREGATE} people.</Empty> : sharers < 2 ? <Empty>Needs at least two people who shared contribution preferences ({sharers} so far).</Empty> : pairs.length ? pairs.map((p) => (
              <div key={`${p.a.id}|${p.b.id}`} data-pair className="rounded-md border border-stroke bg-panel2/50 px-3 py-2 text-[13px]">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong>{p.a.name} + {p.b.name}</strong><Pill tone="mint">fit {Math.round(p.score)}</Pill></div>
                <ul className="mt-1 list-disc pl-5 text-[12px] text-muted">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            )) : <Empty>No strongly complementary pairs yet. More answered stages make this sharper.</Empty>}
          </div>
        </div>
        <div>
          <h4 className="text-[14px]">Recommended cross-training</h4>
          <p className="note">Skills held by one person (or priorities nobody holds), and who could realistically learn them next.</p>
          <div id="teamCrossTraining" className="mt-2 space-y-2">
            {people.length < MIN_AGGREGATE ? <Empty>Needs at least {MIN_AGGREGATE} people.</Empty> : cross.length ? cross.map((c) => (
              <div key={c.skillId} data-cross-training={c.skillId} className="rounded-md border border-stroke bg-panel2/50 px-3 py-2 text-[13px]">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong>{c.skillName}</strong><span className="text-[12px] text-quiet">{c.holder ? `only ${c.holder.name}` : 'nobody yet · priority'}</span></div>
                <ul className="mt-1 space-y-1 text-[12px]">{c.candidates.map((k) => <li key={k.person.id}><b>{k.person.name}</b> <span className="text-muted">— {k.reasons.join('; ')}</span></li>)}</ul>
              </div>
            )) : <Empty>No single-holder skills with a plausible learner. That is a healthy sign.</Empty>}
          </div>
        </div>
      </div>
    </Panel>
  );
}
