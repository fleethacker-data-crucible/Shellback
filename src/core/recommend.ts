/**
 * Suggestions for a team lead, computed only from what people chose to share. Two kinds:
 *
 *   Pairs          — two people who would likely work well together on something new: complementary
 *                    stage energy (one brings energy where the other is drained), ideally with a shared
 *                    domain so they speak the same language, or a Flow ↔ Growth-edge match on one stage.
 *   Cross-training — a skill held by only one person on the team, plus who could realistically pick it
 *                    up: someone with neighbouring skills in the same domain (taxonomy adjacency), or
 *                    energized-and-learning ("growth edge") on the stage the skill usually needs.
 *
 * Everything is a suggestion with its reasons shown; nothing here scores, ranks or labels a person.
 */
import { SKILLS, SKILL_BY_ID, DOMAINS } from './taxonomy';
import { STAGE_DEFS, quadrant, stageDetail, type Contribution, type Stage } from './contribution';
import { mapSkillName } from './mapping';

export interface Person { id: string; name: string; skills: string[]; contribution?: Contribution | undefined; self?: boolean | undefined; attested?: boolean }

export interface PairSuggestion { a: Person; b: Person; score: number; reasons: string[] }
export interface CrossTrainingSuggestion { skillId: string; skillName: string; holder: Person | null; candidates: Array<{ person: Person; reasons: string[]; score: number }> }

const stageLabel = (s: Stage) => STAGE_DEFS.find((d) => d.id === s)!.label.toLowerCase();
const energyOf = (p: Person, s: Stage) => stageDetail(p.contribution, s)?.energy ?? null;

function sharedDomains(a: Person, b: Person): string[] {
  const da = new Set(a.skills.map((id) => SKILL_BY_ID.get(id)?.di).filter((x): x is number => x !== undefined));
  const db = new Set(b.skills.map((id) => SKILL_BY_ID.get(id)?.di).filter((x): x is number => x !== undefined));
  return [...da].filter((d) => db.has(d)).map((d) => DOMAINS[d]!.name);
}

/** Pairs ranked by complementarity. Only people who shared contribution preferences can be paired. */
export function recommendPairs(people: Person[], limit = 6): PairSuggestion[] {
  const eligible = people.filter((p) => p.contribution && Object.keys(p.contribution.stages).length >= 3 && p.attested !== false);
  const out: PairSuggestion[] = [];
  for (let i = 0; i < eligible.length; i++) for (let j = i + 1; j < eligible.length; j++) {
    const a = eligible[i]!, b = eligible[j]!;
    const reasons: string[] = [];
    let score = 0;
    // Complementary energy: a drained where b energized (and vice versa), stage by stage.
    const covers: string[] = [];
    for (const s of STAGE_DEFS) {
      const ea = energyOf(a, s.id), eb = energyOf(b, s.id);
      if (ea === null || eb === null) continue;
      if (ea <= -1 && eb >= 1) { covers.push(`${b.name} brings energy to ${stageLabel(s.id)} where ${a.name} is drained`); score += 2 + eb - ea; }
      else if (eb <= -1 && ea >= 1) { covers.push(`${a.name} brings energy to ${stageLabel(s.id)} where ${b.name} is drained`); score += 2 + ea - eb; }
      // Flow ↔ growth edge on the same stage: a natural mentoring pair.
      const qa = quadrant(stageDetail(a.contribution, s.id)), qb = quadrant(stageDetail(b.contribution, s.id));
      if ((qa === 'flow' && qb === 'growth') || (qa === 'growth' && qb === 'flow')) { reasons.push(`${qa === 'flow' ? a.name : b.name} is in flow on ${stageLabel(s.id)}; ${qa === 'flow' ? b.name : a.name} wants to grow there`); score += 3; }
    }
    if (covers.length) reasons.unshift(...covers.slice(0, 2));
    if (covers.length > 2) reasons.push(`…and ${covers.length - 2} more stage${covers.length - 2 === 1 ? '' : 's'} where they cover each other`);
    const shared = sharedDomains(a, b);
    if (shared.length && score > 0) { reasons.push(`Both work in ${shared.slice(0, 2).join(' and ')}`); score += Math.min(2, shared.length); }
    // Both drained on the same stage is a warning, not a reason.
    const bothDrained = STAGE_DEFS.filter((s) => (energyOf(a, s.id) ?? 0) <= -1 && (energyOf(b, s.id) ?? 0) <= -1).map((s) => stageLabel(s.id));
    if (bothDrained.length && score > 0) { reasons.push(`Watch out: both drained by ${bothDrained.join(', ')}`); score -= bothDrained.length; }
    if (score >= 4) out.push({ a, b, score, reasons });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

/** Which stage a skill mostly lives in, by its domain; used to match growth-edge candidates. */
const DOMAIN_STAGE: Record<number, Stage> = { 0: 'finish', 1: 'evaluate', 2: 'evaluate', 3: 'finish', 4: 'question', 5: 'evaluate', 6: 'finish', 7: 'rally', 8: 'support', 9: 'evaluate', 10: 'support', 11: 'rally', 12: 'ideate' };

/** Single-holder (or priority) skills and who could pick them up. */
export function recommendCrossTraining(people: Person[], priorities: readonly string[] = [], limit = 8): CrossTrainingSuggestion[] {
  const attested = people.filter((p) => p.attested !== false);
  const holders = new Map<string, Person[]>();
  for (const p of attested) for (const id of p.skills) holders.set(id, [...(holders.get(id) ?? []), p]);
  const targets = SKILLS.filter((s) => (holders.get(s.id)?.length ?? 0) <= 1 && ((holders.get(s.id)?.length ?? 0) === 1 || priorities.includes(s.id)))
    .sort((x, y) => Number(priorities.includes(y.id)) - Number(priorities.includes(x.id)) || (holders.get(x.id)?.length ?? 0) - (holders.get(y.id)?.length ?? 0));
  const out: CrossTrainingSuggestion[] = [];
  for (const s of targets.slice(0, limit * 2)) {
    const holder = holders.get(s.id)?.[0] ?? null;
    const stage = DOMAIN_STAGE[s.di] ?? 'finish';
    const candidates = attested.filter((p) => p.id !== holder?.id && !p.skills.includes(s.id)).map((p) => {
      const reasons: string[] = [];
      let score = 0;
      const sameDomain = p.skills.filter((id) => SKILL_BY_ID.get(id)?.di === s.di);
      if (sameDomain.length) { reasons.push(`Already has ${sameDomain.length} ${s.domain} skill${sameDomain.length === 1 ? '' : 's'} (${sameDomain.slice(0, 2).map((id) => SKILL_BY_ID.get(id)!.name).join(', ')})`); score += Math.min(4, sameDomain.length * 1.5); }
      // Names that look alike across domains (e.g. "Data Quality" ↔ "Quality Assurance") count a little.
      const near = mapSkillName(s.name);
      if (near.skill && near.skill.id !== s.id && p.skills.includes(near.skill.id)) { reasons.push(`Holds the closely related ${near.skill.name}`); score += 1.5; }
      const d = stageDetail(p.contribution, stage);
      const q = quadrant(d);
      if (q === 'growth') { reasons.push(`Energized by ${stageLabel(stage)} work and still learning it — a growth edge`); score += 2.5; }
      else if (q === 'flow') { reasons.push(`In flow on ${stageLabel(stage)} work`); score += 1; }
      else if (d && d.energy <= -1) score -= 1;
      return { person: p, reasons, score };
    }).filter((c) => c.score >= 2).sort((x, y) => y.score - x.score).slice(0, 3);
    if (candidates.length) out.push({ skillId: s.id, skillName: s.name, holder, candidates });
    if (out.length >= limit) break;
  }
  return out;
}
