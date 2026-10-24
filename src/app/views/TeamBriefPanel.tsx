/**
 * Supervisor brief. Built from aggregate inputs only; the exact payload is shown before it is
 * generated so the supervisor can see there is nothing about an individual in it.
 */
import { useMemo, useState } from 'react';
import { DOMAINS, SKILLS, skillName } from '../../core/taxonomy';
import { MIN_AGGREGATE, renewalState, type Participant, type TeamAggregate } from '../../core/analytics';
import { hasContribution, stageCoverage } from '../../core/contribution';
import type { TeamBriefInput, TeamBrief } from '../../core/intelligence';
import { activeProvider } from '../../storage/intel-settings';
import { useStore } from '../state/store';
import { Button, Empty, Panel, PanelHeading, Pill } from '../components/ui/primitives';
import { TrustChip } from '../components/TrustChip';

export function buildBriefInput(teamName: string, people: Participant[], agg: TeamAggregate, priorities: readonly string[]): TeamBriefInput {
  const thin = SKILLS.filter((s) => (agg.skillCounts[s.id] ?? 0) === 1).map((s) => s.name);
  const sharers = people.filter((p) => hasContribution(p.contribution));
  const stages = sharers.length >= MIN_AGGREGATE ? stageCoverage(sharers).map((r) => ({ stage: r.stage.label, energized: r.energized.length, drained: r.drained.length, grind: r.quadrants.grind.length, growth: r.quadrants.growth.length })) : undefined;
  return {
    teamName, people: agg.n, domainCounts: [...agg.domainCounts], thinSkills: thin,
    priorities: priorities.map((id) => ({ skill: skillName(id), covered: agg.skillCounts[id] ?? 0 })),
    ...(stages ? { stages } : {}),
    renewalsSoon: 0,
  };
}

export function TeamBriefPanel({ teamName, people, agg, priorities }: { teamName: string; people: Participant[]; agg: TeamAggregate; priorities: readonly string[] }) {
  const { ws, navigate } = useStore();
  const [brief, setBrief] = useState<TeamBrief | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const provider = activeProvider().describe();
  const input = useMemo(() => {
    const base = buildBriefInput(teamName, people, agg, priorities);
    // Renewals: only the local user's own credentials have dates (peer cards carry names only).
    const soon = ws.profile.credentials.filter((c) => { const r = renewalState(c); return r.state === 'soon' || r.state === 'past'; }).length;
    return { ...base, renewalsSoon: soon };
  }, [teamName, people, agg, priorities, ws.profile.credentials]);

  async function generate() {
    setBusy(true); setError('');
    try { setBrief(await activeProvider().teamBrief(input)); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  return (
    <Panel id="teamBrief">
      <PanelHeading eyebrow="SUPERVISOR BRIEF" title={<>Plain-language summary <Pill tone={provider.offline ? 'mint' : 'amber'}>{provider.label}</Pill></>}
        action={<Button id="teamBriefGenerate" variant="primary" size="sm" disabled={!agg.allowed || busy} onClick={generate}>{busy ? 'Writing…' : brief ? 'Regenerate' : 'Write the brief'}</Button>}>
        Written from the aggregate numbers below and nothing else. It never names, ranks or scores a person. <TrustChip kind="aggregate" />
      </PanelHeading>
      {!agg.allowed ? <Empty>Available once {MIN_AGGREGATE} people have shared.</Empty> : (
        <>
          <details className="rounded-md border border-stroke bg-panel2/40 p-3 text-[12px]">
            <summary className="cursor-pointer font-bold">Exactly what the brief is built from{provider.offline ? '' : ` (and what is sent to ${provider.origin})`}</summary>
            <dl id="teamBriefInputs" className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-quiet">Team</dt><dd>{input.teamName} · {input.people} people</dd>
              <dt className="text-quiet">People per domain</dt><dd>{DOMAINS.map((d, i) => `${d.name.split(' ')[0]} ${input.domainCounts[i]}`).join(' · ')}</dd>
              <dt className="text-quiet">Single-holder skills</dt><dd>{input.thinSkills.length ? input.thinSkills.join(', ') : 'none'}</dd>
              <dt className="text-quiet">Priorities</dt><dd>{input.priorities.length ? input.priorities.map((p) => `${p.skill} (${p.covered})`).join(', ') : 'none set'}</dd>
              <dt className="text-quiet">Stages</dt><dd>{input.stages ? input.stages.map((s) => `${s.stage} +${s.energized}/−${s.drained}${s.grind ? ` grind ${s.grind}` : ''}`).join(' · ') : `not included (fewer than ${MIN_AGGREGATE} shared preferences)`}</dd>
              <dt className="text-quiet">Renewals ≤ 90 days</dt><dd>{input.renewalsSoon} (your own; peer cards carry no dates)</dd>
            </dl>
            {!provider.offline && <p className="note mt-2">Change the provider under <Button size="sm" variant="ghost" className="underline" onClick={() => navigate({ view: 'program', tab: 'intelligence' })}>Program → Intelligence</Button>.</p>}
          </details>
          {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
          {brief && (
            <article id="teamBriefText" className="mt-3 space-y-2 rounded-md border border-mint/30 bg-mint/5 p-4 text-[13px] leading-relaxed">
              {brief.text.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
              <p className="note">Generated by {brief.generatedBy} · self-reported, aggregate, not an assessment.</p>
              <div className="flex gap-2"><Button size="sm" onClick={() => { void navigator.clipboard?.writeText(brief.text); }}>Copy text</Button></div>
            </article>
          )}
        </>
      )}
    </Panel>
  );
}
