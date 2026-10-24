import { DOMAINS, SKILLS } from '../../core/taxonomy';
import { domainStats } from '../../core/analytics';
import { useStore } from '../state/store';
import { Button, Panel, PanelHeading, Stat } from '../components/ui/primitives';
import { SpiderWeb } from '../viz/SpiderWeb';
import { domainWebItems } from './SpiderWebView';

const STEPS = [
  ['Suggest', 'Paste a résumé or enter experiences. Identify candidate skills only.'],
  ['Confirm', 'Review every candidate; missing ones can be added manually.'],
  ['Reflect', 'Answer concrete task-confidence questions, separately recording execution mode.'],
  ['Develop', 'Maintain credential plans and opt in to team coverage sharing.'],
] as const;

export function OverviewView() {
  const { ws, navigate } = useStore();
  const confirmed = ws.profile.confirmed.length;
  const surveys = Object.keys(ws.profile.surveys).filter((id) => ws.profile.confirmed.includes(id)).length;
  const items = domainWebItems(ws);

  return (
    <section id="overview" aria-labelledby="pageTitle" className="space-y-5">
      <div className="relative overflow-hidden rounded-xl border border-stroke bg-gradient-to-br from-[#10203a] via-panel to-[#0b1628] p-6 md:p-9">
        <div className="relative z-10 max-w-[60ch]">
          <div className="eyebrow mb-3">THE HUMAN CAPABILITY LAYER</div>
          <h2 className="text-[30px] leading-[1.08] md:text-[40px]">Skills don't exist in silos.<br /><em className="not-italic text-mint">Neither should opportunity.</em></h2>
          <p className="mt-4 text-[15px] text-muted">Discover skills, understand employee-declared experience, plan credential readiness, and identify development pathways—without converting self-report into a personnel score.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" size="lg" data-view="profile" onClick={() => navigate('profile')}>Build my profile ↗</Button>
            <Button size="lg" data-view="graph" onClick={() => navigate('graph')}>Explore the network ↗</Button>
            <Button size="lg" data-view="workforce" onClick={() => navigate('workforce')}>FLEETHACKER workforce ↗</Button>
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 top-1/2 hidden h-[300px] w-[300px] -translate-y-1/2 md:block">
          <div className="orbit inset-0" /><div className="orbit orbit-b inset-[36px]" /><div className="orbit orbit-c inset-[76px]" />
          <div className="absolute inset-0 flex items-center justify-center text-[42px] font-extrabold text-mint/80">S</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat id="metricDomains" label="Capability domains" value={DOMAINS.length} hint="Explore a connected skill taxonomy" />
        <Stat id="metricSkills" label="Skills in taxonomy" value={SKILLS.length} hint="Task-oriented, not job-title limited" />
        <Stat id="metricMine" label="Your confirmed skills" value={confirmed} hint="Explicitly employee-reviewed" />
        <Stat id="metricSurveys" label="Survey responses" value={surveys} hint="Self-report stays distinct from evidence" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeading eyebrow="01 / A CAPABILITY MAP" title="Explore your domain landscape" action={<Button variant="text" data-view="radar" onClick={() => navigate('radar')}>Open spider web ↗</Button>}>
            After résumé intake, this chart highlights <b>pending candidates</b> and <b>confirmed experience</b> separately from optional confidence ratings.
          </PanelHeading>
          <div id="overviewRadar"><SpiderWeb items={items} small uid="preview" onSelect={(i) => navigate('radar', { type: 'radar-domain', di: i })} /></div>
        </Panel>
        <Panel>
          <PanelHeading eyebrow="02 / BUILD A PROFILE" title="From experiences to evidence">Everything begins with informed employee control.</PanelHeading>
          <ol className="space-y-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-3 rounded-md border border-stroke bg-panel2/50 p-3">
                <b className="text-[18px] text-mint">0{i + 1}</b>
                <span><strong className="block">{title}</strong><small className="text-muted">{text}</small></span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      <p className="note">Domain confidence shown on the preview is the mean of your optional self-ratings in that domain: {DOMAINS.filter((d) => domainStats(ws, d.index).answered > 0).length} of {DOMAINS.length} domains currently have any rating.</p>
    </section>
  );
}
