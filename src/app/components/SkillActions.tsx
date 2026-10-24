/**
 * The same in-context actions for a skill wherever it is shown (spider web, galaxy, lists):
 *   suggestion → Confirm / Dismiss      confirmed → Rate or update confidence      other → Add to my skills
 */
import { SKILL_BY_ID } from '../../core/taxonomy';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import { confirmSkill, dismissSkillCandidate } from '../state/actions';
import { Button, Pill } from './ui/primitives';

export type SkillStatus = 'confirmed' | 'suggested' | 'none';

export function skillStatus(profile: { confirmed: string[]; candidates: string[] }, id: string): SkillStatus {
  if (profile.confirmed.includes(id)) return 'confirmed';
  if (profile.candidates.includes(id)) return 'suggested';
  return 'none';
}

/** Evidence-level chip: one vocabulary and color system for every screen. */
export function StatusChip({ status, rated }: { status: SkillStatus; rated?: boolean }) {
  if (status === 'confirmed') return <Pill tone="mint">{rated ? 'Confirmed · self-rated' : 'Confirmed'}</Pill>;
  if (status === 'suggested') return <Pill tone="amber">Suggested · awaiting you</Pill>;
  return <Pill>Not in your profile</Pill>;
}

export function SkillActions({ skillId, size = 'sm', idPrefix = 'skill' }: { skillId: string; size?: 'sm' | 'md'; idPrefix?: string }) {
  const { ws, openPulse } = useStore();
  const act = useAction();
  if (!SKILL_BY_ID.has(skillId)) return null;
  const status = skillStatus(ws.profile, skillId);
  const rated = !!ws.profile.surveys[skillId] && status === 'confirmed';
  return (
    <div className="flex flex-wrap gap-2" data-skill-actions={skillId}>
      {status === 'suggested' && (
        <>
          <Button id={`${idPrefix}Confirm`} size={size} variant="primary" data-action="confirm" onClick={() => act((d) => confirmSkill(d, skillId))}>Confirm skill</Button>
          <Button id={`${idPrefix}Dismiss`} size={size} data-action="dismiss" onClick={() => act((d) => dismissSkillCandidate(d, skillId))}>Dismiss suggestion</Button>
        </>
      )}
      {status === 'none' && <Button id={`${idPrefix}Add`} size={size} variant="primary" data-action="add" onClick={() => act((d) => confirmSkill(d, skillId))}>Add to my skills</Button>}
      {status === 'confirmed' && <Button id={`${idPrefix}Pulse`} size={size} variant={rated ? 'secondary' : 'primary'} data-action="pulse" onClick={() => openPulse(skillId)}>{rated ? 'Update confidence' : 'Rate confidence'}</Button>}
    </div>
  );
}
