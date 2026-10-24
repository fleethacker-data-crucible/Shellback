import { useEffect, useState } from 'react';
import { DOMAINS, SKILL_BY_ID, skillsInDomain } from '../../core/taxonomy';
import { domainStats, visibleConfidence } from '../../core/analytics';
import type { Workspace } from '../../core/schema';
import { useStore } from '../state/store';
import { Button, Panel, cn } from '../components/ui/primitives';
import { SkillActions, StatusChip, skillStatus } from '../components/SkillActions';
import { SpiderWeb, type WebItem } from '../viz/SpiderWeb';
import { modeLabel } from '../lib/options';

export function domainWebItems(ws: Workspace): WebItem[] {
  return DOMAINS.map((d) => {
    const group = skillsInDomain(d.index);
    return {
      name: d.name, short: d.short, id: `domain-${d.index}`, value: domainStats(ws, d.index).mean,
      claimed: group.filter((s) => ws.profile.confirmed.includes(s.id)).length,
      pending: group.filter((s) => ws.profile.candidates.includes(s.id)).length,
      capacity: group.length,
    };
  });
}
export function skillWebItems(ws: Workspace, di: number): WebItem[] {
  return skillsInDomain(di).map((s) => ({
    name: s.name, id: s.id, value: visibleConfidence(ws, s.id),
    claimed: Number(ws.profile.confirmed.includes(s.id)), pending: Number(ws.profile.candidates.includes(s.id)), capacity: 1,
  }));
}

export function SpiderWebView() {
  const { ws, intent, consumeIntent, flash, openPulse } = useStore();
  const [domain, setDomain] = useState<number | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string>('');

  useEffect(() => {
    if (intent?.type === 'radar-domain') { setDomain(intent.di); consumeIntent(); }
  }, [intent, consumeIntent]);

  const items = domain === null ? domainWebItems(ws) : skillWebItems(ws, domain);
  const stats = { confirmed: ws.profile.confirmed.length, pending: ws.profile.candidates.length, rated: ws.profile.confirmed.filter((id) => ws.profile.surveys[id]).length };
  const unrated = ws.profile.confirmed.filter((id) => !ws.profile.surveys[id]);
  const inspected = domain !== null && selectedSkill && SKILL_BY_ID.get(selectedSkill)?.di === domain ? SKILL_BY_ID.get(selectedSkill) : undefined;

  function select(i: number) {
    if (domain === null) { setDomain(i); setSelectedSkill(''); return; }
    const item = items[i];
    if (item?.id) setSelectedSkill(item.id);
  }

  return (
    <div id="radar" className="space-y-4">
      <div id="radarStatus" aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
        <div className="flex flex-wrap gap-4">
          <span><b className="text-text">{stats.confirmed}</b> confirmed</span>
          <span className="text-amber"><b>{stats.pending}</b> suggestions waiting</span>
          <span><b className="text-text">{stats.rated}</b> rated</span>
        </div>
        {unrated.length > 0 && <Button size="sm" variant="primary" id="pulseNext" onClick={() => openPulse()}>Rate {unrated.length} unrated skill{unrated.length === 1 ? '' : 's'}</Button>}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
        <Panel className="radar-stage p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-2">
            <div id="radarBreadcrumb" className="flex items-center gap-2 text-[13px]">
              <Button id="radarHome" size="sm" variant={domain === null ? 'primary' : 'secondary'} onClick={() => { setDomain(null); setSelectedSkill(''); }}>All domains</Button>
              {domain !== null && <span className="text-muted">› {DOMAINS[domain]!.name}</span>}
            </div>
            <Button id="refreshRadar" size="sm" variant="ghost" title="Redraw the web" onClick={() => flash('Spider web redrawn from your confirmed skills and optional confidence.')}>↻</Button>
          </div>
          <div id="radarCanvas"><SpiderWeb items={items} uid="focus" onSelect={select} /></div>
        </Panel>
        <div className="space-y-4">
          <div id="radarInfo" className="rounded-lg border border-stroke bg-panel p-4 text-[13px]">
            {inspected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-[15px]">{inspected.name}</b><StatusChip status={skillStatus(ws.profile, inspected.id)} rated={!!ws.profile.surveys[inspected.id] && ws.profile.confirmed.includes(inspected.id)} /></div>
                <p className="mt-1 text-muted">{inspected.task}</p>
                {ws.profile.confirmed.includes(inspected.id) && ws.profile.surveys[inspected.id] && (
                  <p className="mt-2 text-[12px]">Self-rated {ws.profile.surveys[inspected.id]!.confidence}/4 · {modeLabel(ws.profile.surveys[inspected.id]!.method)} · {ws.profile.surveys[inspected.id]!.updated}</p>
                )}
                <div className="mt-3"><SkillActions skillId={inspected.id} idPrefix="radar" /></div>
              </>
            ) : domain === null ? (
              <><b>How to read your web</b><p className="mt-1 text-muted">Each spoke is a domain. It extends as you confirm skills there; confidence makes nodes glow. Amber rings are suggestions waiting for you. Click a domain to see its skills.</p></>
            ) : (
              <><b>{DOMAINS[domain]!.name}</b><p className="mt-1 text-muted">Click a skill to confirm a suggestion, add it, or rate your confidence, right here.</p></>
            )}
          </div>
          <div id="radarSkillList" className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
            {items.map((it, i) => {
              const st = domain === null ? null : skillStatus(ws.profile, it.id ?? '');
              return (
                <button key={it.id ?? it.name} type="button" data-radar-item={i} onClick={() => select(i)}
                  className={cn('row-card text-left hover:border-mint/50', it.id === selectedSkill && 'border-mint/60', st === 'suggested' && 'border-amber/40')}>
                  <span><b className="block text-[13px]">{it.name}</b><small className="text-quiet">{domain === null ? `${it.claimed} confirmed${it.pending ? ` · ${it.pending} suggested` : ''}${it.value !== null ? ` · avg ${it.value.toFixed(1)}/4` : ''}` : st === 'confirmed' ? (it.value !== null ? `Confirmed · ${it.value}/4` : 'Confirmed · unrated') : st === 'suggested' ? 'Suggested · awaiting you' : 'Not in your profile'}</small></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
