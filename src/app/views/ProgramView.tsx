import { useStore } from '../state/store';
import { Tabs } from '../components/ui/primitives';
import type { ProgramTab } from '../../storage/settings';
import { TrustView } from './TrustView';
import { RoiView } from './RoiView';
import { IntelligenceView } from './IntelligenceView';

/** Program-level material: governance, data & backups, and the business case. */
export function ProgramView() {
  const { settings, navigate } = useStore();
  const tab = settings.programTab;
  return (
    <section id="program" className="space-y-5">
      <Tabs<ProgramTab> label="Program sections" value={tab} onChange={(t) => navigate({ view: 'program', tab: t })} items={[
        { id: 'governance', label: 'Trust & data', testId: 'tab-governance' },
        { id: 'intelligence', label: 'Intelligence', testId: 'tab-intelligence' },
        { id: 'roi', label: 'ROI laboratory', testId: 'tab-roi' },
      ]} />
      {tab === 'governance' ? <TrustView /> : tab === 'intelligence' ? <IntelligenceView /> : <RoiView />}
    </section>
  );
}
