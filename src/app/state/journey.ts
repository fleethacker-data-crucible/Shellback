/**
 * The employee journey from the 2026-10-22 product audit, as a pure function of the workspace:
 *   intake → review suggestions → confirm skills → reflect (confidence) → credentials → share → team
 * Each step reports its own status and the single action that moves it forward.
 */
import type { Workspace } from '../../core/schema';
import { DEMO_TEAM_ID } from '../../core/analytics';
import { pendingCredentialCandidates } from './actions';
import type { Route } from '../../storage/settings';

export type StepState = 'done' | 'todo' | 'attention' | 'optional';

export interface JourneyStep {
  id: 'intake' | 'review' | 'confirm' | 'reflect' | 'credentials' | 'share' | 'team';
  title: string;
  /** One-line status written for the employee. */
  detail: string;
  state: StepState;
  action: string;
  route: Route;
  /** Optional steps never block "next best action". */
  optional?: boolean;
}

export function journey(ws: Workspace): JourneyStep[] {
  const p = ws.profile;
  const confirmed = p.confirmed.length;
  const pending = p.candidates.length;
  const rated = p.confirmed.filter((id) => p.surveys[id]).length;
  const pendingCreds = pendingCredentialCandidates(ws).length;
  const realTeams = ws.teams.items.filter((t) => t.id !== DEMO_TEAM_ID);
  const peers = realTeams.reduce((n, t) => n + t.members.length, 0);
  const scanned = !!p.lastScan;

  return [
    {
      id: 'intake', title: 'Add your experience',
      detail: scanned ? `Résumé scanned ${p.lastScan}. Re-scan any time; the text itself is never stored.` : confirmed ? 'You added skills manually. A résumé scan can suggest more.' : 'Paste or upload a plain-text résumé to get skill suggestions.',
      state: scanned || confirmed ? 'done' : 'todo', action: scanned ? 'Scan again' : 'Start intake', route: { view: 'profile', tab: 'intake' },
    },
    {
      id: 'review', title: 'Review suggestions',
      detail: pending ? `${pending} skill suggestion${pending === 1 ? '' : 's'} waiting for you to confirm or dismiss.` : scanned ? 'No suggestions waiting.' : 'Suggestions appear here after a résumé scan.',
      state: pending ? 'attention' : scanned ? 'done' : 'todo', action: pending ? `Review ${pending}` : 'Open intake', route: { view: 'profile', tab: 'intake' },
    },
    {
      id: 'confirm', title: 'Confirm your skills',
      detail: confirmed ? `${confirmed} skill${confirmed === 1 ? '' : 's'} confirmed. These build your spider web and galaxy.` : 'Nothing confirmed yet. Only skills you confirm appear on your web.',
      state: confirmed ? 'done' : 'todo', action: confirmed ? 'Manage skills' : 'Add skills', route: { view: 'profile', tab: 'skills' },
    },
    {
      id: 'reflect', title: 'Reflect on confidence', optional: true,
      detail: confirmed ? `${rated} of ${confirmed} confirmed skill${confirmed === 1 ? '' : 's'} have an optional confidence pulse.` : 'Available once you confirm a skill.',
      state: !confirmed ? 'optional' : rated === confirmed ? 'done' : 'optional', action: rated < confirmed ? 'Rate next skill' : 'Review ratings', route: { view: 'explore', tab: 'web' },
    },
    {
      id: 'credentials', title: 'Review credentials', optional: true,
      detail: pendingCreds ? `${pendingCreds} possible certification${pendingCreds === 1 ? '' : 's'} found in your résumé. Approve or dismiss each.` : `${p.credentials.length} self-reported credential${p.credentials.length === 1 ? '' : 's'} in your inventory.`,
      state: pendingCreds ? 'attention' : p.credentials.length ? 'done' : 'optional', action: pendingCreds ? `Review ${pendingCreds}` : 'Open credentials', route: { view: 'profile', tab: 'credentials' },
    },
    {
      id: 'share', title: 'Share by consent', optional: true,
      detail: p.consent || p.shareId ? `${p.consent ? 'Contributing confirmed skills to local team tools.' : 'Local team contribution is off.'}${p.shareId ? ' You have exported a peer card.' : ''}` : 'Off. Nothing leaves this browser unless you export a card.',
      state: p.consent || p.shareId ? 'done' : 'optional', action: 'Sharing options', route: { view: 'team', tab: 'roster' },
    },
    {
      id: 'team', title: 'Plan with a team', optional: true,
      detail: realTeams.length ? `${realTeams.length} team${realTeams.length === 1 ? '' : 's'} with ${peers} imported peer card${peers === 1 ? '' : 's'}.` : 'Create a team and import peer cards, or explore the synthetic demo team.',
      state: peers ? 'done' : 'optional', action: realTeams.length ? 'Open team' : 'Create a team', route: { view: 'team', tab: 'roster' },
    },
  ];
}

/** The first required step that isn't done, else the first optional step that needs attention. */
export function nextStep(steps: JourneyStep[]): JourneyStep | null {
  return steps.find((s) => !s.optional && s.state !== 'done') ?? steps.find((s) => s.state === 'attention') ?? steps.find((s) => s.state === 'optional' && s.id === 'reflect') ?? null;
}
