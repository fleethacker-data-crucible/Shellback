import { useMemo, useState, type ReactNode } from 'react';
import { DOMAINS, SKILLS } from '../../core/taxonomy';
import { useStore } from '../state/store';
import { Button, Input, Panel, Select, SectionIntro } from '../components/ui/primitives';
import { Galaxy } from '../viz/Galaxy';
import { buildGalaxyModel } from '../viz/galaxy-model';
import { modeLabel } from '../lib/options';

export function GalaxyView() {
  const { ws, settings, setSettings, navigate } = useStore();
  const scope = settings.galaxyMode;
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const model = useMemo(() => buildGalaxyModel({ profile: ws.profile, pending: ws.profile.candidates, scope, filter, query }), [ws.profile, scope, filter, query]);
  const pathways = scope === 'pathways';
  const chosen = selected && model.displayed.has(selected) ? model.byId.get(selected) : undefined;
  const answer = chosen && ws.profile.confirmed.includes(chosen.s.id) ? ws.profile.surveys[chosen.s.id] : undefined;
  const relations = model.edges.filter((e) => model.displayed.has(e.a) && model.displayed.has(e.b)).length;
  const setScope = (mode: 'confirmed' | 'pathways') => { setSettings({ galaxyMode: mode }); setSelected(null); };

  return (
    <section id="graph" className="space-y-5">
      <SectionIntro eyebrow="EXPLORE / CAPABILITY GALAXY" title="Your skills galaxy, your choice.">
        <strong>Confirmed Skills</strong> shows only capabilities you have personally attested to—three confirmed Data Engineering skills means three nodes. <strong>Pathways</strong> reveals all 104 skills and potential connections for learning and exploration. Neither view implies independent verification.
      </SectionIntro>
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-extrabold tracking-[0.12em] text-quiet">
          <span>YOUR SKILL UNIVERSE</span><span>Confirmed = your actual attestations · Pathways = possibilities</span>
        </div>
        <div id="galaxyStatus" aria-live="polite" className="mb-3 flex flex-wrap gap-4 text-[13px] text-muted">
          {pathways ? (
            <><span><b className="text-text">{model.displayed.size}</b> possible pathways shown</span><span><b className="text-text">{model.counts.confirmed}</b> attested</span><span className="text-amber"><b>{model.counts.pending}</b> résumé suggestions</span><span>Explore all · click to inspect</span></>
          ) : (
            <><span><b className="text-text">{model.displayed.size}</b> confirmed nodes shown</span><span><b className="text-text">{model.activeDomains.size}</b> attested disciplines</span><span><b className="text-text">{model.counts.known}</b> confidence responses</span><span>No unconfirmed skill nodes</span></>
          )}
        </div>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Skill galaxy view" className="flex gap-1 rounded-md border border-stroke bg-bg/60 p-1">
            <Button size="sm" variant={!pathways ? 'primary' : 'ghost'} aria-pressed={!pathways} data-galaxy-mode="confirmed" onClick={() => setScope('confirmed')}>Confirmed Skills</Button>
            <Button size="sm" variant={pathways ? 'primary' : 'ghost'} aria-pressed={pathways} data-galaxy-mode="pathways" onClick={() => setScope('pathways')}>Pathways</Button>
          </div>
          <label className="text-[12px] text-muted">Domain<Select id="graphFilter" className="mt-1 w-[220px]" value={filter} onChange={(v) => { setFilter(v); setSelected(null); }} options={[{ value: 'all', label: 'All domains in this view' }, ...DOMAINS.map((d) => ({ value: String(d.index), label: d.name }))]} /></label>
          <label className="text-[12px] text-muted">Find a skill<Input id="graphSearch" type="search" className="mt-1 w-[220px]" value={query} onChange={setQuery} placeholder="e.g. SQL, AWS, training..." /></label>
          <Button id="graphReset" onClick={() => { setFilter('all'); setQuery(''); setSelected(null); setScope('confirmed'); }}>Reset galaxy</Button>
          <span className="note">Hover = inspect · Click = select · Hold + drag = rearrange · No idle movement</span>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
          <div id="graphSurface" className="galaxy-surface"><Galaxy model={model} selected={selected} onSelect={setSelected} reducedMotion={settings.reducedMotion} /></div>
          <div id="graphDetail" className="rounded-md border border-stroke bg-panel2/60 p-4 text-[13px]">
            {chosen ? (
              <>
                <div className="eyebrow">{pathways ? 'POSSIBLE CAPABILITY' : 'CONFIRMED CAPABILITY'}</div>
                <h3 className="mt-1 text-[18px]">{chosen.s.name}</h3>
                <p className="mt-1 text-muted">{chosen.s.task}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
                  <dt className="text-quiet">Discipline</dt><dd>{chosen.s.domain}</dd>
                  <dt className="text-quiet">Profile signal</dt><dd>{chosen.confirmed ? 'Employee-attested' : chosen.pending ? 'Unreviewed résumé suggestion' : 'Not attested · possible pathway'}</dd>
                  <dt className="text-quiet">Self-reported confidence</dt><dd>{answer ? `${answer.confidence}/4` : 'Not answered'}</dd>
                  <dt className="text-quiet">Execution mode</dt><dd>{answer ? modeLabel(answer.method) : 'Not reported'}</dd>
                  <dt className="text-quiet">Verification</dt><dd>Not independently verified</dd>
                </dl>
                <Button id="graphAction" size="sm" className="mt-3" onClick={() => chosen.confirmed ? navigate('radar', { type: 'pulse', skillId: chosen.s.id }) : navigate('profile', { type: 'manual-add', skillId: chosen.s.id })}>
                  {chosen.confirmed ? 'Reflect on this task ↗' : 'Review in my profile ↗'}
                </Button>
                {(() => {
                  const next = [...(model.adj.get(chosen.s.id) ?? [])].filter((x) => model.displayed.has(x)).slice(0, 12);
                  return next.length ? (
                    <section className="mt-4">
                      <h4 className="text-[13px]">Linked capabilities</h4>
                      <p className="note">Conceptual learning pathways, not observed coworker interactions.</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">{next.map((k) => <Button key={k} size="sm" variant="ghost" className="border border-stroke" data-related-skill={k} onClick={() => setSelected(k)}>{model.byId.get(k)!.s.name}</Button>)}</div>
                    </section>
                  ) : null;
                })()}
              </>
            ) : !pathways ? (model.attested.size ? (
              <>
                <div className="eyebrow">MY CONFIRMED SKILLS</div>
                <h3 className="mt-1 text-[16px]">Only your attested capabilities</h3>
                <p className="mt-1 text-muted">This view shows exactly the skills you confirmed—never adjacent, suggested, or unrelated skill nodes.</p>
                <p className="mt-2"><strong>{model.displayed.size} displayed</strong> of {model.attested.size} attested capabilities{query || filter !== 'all' ? ' after filters' : ''}.</p>
                <Button id="graphPathwayAction" size="sm" className="mt-3" onClick={() => setScope('pathways')}>Explore all pathways ↗</Button>
              </>
            ) : (
              <>
                <div className="eyebrow">BUILD YOUR GALAXY</div>
                <h3 className="mt-1 text-[16px]">No confirmed capabilities yet</h3>
                <p className="mt-1 text-muted">Attest to a skill in your profile to add its first star. Unreviewed résumé suggestions are not shown as confirmed skills.</p>
                <div className="mt-3 flex flex-wrap gap-2"><Button id="graphProfileAction" variant="primary" size="sm" onClick={() => navigate('profile')}>Confirm skills in my profile ↗</Button><Button id="graphPathwayAction" size="sm" onClick={() => setScope('pathways')}>Explore possible pathways ↗</Button></div>
              </>
            )) : (
              <>
                <div className="eyebrow">PATHWAYS · EXPLORE</div>
                <h3 className="mt-1 text-[16px]">Discover connected capabilities</h3>
                <p className="mt-1 text-muted">All {SKILLS.length} skills and their conceptual relationships are available here, including skills you have not attested to.</p>
                <p className="mt-2"><b>Mint rings</b> indicate your attestations. <b>Amber rings</b> mark résumé suggestions awaiting review. Unrated nodes are potential learning pathways, <strong>not claimed proficiency</strong>.</p>
              </>
            )}
          </div>
        </div>
        <div id="graphLegend" className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted">
          {pathways ? (
            <><Legend color="#5de7d2">{model.counts.confirmed} confirmed of {SKILLS.length} possible skills</Legend><Legend color="#f3bd76">{model.counts.pending} unreviewed suggestions</Legend><Legend color="#98aec6">Grey = possible pathway, not attested</Legend><Legend color="#e0ad79">Cross-domain links</Legend></>
          ) : (
            <><Legend color="#5de7d2">{model.counts.confirmed} attested skills in your profile</Legend><Legend color="#8bd0be">Branches connect attested capabilities only</Legend><Legend color="#98aec6">Confidence controls brightness, not presence</Legend></>
          )}
        </div>
        <p id="skyExplanation" aria-live="polite" className="note mt-2">
          {pathways
            ? `Pathways: ${model.displayed.size} possible skills across ${model.activeDomains.size} disciplines with ${relations} visible conceptual relationships. Only mint-ringed skills are attested; other nodes are possible learning routes.`
            : `Confirmed Skills: exactly ${model.displayed.size} of your ${model.counts.confirmed} attested skills shown across ${model.activeDomains.size} disciplines${filter !== 'all' || query ? ' after filters' : ''}. Only connections between confirmed, displayed skills are drawn.`}
        </p>
      </Panel>
    </section>
  );
}

function Legend({ color, children }: { color: string; children: ReactNode }) {
  return <span className="legend-item inline-flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />{children}</span>;
}
