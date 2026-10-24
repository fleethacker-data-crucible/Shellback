/**
 * Team → Coverage additions: the contribution (stage) map and organization roll-ups.
 * Both operate only on what people chose to share; units under the minimum fold into their parent.
 */
import { useMemo, useState } from 'react';
import { DOMAINS, SKILL_BY_ID } from '../../core/taxonomy';
import { MIN_AGGREGATE, type Participant } from '../../core/analytics';
import { hasContribution, stageCoverage, stageObservations, PHASE_LABEL, STAGE_PHASES } from '../../core/contribution';
import { buildOrgTree, flattenOrg, type OrgNode } from '../../core/org';
import { BarRow, Button, Empty, Panel, PanelHeading, Pill, cn } from '../components/ui/primitives';

export function ContributionMap({ people }: { people: Participant[] }) {
  const sharers = people.filter((p) => hasContribution(p.contribution));
  const cov = stageCoverage(sharers);
  const notes = stageObservations(cov, sharers.length);
  return (
    <Panel id="contributionMap">
      <PanelHeading eyebrow="HOW THIS TEAM LIKES TO WORK" title="Energy by stage of work">
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
                    <small className="mt-1 block text-[11px] text-quiet">{r.energized.length ? r.energized.join(', ') : 'No one energized'}{r.drained.length ? ` · drains ${r.drained.length}` : ''}</small>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-quiet"><span><i className="mr-1 inline-block h-2 w-3 rounded-sm bg-mint align-middle" />energizes</span><span><i className="mr-1 inline-block h-2 w-3 rounded-sm bg-[#56708f] align-middle" />neutral</span><span><i className="mr-1 inline-block h-2 w-3 rounded-sm bg-amber align-middle" />drains</span></div>
          {notes.length > 0 && <ul id="contributionNotes" className="mt-3 space-y-1 text-[13px]">{notes.map((n) => <li key={n} className="rounded-md border border-stroke bg-panel2/50 px-3 py-2">{n}</li>)}</ul>}
        </>
      )}
    </Panel>
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
        <span style={{ paddingLeft: depth * 14 }} className="flex items-center gap-2"><span className="text-quiet">{depth > 0 ? '└' : '▸'}</span>{node.level} {node.code}<Pill>{node.all.length}</Pill>{node.all.length < MIN_AGGREGATE && <span className="text-[10px] text-quiet">rolls up</span>}</span>
      </Button>
      {node.children.map((c) => <OrgTreeNode key={c.code} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />)}
    </>
  );
}
