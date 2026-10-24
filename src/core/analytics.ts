/**
 * Team / workforce analytics. Pure functions over the workspace; one implementation
 * shared by Teams & sharing, the capability lab, and the FLEETHACKER workforce tools.
 *
 * Every number produced here is a coverage *signal* over voluntarily shared claims.
 * None of it is a readiness, fitness, or performance score.
 */
import { DOMAINS, SKILLS, SKILL_BY_ID, SYNTHETIC_COHORT } from './taxonomy';
import type { Member, Team, Workspace, Credential } from './schema';

export const MIN_AGGREGATE = 3;
export const SELF_ID = 'self-current';
export const DEMO_TEAM_ID = 'team-demo';

export interface Participant extends Member { self?: boolean }

export function defaultTeams(): { active: string; items: Team[] } {
  const members: Member[] = SYNTHETIC_COHORT.map((p, i) => ({
    id: `demo-${i}`,
    name: p.name,
    synthetic: true,
    issued: '2026-10-21',
    skills: p.skills.filter((id) => SKILL_BY_ID.has(id)),
    surveys: Object.fromEntries(p.skills.slice(0, 5).map((skill, j) => [skill, { confidence: (i + j) % 3 === 0 ? 4 : 3, method: (i + j) % 4 === 0 ? 'ai' : 'independent' } as const])),
    mentorOptIn: i % 2 === 0,
    mentorTopics: i % 2 === 0 ? p.skills.slice(0, 2) : [],
    availability: i % 2 === 0 ? 'limited' : 'unknown',
    mentorIntro: '',
    qualificationClaims: [],
  }));
  return { active: DEMO_TEAM_ID, items: [{ id: DEMO_TEAM_ID, name: 'Synthetic demo cohort', members, priorities: ['aws-architecture', 'sql-pipelines', 'qualification-planning'] }] };
}

export function activeTeam(ws: Workspace): Team | undefined {
  return ws.teams.items.find((t) => t.id === ws.teams.active) ?? ws.teams.items[0];
}

/**
 * The local profile joins team tools only when the employee switched consent on.
 * Consent shares *confirmed skills only*. Mentoring and credential details join only
 * under their own explicit local-sharing toggles.
 */
export function selfParticipant(ws: Workspace): Participant | null {
  const p = ws.profile;
  if (!p.consent || !p.confirmed.length) return null;
  const m = ws.workforce.mentorship;
  const mentoring = p.shareMentoringLocally;
  return {
    id: SELF_ID,
    name: p.displayName.trim() ? `${p.displayName.trim()} (my local profile)` : 'My local profile',
    self: true,
    synthetic: false,
    issued: ws.meta.updated,
    skills: p.confirmed.filter((id) => SKILL_BY_ID.has(id)),
    surveys: {},
    mentorOptIn: mentoring ? m.enabled : false,
    mentorTopics: mentoring ? m.topics : [],
    availability: mentoring ? m.availability : 'unknown',
    mentorIntro: mentoring ? m.intro : '',
    qualificationClaims: p.shareCredentialsLocally ? p.credentials.map((c) => c.name) : [],
  };
}

export function participants(ws: Workspace, team: Team | undefined = activeTeam(ws)): Participant[] {
  const people: Participant[] = [...(team?.members ?? [])];
  const self = selfParticipant(ws);
  if (self) people.push(self);
  return people;
}

export interface TeamAggregate {
  people: Participant[];
  n: number;
  allowed: boolean;
  /** Distinct people with at least one confirmed skill per domain index. */
  domainCounts: number[];
  skillCounts: Record<string, number>;
  /** People who self-reported independent execution with confidence ≥ 3. */
  benchCounts: Record<string, number>;
}

export function aggregate(people: Participant[]): TeamAggregate {
  const skillCounts: Record<string, number> = {};
  const benchCounts: Record<string, number> = {};
  for (const s of SKILLS) { skillCounts[s.id] = 0; benchCounts[s.id] = 0; }
  for (const p of people) {
    for (const sid of new Set(p.skills)) if (sid in skillCounts) skillCounts[sid]! += 1;
    for (const [sid, r] of Object.entries(p.surveys)) if (sid in benchCounts && r.method === 'independent' && r.confidence >= 3) benchCounts[sid]! += 1;
  }
  const domainCounts = DOMAINS.map((d) => people.filter((p) => p.skills.some((sid) => SKILL_BY_ID.get(sid)?.di === d.index)).length);
  return { people, n: people.length, allowed: people.length >= MIN_AGGREGATE, domainCounts, skillCounts, benchCounts };
}

export function benchSignals(a: TeamAggregate, limit = 10) {
  return SKILLS.filter((sk) => a.skillCounts[sk.id]! > 0 && a.benchCounts[sk.id]! <= 1)
    .sort((x, y) => a.benchCounts[x.id]! - a.benchCounts[y.id]! || a.skillCounts[x.id]! - a.skillCounts[y.id]!)
    .slice(0, limit);
}

export function coverageGaps(a: TeamAggregate, priorities: readonly string[], limit = 16) {
  const prio = new Set(priorities);
  return SKILLS.filter((sk) => a.skillCounts[sk.id]! <= 1)
    .sort((x, y) => Number(prio.has(y.id)) - Number(prio.has(x.id)) || a.skillCounts[x.id]! - a.skillCounts[y.id]!)
    .slice(0, limit);
}

export interface SkillCoverage { id: string; claimed: Participant[]; independent: Participant[]; guided: Participant[] }
export function skillCoverage(people: Participant[], skillIds: readonly string[]): SkillCoverage[] {
  return skillIds.map((id) => ({
    id,
    claimed: people.filter((p) => p.skills.includes(id)),
    independent: people.filter((p) => p.surveys[id]?.method === 'independent' && (p.surveys[id]?.confidence ?? 0) >= 3),
    guided: people.filter((p) => ['guided', 'ai'].includes(p.surveys[id]?.method ?? '')),
  }));
}

export interface MissionResult {
  skill: string; min: number; credential: string;
  covered: Participant[]; available: Participant[]; limited: Participant[]; unknown: Participant[]; qualified: Participant[];
  gap: boolean;
}
export function missionCoverage(roster: Participant[], requirements: ReadonlyArray<{ skill: string; min: number; credential: string }>): MissionResult[] {
  return requirements.map((r) => {
    const covered = roster.filter((x) => x.skills.includes(r.skill));
    const needle = r.credential.trim().toLowerCase();
    return {
      skill: r.skill, min: r.min, credential: r.credential, covered,
      available: covered.filter((x) => x.availability === 'available'),
      limited: covered.filter((x) => x.availability === 'limited'),
      unknown: covered.filter((x) => x.availability === 'unknown' || x.availability === 'unavailable'),
      qualified: needle ? covered.filter((x) => x.qualificationClaims.some((q) => q.toLowerCase().includes(needle))) : [],
      gap: covered.length < r.min,
    };
  });
}

export function mentorMatches(people: Participant[], topic: string | 'all'): Participant[] {
  return people.filter((p) => p.mentorOptIn && (topic === 'all' || p.mentorTopics.includes(topic)));
}

export type RenewalState = 'none' | 'past' | 'soon' | 'future';
export function renewalState(c: Pick<Credential, 'expiry'>, now = new Date()): { state: RenewalState; days: number | null } {
  if (!c.expiry) return { state: 'none', days: null };
  // Whole calendar days between the local date today and the expiry date (DST-proof: both as UTC midnights).
  const due = Date.parse(c.expiry + 'T00:00:00Z');
  if (!Number.isFinite(due)) return { state: 'none', days: null };
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due - todayUtc) / 86_400_000);
  return { state: days < 0 ? 'past' : days <= 90 ? 'soon' : 'future', days };
}
export function renewalLabel(r: { state: RenewalState; days: number | null }): string {
  switch (r.state) {
    case 'none': return 'No renewal date supplied';
    case 'past': return 'Past self-entered renewal date';
    case 'soon': return `${r.days} days until renewal`;
    case 'future': return `Renewal in ${r.days} days`;
  }
}

export function domainStats(ws: Workspace, di: number): { answered: number; mean: number | null } {
  const values = SKILLS.filter((s) => s.di === di && ws.profile.confirmed.includes(s.id)).map((s) => ws.profile.surveys[s.id]?.confidence).filter((v): v is number => typeof v === 'number');
  return { answered: values.length, mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null };
}

/** Confidence for a skill, visible only while the skill is attested. Withdrawn skills hide their rating. */
export function visibleConfidence(ws: Workspace, skillId: string): number | null {
  if (!ws.profile.confirmed.includes(skillId)) return null;
  return ws.profile.surveys[skillId]?.confidence ?? null;
}
