import { useEffect, useMemo, useState } from 'react';
import { DOMAINS, SKILLS, SKILL_BY_ID, skillsInDomain } from '../../core/taxonomy';
import { domainStats, visibleConfidence } from '../../core/analytics';
import type { Workspace } from '../../core/schema';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import { saveSurvey } from '../state/actions';
import { Button, Field, Panel, Select, SectionIntro, Textarea } from '../components/ui/primitives';
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

const CONFIDENCE = [['0', '0 — Not yet confident'], ['1', '1 — With substantial support'], ['2', '2 — With some support'], ['3', '3 — Confident with references'], ['4', '4 — Confident independently']].map(([value, label]) => ({ value: value!, label: label! }));
const PERFORMED = [['never', 'Not yet'], ['before', 'Previously'], ['recent', 'Within last 90 days (self-declared)']].map(([value, label]) => ({ value: value!, label: label! }));
const METHOD = [['none', 'Not yet performed'], ['independent', 'Independently'], ['ai', 'With approved AI assistance'], ['guided', 'With guidance / collaboration']].map(([value, label]) => ({ value: value!, label: label! }));

export function SpiderWebView() {
  const { ws, navigate, intent, consumeIntent, flash } = useStore();
  const act = useAction();
  const [domain, setDomain] = useState<number | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [form, setForm] = useState({ confidence: '', performed: '', method: '', note: '' });

  const confirmedSkills = useMemo(() => SKILLS.filter((s) => ws.profile.confirmed.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name)), [ws.profile.confirmed]);
  const pulseSkill = confirmedSkills.some((s) => s.id === selectedSkill) ? selectedSkill : confirmedSkills[0]?.id ?? '';

  // Cross-view intents: open a pulse for a skill, or focus a domain.
  useEffect(() => {
    if (!intent) return;
    if (intent.type === 'pulse') { const s = SKILL_BY_ID.get(intent.skillId); if (s) { setDomain(s.di); setSelectedSkill(s.id); } consumeIntent(); }
    else if (intent.type === 'radar-domain') { setDomain(intent.di); consumeIntent(); }
  }, [intent, consumeIntent]);

  // Load the previous answer whenever the pulse target changes.
  useEffect(() => {
    const v = ws.profile.surveys[pulseSkill];
    setForm({ confidence: v ? String(v.confidence) : '', performed: v?.performed ?? '', method: v?.method ?? '', note: v?.note ?? '' });
  }, [pulseSkill, ws.profile.surveys]);

  const items = domain === null ? domainWebItems(ws) : skillWebItems(ws, domain);
  const stats = { confirmed: ws.profile.confirmed.length, pending: ws.profile.candidates.length, confidence: Object.keys(ws.profile.surveys).filter((id) => ws.profile.confirmed.includes(id)).length };
  const done = ws.profile.confirmed.filter((id) => ws.profile.surveys[id]).length;
  const unrated = ws.profile.confirmed.filter((id) => !ws.profile.surveys[id]);
  const inspected = domain !== null && selectedSkill && SKILL_BY_ID.get(selectedSkill)?.di === domain ? SKILL_BY_ID.get(selectedSkill) : undefined;

  function select(i: number) {
    if (domain === null) { setDomain(i); return; }
    const item = items[i];
    if (item?.id) setSelectedSkill(item.id);
  }
  function nextUnrated() {
    if (!unrated.length) { flash('All confirmed skills have a confidence reflection. You can revisit any response.'); return; }
    const order = ws.profile.confirmed;
    const ix = order.indexOf(pulseSkill);
    const next = [...order.slice(ix + 1), ...order.slice(0, ix + 1)].find((id) => unrated.includes(id)) ?? unrated[0]!;
    setDomain(SKILL_BY_ID.get(next)?.di ?? null);
    setSelectedSkill(next);
  }

  return (
    <section id="radar" className="space-y-5">
      <SectionIntro eyebrow="EXPLORE / RADAR" title="Your skills spider web.">
        Attest to a skill to put it on the web. The more skills you confirm in a domain, the more that branch extends. A confidence pulse gives its node more brightness, glow, and prominence—without being required to create the web. Résumé keyword suggestions remain outside the web until you confirm them.
      </SectionIntro>
      <Panel className="radar-stage">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-extrabold tracking-[0.12em] text-quiet">
          <span>ATTESTED CAPABILITY WEB</span><span>Shape = confirmed skills · shine = self-reported confidence</span>
        </div>
        <div id="radarStatus" aria-live="polite" className="mb-3 flex flex-wrap gap-4 text-[13px] text-muted">
          <span><b className="text-text">{stats.confirmed}</b> confirmed experience</span>
          <span className="text-amber"><b>{stats.pending}</b> résumé candidates</span>
          <span><b className="text-text">{stats.confidence}</b> optional confidence ratings</span>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div id="radarBreadcrumb" className="flex items-center gap-2 text-[13px]">
            <Button id="radarHome" size="sm" variant={domain === null ? 'primary' : 'secondary'} onClick={() => { setDomain(null); }}>All domains</Button>
            {domain !== null && <span className="text-muted">› {DOMAINS[domain]!.name}</span>}
          </div>
          <Button id="refreshRadar" size="sm" title="Rebuild the spider web from confirmed skills and confidence ratings" onClick={() => flash('Spider web refreshed from attested capabilities and optional confidence pulses.')}>↻ Refresh spider web</Button>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <div id="radarCanvas" className="rounded-lg border border-stroke bg-bg/50 p-2"><SpiderWeb items={items} uid="focus" onSelect={select} /></div>
          <div className="space-y-4">
            <div id="radarInfo" className="rounded-md border border-stroke bg-panel2/60 p-4 text-[13px]">
              {inspected ? (
                <>
                  <b>{inspected.name}</b>
                  <p className="mt-1 text-muted">{inspected.task}</p>
                  <p className="mt-2">{ws.profile.confirmed.includes(inspected.id)
                    ? (ws.profile.surveys[inspected.id] ? `Self-rated confidence: ${ws.profile.surveys[inspected.id]!.confidence}/4 · Execution: ${modeLabel(ws.profile.surveys[inspected.id]!.method)} · Updated: ${ws.profile.surveys[inspected.id]!.updated}` : 'Skill attested. Confidence not yet rated.')
                    : 'Not attested. Confirm this skill before recording confidence.'}</p>
                  <Button id="radarAnswer" size="sm" className="mt-3" onClick={() => ws.profile.confirmed.includes(inspected.id) ? setSelectedSkill(inspected.id) : navigate('profile', { type: 'manual-add', skillId: inspected.id })}>
                    {ws.profile.confirmed.includes(inspected.id) ? (ws.profile.surveys[inspected.id] ? 'Update confidence' : 'Rate confidence') : 'Confirm capability first'} ↗
                  </Button>
                </>
              ) : domain === null ? (
                <><b>Your attested spider web</b><p className="mt-1 text-muted">Each mint branch shows capabilities you have confirmed. Web breadth reflects how many skills you attested in that discipline. A confidence pulse makes its node bigger and brighter; unrated confirmed skills stay visible. Amber rings mark suggestions awaiting confirmation.</p></>
              ) : (
                <><b>Inspect a capability</b><p className="mt-1 text-muted">Only confirmed capabilities enter your web. Optional task confidence increases node prominence. Suggestions remain outside the web until you attest to them.</p></>
              )}
            </div>

            <Panel id="pulsePanel" aria-label="Confidence pulse" className="p-4">
              <div className="eyebrow">ON THIS WEB / REFLECT</div>
              <h3 className="mt-1 text-[16px]">Confidence pulse</h3>
              <p className="mt-1 text-[12px] text-muted">Select a confirmed skill from your web to reflect on it. Self-rated confidence changes brightness, not whether you have claimed the skill.</p>
              <div id="surveyForm">
                <p id="surveyAttestationHint" aria-live="polite" className="note mt-2">{confirmedSkills.length ? `${confirmedSkills.length} employee-confirmed skill${confirmedSkills.length === 1 ? '' : 's'} eligible for a confidence pulse. Other taxonomy skills cannot be surveyed until you attest to them.` : 'Confirm a skill from your résumé suggestions or add one manually to unlock its confidence pulse.'}</p>
                <Field label="Choose one of my confirmed skills" htmlFor="surveySkill">
                  <Select id="surveySkill" value={pulseSkill} onChange={setSelectedSkill} disabled={!confirmedSkills.length} placeholder={confirmedSkills.length ? 'Select a confirmed skill' : 'Confirm a capability first'} options={confirmedSkills.map((s) => ({ value: s.id, label: `${s.name} · ${s.domain}` }))} />
                </Field>
                <div id="surveyQuestion" className="mt-2 rounded-md border border-mint/30 bg-mint/5 px-3 py-2 text-[13px]">{pulseSkill ? `How confident are you that you could: ${SKILL_BY_ID.get(pulseSkill)!.task}` : 'Attest to a skill first. You can only rate tasks tied to confirmed capabilities.'}</div>
                <Field label="How confident are you that you could do this task today?" htmlFor="confidence"><Select id="confidence" value={form.confidence} onChange={(v) => setForm({ ...form, confidence: v })} disabled={!pulseSkill} placeholder="Choose a response" options={CONFIDENCE} /></Field>
                <Field label="Have you performed this task?" htmlFor="performed"><Select id="performed" value={form.performed} onChange={(v) => setForm({ ...form, performed: v, method: v === 'never' ? 'none' : form.method === 'none' ? '' : form.method })} disabled={!pulseSkill} placeholder="Choose experience" options={PERFORMED} /></Field>
                <Field label="How was it performed?" htmlFor="method"><Select id="method" value={form.method} onChange={(v) => setForm({ ...form, method: v })} disabled={!pulseSkill} placeholder="Choose execution mode" options={METHOD} /></Field>
                <Field label="Optional context (local only)" htmlFor="surveyNote"><Textarea id="surveyNote" rows={2} value={form.note} onChange={(v) => setForm({ ...form, note: v })} disabled={!pulseSkill} placeholder="What did you work on? Avoid sensitive details." /></Field>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button id="saveSurvey" variant="primary" disabled={!pulseSkill} onClick={() => act((d) => saveSurvey(d, pulseSkill, form))}>Save confidence pulse</Button>
                  <Button id="pulseNext" disabled={!ws.profile.confirmed.length || !unrated.length} onClick={nextUnrated}>Next unrated skill ↗</Button>
                </div>
                <p id="pulseProgress" aria-live="polite" className="note mt-2">{ws.profile.confirmed.length ? `${done} of ${ws.profile.confirmed.length} confirmed skills have a confidence reflection. Unrated skills remain visible on your web.` : 'Attest to a capability to activate its confidence pulse.'}</p>
                <small className="note block">This does not validate qualifications, credential status, or access permissions.</small>
              </div>
            </Panel>

            <div id="radarSkillList" className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1">
              {items.map((it, i) => (
                <button key={it.id ?? it.name} type="button" data-radar-item={i} onClick={() => select(i)} className="row-card text-left hover:border-mint/50">
                  <span><b className="block text-[13px]">{it.name}</b><small className="text-quiet">{it.value === null ? 'Confidence unrated' : `${it.value.toFixed(1)} / 4`}{it.claimed ? ` · ${it.claimed} confirmed` : ''}{it.pending ? ` · ${it.pending} suggested` : ''}</small></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </section>
  );
}
