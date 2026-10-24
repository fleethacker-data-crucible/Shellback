/**
 * "How I like to contribute": six stages of work, each marked energizing / neutral / draining.
 * Synapse's own neutral vocabulary; not an assessment. See core/contribution.ts.
 */
import { useRef, useState, type ChangeEvent } from 'react';
import { ENERGY, ENERGY_LABEL, PHASE_LABEL, STAGE_DEFS, STAGE_PHASES, importContribution, type Energy } from '../../core/contribution';
import { readFileText } from '../lib/files';
import { useStore } from '../state/store';
import { clearContribution, setContribution, setContributionSource, setContributionStage } from '../state/actions';
import { Button, Field, Input, Panel, PanelHeading, Pill, cn } from './ui/primitives';

const TONE: Record<Energy, string> = {
  energizing: 'border-mint/60 bg-mint/15 text-mint',
  neutral: 'border-stroke bg-panel2 text-text',
  draining: 'border-amber/60 bg-amber/10 text-amber',
};

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
        Optional and entirely yours. Work moves through six stages; most people are energized by a couple, drained by a couple, and neutral on the rest. This is about preference, not ability, and it never changes your skills or ratings.
      </PanelHeading>
      <div className="grid gap-3 lg:grid-cols-3">
        {STAGE_PHASES.map((phase) => (
          <div key={phase} className="rounded-md border border-stroke bg-panel2/40 p-3">
            <div className="eyebrow mb-2">{PHASE_LABEL[phase]}</div>
            <div className="space-y-3">
              {STAGE_DEFS.filter((s) => s.phase === phase).map((s) => {
                const current = c.stages[s.id];
                return (
                  <div key={s.id} data-stage={s.id}>
                    <strong className="block text-[13px]">{s.label}</strong>
                    <small className="block text-[11px] text-quiet">{s.detail}</small>
                    <div role="radiogroup" aria-label={s.label} className="mt-1.5 flex flex-wrap gap-1">
                      {ENERGY.map((e) => (
                        <button key={e} type="button" role="radio" aria-checked={current === e} data-energy={e}
                          className={cn('rounded-full border px-2.5 py-[3px] text-[11px] font-bold transition-colors', current === e ? TONE[e] : 'border-stroke text-muted hover:text-text')}
                          onClick={() => update((d) => setContributionStage(d, s.id, current === e ? null : e))}>
                          {ENERGY_LABEL[e]}
                        </button>
                      ))}
                    </div>
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
          <input ref={fileRef} id="contributionImportFile" type="file" accept=".csv,.json,.txt,text/csv,application/json,text/plain" className="sr-only" onChange={onImport} />
          <Button size="sm" id="contributionImport" onClick={() => fileRef.current?.click()} title="CSV 'stage,energy' or JSON; any vendor's export you have re-typed into that shape">Import results file…</Button>
        </div>
      </div>
      {importNote.length > 0 && <ul id="contributionImportNotes" className="note mt-2 list-disc pl-5">{importNote.slice(0, 6).map((n) => <li key={n}>{n}</li>)}</ul>}
      <p className="note mt-3">Shared with this browser's team tools only if you tick "contribution preferences" under Consent, and put on a peer card only if you tick it at export.</p>
    </Panel>
  );
}
