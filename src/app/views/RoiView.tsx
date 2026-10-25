/**
 * Program → ROI laboratory. Four benefit lanes, two cost lanes, cash kept apart from capacity,
 * every input tagged with how well it is known. Built to survive a budget reviewer, not to impress.
 */
import { useMemo } from 'react';
import { ROI_DEFAULTS, ROI_PERCENT_KEYS, ROI_BASES, type RoiBasis, type RoiKey } from '../../core/schema';
import { ROI_BASIS_LABEL, ROI_FIELDS, ROI_LANES, roiScenario } from '../../core/roi';
import { useStore } from '../state/store';
import { Button, Notice, Panel, PanelHeading, Pill, SectionIntro } from '../components/ui/primitives';
import { money } from '../lib/options';
import { printSheet } from '../lib/print';

const BASIS_TONE: Record<RoiBasis, 'neutral' | 'amber' | 'mint'> = { assumed: 'amber', benchmark: 'neutral', measured: 'mint' };

export function RoiView() {
  const { ws, update } = useStore();
  const p = ws.roi;
  const basis = ws.roiBasis;
  const base = useMemo(() => roiScenario(p, 1, basis), [p, basis]);
  const lower = useMemo(() => roiScenario(p, 0.5, basis), [p, basis]);
  const higher = useMemo(() => roiScenario(p, 1.25, basis), [p, basis]);
  const setInput = (key: RoiKey, raw: string) => {
    const val = Number(raw);
    if (!Number.isFinite(val) || val < 0) return;
    update((d) => { d.roi[key] = Math.min(val, ROI_PERCENT_KEYS.has(key) ? 100 : 100_000_000); });
  };
  const setBasis = (key: RoiKey, b: RoiBasis) => update((d) => { d.roiBasis[key] = b; });
  const cashLanes = base.lanes.filter((l) => l.kind === 'cash');
  const capLanes = base.lanes.filter((l) => l.kind === 'capacity');
  const measuredCount = (Object.keys(ROI_DEFAULTS) as RoiKey[]).filter((k) => basis[k] === 'measured').length;
  const assumedPct = Math.round(base.assumedShare * 100);

  return (
    <section id="roi" className="space-y-5">
      <SectionIntro eyebrow="BUSINESS CASE / SCENARIO MODEL" title="Cash that stops leaving, kept apart from hours that come back.">
        Four things Shellback changes — outside expertise bought, training duplicated, credentials lapsing, time spent finding people — against what it costs to run. Only <b>cash</b> is set against platform cost; recovered hours are shown but never counted as money. Tag each input with how you know it; the result tells you how much rests on guesses.
      </SectionIntro>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Panel>
          <PanelHeading title="Inputs, by lane" action={<span className="flex gap-2"><Button id="printRoi" size="sm" onClick={() => printSheet('roiSheet')}>Print assumptions</Button><Button id="resetRoi" size="sm" onClick={() => update((d) => { d.roi = { ...ROI_DEFAULTS }; d.roiBasis = {}; return 'Scenario restored to illustrative defaults.'; })}>Reset</Button></span>}>
            <span id="roiBasisSummary"><Pill tone={assumedPct > 50 ? 'amber' : assumedPct > 0 ? 'neutral' : 'mint'}>{assumedPct}% of inputs assumed</Pill> <span className="ml-2">{measuredCount} measured.</span></span>
          </PanelHeading>
          <div id="roiInputs" className="space-y-4">
            {ROI_LANES.map((lane) => (
              <fieldset key={lane} className="rounded-md border border-stroke bg-panel2/40 p-3" data-roi-lane={lane}>
                <legend className="eyebrow px-1">{lane}</legend>
                <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {(Object.keys(ROI_FIELDS) as RoiKey[]).filter((k) => ROI_FIELDS[k].lane === lane).map((k) => {
                    const f = ROI_FIELDS[k];
                    const b = basis[k] ?? 'assumed';
                    return (
                      <label key={k} className="block text-[12px] text-muted">
                        <span className="field-label mt-1 flex items-center justify-between gap-2"><span>{f.label}</span>
                          <select aria-label={`${f.label}: basis`} data-roi-basis={k} value={b} className={`rounded-full border px-1.5 py-[1px] text-[10px] font-bold ${b === 'measured' ? 'border-mint/50 text-mint' : b === 'benchmark' ? 'border-stroke text-muted' : 'border-amber/50 text-amber'} bg-bg/60`} onChange={(e: { target: { value: string } }) => setBasis(k, e.target.value as RoiBasis)}>
                            {ROI_BASES.map((x) => <option key={x} value={x}>{ROI_BASIS_LABEL[x]}</option>)}
                          </select>
                        </span>
                        <span className="flex items-center gap-2">
                          <input type="number" min={0} step={f.unit === '%' ? 1 : 'any'} className="control" data-roi={k} value={p[k]} aria-label={f.label} onChange={(e: { target: { value: string } }) => setInput(k, e.target.value)} />
                          <small className="w-14 text-quiet">{f.unit}</small>
                        </span>
                        {f.hint && <small className="block text-[11px] text-quiet">{f.hint}</small>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <div className="eyebrow">CASH · WHAT STOPS LEAVING PER YEAR</div>
            <div id="roiCash" className="mt-1 text-[40px] font-extrabold leading-none text-mint">{money.format(base.cash)}</div>
            <p className="note mt-1">{Math.round(base.people).toLocaleString()} of {Number(p.employees).toLocaleString()} people adopting.</p>
            <div id="roiCashLanes" className="mt-3 space-y-1 text-[13px]">
              {cashLanes.map((l) => <div key={l.id} data-roi-lane-row={l.id} className="flex justify-between gap-3 border-b border-stroke/60 py-1"><span><span className="text-text">{l.label}</span><small className="block text-[11px] text-quiet">{l.detail}</small></span><b>{money.format(l.value)}</b></div>)}
            </div>
            <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1 text-[13px]">
              <dt className="text-muted">Platform cost per year</dt><dd id="roiCost" className="font-bold">{money.format(base.platformCost)}</dd>
              <dt className="text-muted">Net cash after platform cost</dt><dd id="roiNet" className={`font-bold ${base.netCash < 0 ? 'text-danger' : 'text-mint'}`}>{money.format(base.netCash)}</dd>
              <dt className="text-muted">Cash benefit ÷ platform cost</dt><dd id="roiMultiple" className="font-bold">{base.multiple === null ? 'n/a (no cost)' : `${base.multiple.toFixed(2)}×`}</dd>
              <dt className="text-muted">Break-even adoption</dt><dd id="roiBreakEven" className="font-bold">{base.breakEvenAdoption === null ? 'Not reached at 100%' : `${base.breakEvenAdoption.toFixed(0)}%`}</dd>
            </dl>
          </Panel>
          <Panel>
            <div className="eyebrow">CAPACITY · HOURS, NOT MONEY</div>
            <div id="roiCapacity" className={`mt-1 text-[28px] font-extrabold leading-none ${base.capacityNet < 0 ? 'text-amber' : 'text-text'}`}>{money.format(base.capacityNet)}<span className="ml-2 text-[13px] font-semibold text-quiet">net, at the loaded rate</span></div>
            <p className="note mt-1">Gross {money.format(base.capacityGross)} recovered, minus {money.format(base.capacitySpent)} of people's time Shellback itself consumes. Shown so nobody double-counts it as cash.</p>
            <div id="roiCapacityLanes" className="mt-3 space-y-1 text-[13px]">
              {capLanes.map((l) => <div key={l.id} data-roi-lane-row={l.id} className="flex justify-between gap-3 border-b border-stroke/60 py-1"><span><span className="text-text">{l.label}</span><small className="block text-[11px] text-quiet">{l.detail}</small></span><b className={l.value < 0 ? 'text-amber' : ''}>{l.value < 0 ? '−' : ''}{money.format(Math.abs(l.value))}</b></div>)}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <h3 className="text-[16px]">Adoption sensitivity · net cash</h3>
        <p className="text-[13px] text-muted">Every people-driven lane scales with adoption. A scenario range, not a forecast.</p>
        <div id="roiSensitivity" className="mt-3 grid gap-3 sm:grid-cols-3">
          {[[lower, 'Half the base adoption'], [base, 'Base'], [higher, '1.25× base (capped at 100%)']].map(([sc, label]) => { const s = sc as typeof base; return <div key={String(label)} className="rounded-md border border-stroke bg-panel2/60 p-3"><b className={`block text-[18px] ${s.netCash < 0 ? 'text-danger' : ''}`}>{money.format(s.netCash)}</b><span className="text-[12px] text-quiet">{String(label)} · {Math.round(s.people)} people</span></div>; })}
        </div>
      </Panel>

      <Notice>How to make this defensible: measure adoption from the pilot; take outside-expert hours and rates from contract records; get the cost of one real credential lapse; run a two-week diary for the "asking around" minutes. Mark each as <b>Measured</b> above. Never present capacity as savings, and never present a number with more than half its inputs assumed.</Notice>

      <section id="roiSheet" data-print-sheet aria-hidden="true">
        <h1>Shellback ROI scenario — assumptions</h1>
        <p className="sheet-mute">Printed {new Date().toISOString().slice(0, 10)}. {assumedPct}% of inputs are assumed, {measuredCount} measured. Capacity is hours at the loaded rate, not cash.</p>
        <h2>Result</h2>
        <table><tbody>
          <tr><td>Cash that stops leaving per year</td><td>{money.format(base.cash)}</td></tr>
          <tr><td>Platform cost per year</td><td>{money.format(base.platformCost)}</td></tr>
          <tr><td>Net cash</td><td>{money.format(base.netCash)}</td></tr>
          <tr><td>Break-even adoption</td><td>{base.breakEvenAdoption === null ? 'not reached' : `${base.breakEvenAdoption.toFixed(0)}%`}</td></tr>
          <tr><td>Net capacity (hours at loaded rate, not cash)</td><td>{money.format(base.capacityNet)}</td></tr>
        </tbody></table>
        <h2>Lanes</h2>
        <table><thead><tr><th>Lane</th><th>Kind</th><th>Value</th><th>How</th></tr></thead><tbody>{base.lanes.map((l) => <tr key={l.id}><td>{l.label}</td><td>{l.kind}</td><td>{l.value < 0 ? '−' : ''}{money.format(Math.abs(l.value))}</td><td>{l.detail}</td></tr>)}</tbody></table>
        <h2>Inputs</h2>
        <table><thead><tr><th>Input</th><th>Value</th><th>Basis</th></tr></thead><tbody>{(Object.keys(ROI_FIELDS) as RoiKey[]).map((k) => <tr key={k}><td>{ROI_FIELDS[k].label}</td><td>{p[k]} {ROI_FIELDS[k].unit}</td><td>{ROI_BASIS_LABEL[basis[k] ?? 'assumed']}</td></tr>)}</tbody></table>
      </section>
    </section>
  );
}
