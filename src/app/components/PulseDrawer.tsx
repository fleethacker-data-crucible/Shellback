/**
 * Confidence pulse as a side drawer. Opens from any skill anywhere (profile list, spider web,
 * galaxy, Home) so reflecting never means leaving the chart you are looking at.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SKILLS, SKILL_BY_ID } from '../../core/taxonomy';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import { ActionError, saveSurvey } from '../state/actions';
import { Button, Field, Select, Textarea, Pill } from './ui/primitives';

const CONFIDENCE = [['0', '0 — Not yet confident'], ['1', '1 — With substantial support'], ['2', '2 — With some support'], ['3', '3 — Confident with references'], ['4', '4 — Confident independently']].map(([value, label]) => ({ value: value!, label: label! }));
const PERFORMED = [['never', 'Not yet'], ['before', 'Previously'], ['recent', 'Within last 90 days (self-declared)']].map(([value, label]) => ({ value: value!, label: label! }));
const METHOD = [['none', 'Not yet performed'], ['independent', 'Independently'], ['ai', 'With approved AI assistance'], ['guided', 'With guidance / collaboration']].map(([value, label]) => ({ value: value!, label: label! }));

export function PulseDrawer() {
  const { ws, pulseFor, closePulse, flash, update } = useStore();
  const act = useAction();
  // The drawer is a modal <dialog> in the browser's top layer, which covers the global flash toast, so
  // every message the user needs while the drawer is open is shown inside it.
  const [notice, setNotice] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const ref = useRef<HTMLDialogElement | null>(null);
  const [skill, setSkillState] = useState('');
  const [form, setForm] = useState({ confidence: '', performed: '', method: '', note: '' });
  /** Select a skill and load its saved answer in the same render, so there is no window in which
   *  a value the user already entered could be reset by a later effect. */
  const setSkill = (id: string) => {
    const v = ws.profile.surveys[id];
    setSkillState(id);
    setNotice(null);
    setForm({ confidence: v ? String(v.confidence) : '', performed: v?.performed ?? '', method: v?.method ?? '', note: v?.note ?? '' });
  };

  const confirmed = useMemo(() => SKILLS.filter((s) => ws.profile.confirmed.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name)), [ws.profile.confirmed]);
  const unrated = ws.profile.confirmed.filter((id) => !ws.profile.surveys[id]);
  const done = ws.profile.confirmed.length - unrated.length;
  const open = pulseFor !== null;

  // Open/close the native dialog and pick the starting skill.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setSkill(pulseFor || unrated[0] || ws.profile.confirmed[0] || '');
      el.showModal();
    }
    if (!open && el.open) el.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pulseFor]);

  const s = SKILL_BY_ID.get(skill);
  const nextAfter = (id: string) => {
    const order = ws.profile.confirmed;
    const ix = order.indexOf(id);
    return [...order.slice(ix + 1), ...order.slice(0, ix + 1)].find((x) => x !== id && !ws.profile.surveys[x]);
  };
  function save(andNext: boolean) {
    let msg = '';
    try { update((d) => { msg = saveSurvey(d, skill, form); return undefined; }); }
    catch (err) { if (err instanceof ActionError) { setNotice({ tone: 'error', text: err.message }); return; } throw err; }
    void act; // kept for parity with other components
    if (andNext) {
      const n = nextAfter(skill);
      if (n) { setSkill(n); setNotice({ tone: 'ok', text: `Saved ${s?.name ?? 'skill'}. Next unrated skill loaded.` }); }
      else { flash('All confirmed skills now have a confidence reflection.'); closePulse(); }
    } else setNotice({ tone: 'ok', text: msg || 'Saved.' });
  }
  const missing = [!form.confidence && 'confidence', !form.performed && 'experience', !form.method && 'execution mode'].filter(Boolean) as string[];

  return (
    <dialog ref={ref} id="pulsePanel" aria-labelledby="pulse-title"
      className="m-0 ml-auto h-full max-h-none w-[min(100vw,440px)] border-0 border-l border-stroke bg-panel p-0 text-text shadow-panel backdrop:bg-black/50"
      onCancel={(e: { preventDefault(): void }) => { e.preventDefault(); closePulse(); }}>
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-3 border-b border-stroke p-5">
            <div>
              <div className="eyebrow">REFLECT · OPTIONAL</div>
              <h2 id="pulse-title" className="mt-1 text-[18px]">Confidence pulse</h2>
              <p id="pulseProgress" aria-live="polite" className="note mt-1">{done} of {ws.profile.confirmed.length} confirmed skills reflected. Unrated skills stay visible on your web.</p>
            </div>
            <Button size="icon" variant="ghost" aria-label="Close confidence pulse" onClick={closePulse} data-testid="pulse-close">✕</Button>
          </header>
          <div className="flex-1 overflow-y-auto p-5">
            <Field label="Confirmed skill" htmlFor="surveySkill">
              <Select id="surveySkill" value={skill} onChange={setSkill} options={confirmed.map((x) => ({ value: x.id, label: `${x.name}${ws.profile.surveys[x.id] ? '' : ' · unrated'}` }))} />
            </Field>
            {s && (
              <div id="surveyQuestion" className="mt-3 rounded-md border border-mint/30 bg-mint/5 px-3 py-2 text-[13px]">
                <div className="mb-1 flex flex-wrap gap-1"><Pill>{s.domain}</Pill>{ws.profile.surveys[s.id] ? <Pill tone="mint">Rated {ws.profile.surveys[s.id]!.updated}</Pill> : <Pill tone="amber">Unrated</Pill>}</div>
                How confident are you that you could: <b>{s.task}</b>
              </div>
            )}
            <Field label="How confident are you that you could do this task today?" htmlFor="confidence"><Select id="confidence" value={form.confidence} onChange={(v) => setForm({ ...form, confidence: v })} placeholder="Choose a response" options={CONFIDENCE} /></Field>
            <Field label="Have you performed this task?" htmlFor="performed"><Select id="performed" value={form.performed} onChange={(v) => setForm({ ...form, performed: v, method: v === 'never' ? 'none' : form.method === 'none' ? '' : form.method })} placeholder="Choose experience" options={PERFORMED} /></Field>
            <Field label="How was it performed?" htmlFor="method"><Select id="method" value={form.method} onChange={(v) => setForm({ ...form, method: v })} placeholder="Choose execution mode" options={METHOD} /></Field>
            <Field label="Optional context (stays in this browser)" htmlFor="surveyNote"><Textarea id="surveyNote" rows={3} value={form.note} onChange={(v) => setForm({ ...form, note: v })} placeholder="What did you work on? Avoid sensitive details." /></Field>
            <p className="note mt-3">Confidence changes how brightly a skill shines on your web. It is a self-report, not a qualification, credential, or access decision.</p>
            {notice && <p id="pulseNotice" role={notice.tone === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-md border px-3 py-2 text-[13px] ${notice.tone === 'error' ? 'border-danger/50 bg-danger/10 text-danger' : 'border-mint/40 bg-mint/10 text-mint'}`}>{notice.text}</p>}
          </div>
          <footer className="flex flex-wrap justify-end gap-2 border-t border-stroke p-4">
            {missing.length > 0 && <span id="pulseMissing" className="mr-auto self-center text-[12px] text-quiet">Still needed: {missing.join(', ')}</span>}
            <Button id="saveSurvey" onClick={() => save(false)}>Save</Button>
            <Button id="saveSurveyNext" variant="primary" onClick={() => save(true)}>{unrated.filter((x) => x !== skill).length ? 'Save & next unrated' : 'Save & finish'}</Button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
