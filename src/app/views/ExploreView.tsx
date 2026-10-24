import { useStore } from '../state/store';
import { SectionIntro, Tabs } from '../components/ui/primitives';
import type { ExploreTab } from '../../storage/settings';
import { SpiderWebView } from './SpiderWebView';
import { GalaxyView } from './GalaxyView';

export function ExploreView() {
  const { settings, navigate } = useStore();
  const tab = settings.exploreTab;
  return (
    <section id="explore" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionIntro eyebrow="EXPLORE" title={tab === 'web' ? 'Your capability web.' : 'Your skills galaxy.'}>
          {tab === 'web'
            ? 'Shape comes from the skills you confirmed; optional confidence makes them shine. Click any skill to confirm, dismiss or rate it right here.'
            : 'Confirmed Skills shows exactly what you attested. Pathways shows all 104 skills and how they connect, for learning, never as a claim.'}
        </SectionIntro>
        <Tabs<ExploreTab> label="Explore views" value={tab} onChange={(t) => navigate({ view: 'explore', tab: t })} items={[
          { id: 'web', label: 'Spider web', testId: 'tab-web' },
          { id: 'galaxy', label: 'Galaxy', testId: 'tab-galaxy' },
        ]} />
      </div>
      {tab === 'web' ? <SpiderWebView /> : <GalaxyView />}
    </section>
  );
}
