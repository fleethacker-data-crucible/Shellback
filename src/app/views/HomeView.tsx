import { DOMAINS, SKILLS } from '../../core/taxonomy';
import { useStore } from '../state/store';
import { journey, nextStep, type JourneyStep, type StepState } from '../state/journey';
import { Button, Panel, PanelHeading, cn } from '../components/ui/primitives';
import { SpiderWeb } from '../viz/SpiderWeb';
import { domainWebItems } from './SpiderWebView';

const STATE_STYLE: Record<StepState, { mark: string; cls: string; label: string }> = {
  done: { mark: '✓', cls: 'border-mint/50 bg-mint/15 text-mint', label: 'Done' },
  attention: { mark: '!', cls: 'border-amber/60 bg-amber/15 text-amber', label: 'Needs you' },
  todo: { mark: '', cls: 'border-stroke bg-bg text-quiet', label: 'To do' },
  optional: { mark: '·', cls: 'border-stroke bg-bg text-quiet', label: 'Optional' },
};

export function HomeView() {
  const { ws, navigate, openPulse } = useStore();
  const steps = journey(ws);
  const next = nextStep(steps);
  const fresh = !ws.profile.confirmed.length && !ws.profile.candidates.length && !ws.profile.lastScan;
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.state === 'done').length;

  const go = (s: JourneyStep) => {
    if (s.id === 'reflect' && ws.profile.confirmed.length) { openPulse(); return; }
    navigate(s.route);
  };

  return (
    <section id="home" aria-labelledby="pageTitle" className="space-y-5">
      {fresh ? (
        <div className="relative overflow-hidden rounded-xl border border-stroke bg-gradient-to-br from-[#10203a] via-panel to-[#0b1628] p-6 md:p-9">
          <div className="relative z-10 max-w-[62ch]">
            <div className="eyebrow mb-3">WELCOME TO SYNAPSE</div>
            <h2 className="text-[28px] leading-[1.1] md:text-[36px]">Map what you can do, <em className="not-italic text-mint">on your terms.</em></h2>
            <p className="mt-3 text-[15px] text-muted">Start from your résumé and Synapse suggests skills. You decide what's true. Nothing becomes a score, and nothing leaves this browser unless you export it.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button id="homeStart" variant="primary" size="lg" onClick={() => navigate({ view: 'profile', tab: 'intake' })}>Start with my résumé ↗</Button>
              <Button id="homePersona" size="lg" onClick={() => navigate({ view: 'profile', tab: 'intake' }, undefined)}>Try a fictional employee</Button>
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 top-1/2 hidden h-[280px] w-[280px] -translate-y-1/2 md:block">
            <div className="orbit inset-0" /><div className="orbit orbit-b inset-[36px]" /><div className="orbit orbit-c inset-[76px]" />
            <div className="absolute inset-0 flex items-center justify-center text-[40px] font-extrabold text-mint/80">S</div>
          </div>
        </div>
      ) : next && (
        <Panel className="flex flex-wrap items-center justify-between gap-4 border-mint/40 bg-gradient-to-r from-mint/10 to-transparent" aria-label="Next step">
          <div className="min-w-0">
            <div className="eyebrow text-mint">NEXT STEP</div>
            <h2 className="mt-1 text-[22px]">{next.title}</h2>
            <p className="mt-1 text-[14px] text-muted">{next.detail}</p>
          </div>
          <Button id="homeNext" variant="primary" size="lg" onClick={() => go(next)}>{next.action} ↗</Button>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Panel>
          <PanelHeading eyebrow="YOUR JOURNEY" title={`${doneCount} of ${required.length} core steps done`}>
            Each step is yours to take, skip or undo. Optional steps never block anything.
          </PanelHeading>
          <ol id="journey" className="space-y-2">
            {steps.map((s, i) => {
              const st = STATE_STYLE[s.state];
              return (
                <li key={s.id} data-step={s.id} data-state={s.state} className={cn('flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5', s.state === 'attention' ? 'border-amber/40 bg-amber/5' : 'border-stroke bg-panel2/40')}>
                  <span aria-hidden="true" className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-extrabold', st.cls)}>{st.mark || i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[14px]">{s.title}{s.optional && <span className="ml-2 text-[11px] font-bold text-quiet">optional</span>}</strong>
                    <small className="block text-[12px] text-muted">{s.detail}</small>
                  </div>
                  <span className="sr-only">{st.label}</span>
                  <Button size="sm" variant={s.state === 'attention' ? 'primary' : 'secondary'} data-step-action={s.id} onClick={() => go(s)}>{s.action}</Button>
                </li>
              );
            })}
          </ol>
        </Panel>
        <Panel>
          <PanelHeading eyebrow="AT A GLANCE" title="Your capability web" action={<Button variant="text" onClick={() => navigate({ view: 'explore', tab: 'web' })}>Open ↗</Button>}>
            Shape = skills you confirmed · shine = optional confidence · amber = suggestions waiting.
          </PanelHeading>
          <div id="overviewRadar"><SpiderWeb items={domainWebItems(ws)} small uid="preview" onSelect={(i) => navigate({ view: 'explore', tab: 'web' }, { type: 'radar-domain', di: i })} /></div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
            {[['Confirmed', ws.profile.confirmed.length, 'metricMine'], ['Rated', ws.profile.confirmed.filter((id) => ws.profile.surveys[id]).length, 'metricSurveys'], ['Suggested', ws.profile.candidates.length, 'metricPending'], ['Credentials', ws.profile.credentials.length, 'metricCreds']].map(([label, value, id]) => (
              <div key={String(id)} className="rounded-md border border-stroke bg-panel2/50 px-3 py-2"><dt className="eyebrow">{label}</dt><dd id={String(id)} className="text-[20px] font-extrabold">{value}</dd></div>
            ))}
          </dl>
          <p className="note mt-2"><span id="metricSkills">{SKILLS.length}</span> skills across <span id="metricDomains">{DOMAINS.length}</span> domains are available to explore.</p>
        </Panel>
      </div>
    </section>
  );
}
