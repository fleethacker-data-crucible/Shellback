import { ROI_PERCENT_KEYS, type RoiInputs } from '../../core/schema';
import { ROI_LABELS, roiScenario } from '../../core/roi';
import { ROI_DEFAULTS } from '../../core/schema';
import { useStore } from '../state/store';
import { Button, Notice, Panel, PanelHeading, SectionIntro } from '../components/ui/primitives';
import { money } from '../lib/options';

export function RoiView() {
  const { ws, update } = useStore();
  const p = ws.roi;
  const base = roiScenario(p), lower = roiScenario(p, 0.5), higher = roiScenario(p, 1.2);
  const rows: Array<[string, number]> = [
    ['Cash: duplicate training spend avoided', base.cashTraining],
    ['Cash: external specialist spend avoided', base.cashExternal],
    ['Capacity only: training hours recovered', base.trainingHours],
    ['Capacity only: workflow hours recovered (gross)', base.grossWorkflow],
    ['Less: overlapping capacity removed', -base.overlapDeduction],
  ];
  const setInput = (key: keyof RoiInputs, raw: string) => {
    const val = Number(raw);
    if (!Number.isFinite(val) || val < 0) return;
    update((d) => { d.roi[key] = Math.min(val, ROI_PERCENT_KEYS.has(key) ? 100 : 100_000_000); });
  };

  return (
    <section id="roi" className="space-y-5">
      <SectionIntro eyebrow="BUSINESS CASE / SCENARIO MODEL" title="Model cash savings separately from recovered time.">Adjust baseline, adoption, and overlap assumptions. Realized cash savings and the estimated value of recovered working time are reported separately. Numbers are scenario estimates, not budget authority.</SectionIntro>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeading title="Scenario inputs" action={<Button id="resetRoi" size="sm" onClick={() => update((d) => { d.roi = { ...ROI_DEFAULTS }; return 'Scenario restored to illustrative defaults.'; })}>Reset assumptions</Button>} />
          <div id="roiInputs" className="grid gap-x-4 sm:grid-cols-2">
            {(Object.keys(ROI_LABELS) as (keyof RoiInputs)[]).map((k) => {
              const [label, unit] = ROI_LABELS[k];
              return (
                <label key={k} className="block text-[12px] text-muted">
                  <span className="field-label">{label}</span>
                  <span className="flex items-center gap-2">
                    <input type="number" min={0} step={unit === '%' ? 1 : 'any'} className="control" data-roi={k} value={p[k]} aria-label={label} onChange={(e: { target: { value: string } }) => setInput(k, e.target.value)} />
                    <small className="w-14 text-quiet">{unit}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </Panel>
        <Panel>
          <div className="eyebrow">SCENARIO VALUE · CASH + NONCASH CAPACITY</div>
          <div id="roiTotal" className="mt-1 text-[40px] font-extrabold leading-none text-mint">{money.format(base.total)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-stroke bg-panel2/60 p-3"><span className="eyebrow block">Cash savings potential</span><strong id="roiCash" className="text-[20px]">{money.format(base.cash)}</strong></div>
            <div className="rounded-md border border-stroke bg-panel2/60 p-3"><span className="eyebrow block">Noncash capacity value</span><strong id="roiCapacity" className="text-[20px]">{money.format(base.capacity)}</strong></div>
          </div>
          <p id="roiAdoptionPeople" className="note mt-3">{Math.round(base.people).toLocaleString()} of {Number(p.employees).toLocaleString()} modeled</p>
          <div id="roiBreakdown" className="mt-3 space-y-1 text-[13px]">
            {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3 border-b border-stroke/60 py-1"><span className="text-muted">{label}</span><b>{value < 0 ? '−' : ''}{money.format(Math.abs(value))}</b></div>)}
          </div>
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-1 text-[13px]">
            <dt className="text-muted">Annual operating cost</dt><dd id="roiCost" className="font-bold">{money.format(base.cost)}</dd>
            <dt className="text-muted">Cash-only net after operating cost</dt><dd id="roiNet" className={`font-bold ${base.netCash < 0 ? 'text-danger' : 'text-mint'}`}>{money.format(base.netCash)}</dd>
            <dt className="text-muted">Cash-only benefit / operating cost</dt><dd id="roiMultiple" className="font-bold">{base.multiple === null ? 'Not defined (zero cost)' : `${base.multiple.toFixed(2)}×`}</dd>
          </dl>
        </Panel>
      </div>
      <Panel>
        <h3 className="text-[16px]">Adoption sensitivity · cash-only net</h3>
        <p className="text-[13px] text-muted">Compare lower, base and higher workflow adoption. This is a scenario range, not a probabilistic forecast.</p>
        <div id="roiSensitivity" className="mt-3 grid gap-3 sm:grid-cols-3">
          {[[lower.netCash, 'Lower adoption (50% of base)'], [base.netCash, 'Base cash-only net'], [higher.netCash, 'Higher adoption (120% of base, capped at 100%)']].map(([v, label]) => (
            <div key={String(label)} className="rounded-md border border-stroke bg-panel2/60 p-3"><b className="block text-[18px]">{money.format(Number(v))}</b><span className="text-[12px] text-quiet">{label}</span></div>
          ))}
        </div>
      </Panel>
      <Notice>Accounting guardrails: recovered staff time is <b>capacity, not released cash</b>. The overlap assumption removes potentially duplicated training/workflow time. Training spend must exclude labor already counted as capacity. Validate baseline costs, actual adoption, eligibility, attributable savings and platform operating expenses before presenting an investment case.</Notice>
    </section>
  );
}
