/**
 * "How I like to contribute": six stages of work, each marked energizing / neutral / draining.
 * Synapse's own neutral vocabulary; not an assessment. See core/contribution.ts.
 */
import { useRef, useState, type ChangeEvent } from 'react';
import { CONTEXT_TAGS, CONTEXT_TAG_LABEL, ENERGY_SCALE, ENERGY_SCORE_LABEL, FLUENCY_LABEL, FLUENCY_SCALE, PHASE_LABEL, QUADRANT_DETAIL, QUADRANT_LABEL, STAGE_DEFS, STAGE_PHASES, importContribution, quadrant, stageDetail, type EnergyScore, type Quadrant } from '../../core/contribution';
import { readFileText } from '../lib/files';
import { useStore } from '../state/store';
import { clearContribution, setContribution, setContributionSource, setContributionStage, setStageDetail } from '../state/actions';
import { Button, Field, Input, Panel, PanelHeading, Pill, cn } from './ui/primitives';

const ENERGY_TONE = (e: EnergyScore) => (e > 0 ? 'border-mint/60 bg-mint/15 text-mint' : e < 0 ? 'border-amber/60 bg-amber/10 text-amber' : 'border-stroke bg-panel2 text-text');
const ENERGY_KEY: Record<EnergyScore, string> = { [-2]: 'draining-2', [-1]: 'draining', 0: 'neutral', 1: 'energizing', 2: 'energizing-2' };
const ENERGY_SHORT: Record<EnergyScore, string> = { [-2]: 'Drains a lot', [-1]: 'Drains', 0: 'Neutral', 1: 'Energizes', 2: 'Energizes a lot' };
export const QUADRANT_TONE: Record<Quadrant, 'mint' | 'amber' | 'danger' | 'neutral'> = { flow: 'mint', growth: 'mint', grind: 'amber', avoid: 'neutral', steady: 'neutral', unknown: 'neutral' };

export function ContributionCard() {
  const { ws, update, flash } = useStore();
  const c = ws.profile.contribution;
  const answered = Object.keys(c.stages).length;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importNote, setImportNote] = useState<string[]>([]);
  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const r = importContribution(await readFileText(f, 256_000), c);
      if (!r.applied) { setImportNote(r.skipped.length ? r.skipped : ['Nothing in that file looked like a stage + energy pair.']); return; }
      update((d) => setContribution(d, r.contribution));
      setImportNote(r.skipped);
      flash(`${r.applied} stage preference${r.applied === 1 ? '' : 's'} imported. Review them below; you can change any of them.`);
    } catch (err) { flash(err instanceof Error ? err.message : 'Could not read that file.'); }
  }
  return (
    <Panel id="contributionCard">
      <PanelHeading eyebrow="HOW I LIKE TO CONTRIBUTE" title="Which stages of work give you energy?"
        action={answered > 0 ? <Button size="sm" variant="ghost" id="contributionClear" onClick={() => update(clearContribution)}>Clear</Button> : undefined}>
        Optional and entirely yours. Work moves through six stages. For each, say how it affects your <b>energy</b> and, if you like, how <b>practiced</b> you are: together they tell apart <i>Flow</i> (energized and practiced), a <i>Growth edge</i> (energized, still learning), <i>Grind</i> (good at it, drains you) and <i>Avoid / pair</i>. No fixed number of each; answer as many or as few as you want. It never changes your skills or ratings.
      </PanelHeading>
      <div className="grid gap-3 lg:grid-cols-3">
        {STAGE_PHASES.map((phase) => (
          <div key={phase} className="rounded-md border border-stroke bg-panel2/40 p-3">
            <div className="eyebrow mb-2">{PHASE_LABEL[phase]}</div>
            <div className="space-y-3">
              {STAGE_DEFS.filter((s) => s.phase === phase).map((s) => {
                const d = stageDetail(c, s.id);
                const q = quadrant(d);
                return (
                  <div key={s.id} data-stage={s.id} data-quadrant={q}>
                    <div className="flex items-start justify-between gap-2"><strong className="block text-[13px]">{s.label}</strong>{d && <Pill tone={QUADRANT_TONE[q]} className="shrink-0" title={QUADRANT_DETAIL[q]}>{QUADRANT_LABEL[q]}</Pill>}</div>
                    <small className="block text-[11px] text-quiet">{s.detail}</small>
                    <div role="radiogroup" aria-label={`${s.label}: energy`} className="mt-1.5 flex flex-wrap gap-1">
                      {ENERGY_SCALE.map((e) => (
                        <button key={e} type="button" role="radio" aria-checked={d?.energy === e} aria-label={ENERGY_SCORE_LABEL[e]} title={ENERGY_SCORE_LABEL[e]} data-energy={ENERGY_KEY[e]}
                          className={cn('rounded-full border px-2 py-[3px] text-[11px] font-bold transition-colors', d?.energy === e ? ENERGY_TONE(e) : 'border-stroke text-muted hover:text-text')}
                          onClick={() => update((w) => { if (d?.energy === e) setContributionStage(w, s.id, null); else setStageDetail(w, s.id, { energy: e }); })}>
                          {ENERGY_SHORT[e]}
                        </button>
                      ))}
                    </div>
                    {d && (
                      <div role="radiogroup" aria-label={`${s.label}: how practiced`} className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-quiet">Practiced?</span>
                        {FLUENCY_SCALE.map((f) => (
                          <button key={f} type="button" role="radio" aria-checked={d.fluency === f} data-fluency={f}
                            className={cn('rounded-full border px-2 py-[2px] text-[10.5px] font-bold transition-colors', d.fluency === f ? 'border-blue/60 bg-blue/15 text-text' : 'border-stroke text-muted hover:text-text')}
                            onClick={() => update((w) => setStageDetail(w, s.id, { fluency: d.fluency === f ? null : f }))}>
                            {FLUENCY_LABEL[f]}
                          </button>
                        ))}
                      </div>
                    )}
                    {d && (
                      <details className="mt-1 text-[11px]">
                        <summary className="cursor-pointer text-quiet hover:text-text">When, and an example {d.tags.length || d.example ? `(${[d.tags.length ? `${d.tags.length} tag${d.tags.length === 1 ? '' : 's'}` : '', d.example ? 'example' : ''].filter(Boolean).join(', ')})` : '(optional)'}</summary>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {CONTEXT_TAGS.map((t) => { const on = d.tags.includes(t); return <button key={t} type="button" aria-pressed={on} data-context-tag={t} className={cn('rounded-full border px-2 py-[2px] text-[10.5px]', on ? 'border-purple/60 bg-purple/15 text-text' : 'border-stroke text-muted hover:text-text')} onClick={() => update((w) => setStageDetail(w, s.id, { tags: on ? d.tags.filter((x) => x !== t) : [...d.tags, t] }))}>{CONTEXT_TAG_LABEL[t]}</button>; })}
                        </div>
                        <Input className="mt-1" aria-label={`${s.label}: a recent example`} data-stage-example={s.id} value={d.example} onChange={(v) => update((w) => setStageDetail(w, s.id, { example: v }))} maxLength={160} placeholder="A recent time this showed up (one line, no sensitive details)" />
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="Based on (optional)" htmlFor="contributionSource" hint="For example 'self-reflection', a team workshop, or the name of a results report you hold. Free text, in your words.">
          <Input id="contributionSource" value={c.source} onChange={(v) => update((d) => setContributionSource(d, v))} maxLength={160} placeholder="Where these preferences come from" />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={answered === 6 ? 'mint' : 'neutral'}>{answered} of 6 answered</Pill>
          <input ref={fileRef} id="contributionImportFile" type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain" className="sr-only" aria-label="Import contribution results file" onChange={onImport} />
          <Button size="sm" id="contributionImport" onClick={() => fileRef.current?.click()} title="CSV 'stage,energy' or JSON; any vendor's export you have re-typed into that shape">Import results file…</Button>
        </div>
      </div>
      {importNote.length > 0 && <ul id="contributionImportNotes" className="note mt-2 list-disc pl-5">{importNote.slice(0, 6).map((n) => <li key={n}>{n}</li>)}</ul>}
      <p className="note mt-3">Shared with this browser's team tools only if you tick "contribution preferences" under Consent, and put on a peer card only if you tick it at export.</p>
    </Panel>
  );
}
