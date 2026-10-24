/**
 * "How I like to contribute": six generic stages of work, each marked energizing, neutral or
 * draining by the employee. This is Synapse's own vocabulary; it is not an assessment and does
 * not use or reproduce any vendor's instrument. People who have taken a commercial assessment
 * can record where their answers came from in the free-text `source` field, in their own words.
 */
export const STAGES = ['question', 'ideate', 'evaluate', 'rally', 'support', 'finish'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_PHASES = ['ideation', 'activation', 'implementation'] as const;
export type StagePhase = (typeof STAGE_PHASES)[number];

export interface StageDef { id: Stage; label: string; detail: string; phase: StagePhase }

export const STAGE_DEFS: readonly StageDef[] = [
  { id: 'question', label: 'Asking the big questions', detail: 'Noticing what could be better and asking whether we are solving the right problem.', phase: 'ideation' },
  { id: 'ideate', label: 'Coming up with ideas', detail: 'Generating new approaches and solutions from a blank page.', phase: 'ideation' },
  { id: 'evaluate', label: 'Judging what will work', detail: 'Weighing options with experience and instinct, and giving honest feedback.', phase: 'activation' },
  { id: 'rally', label: 'Rallying people', detail: 'Getting others interested, organised and moving on something new.', phase: 'activation' },
  { id: 'support', label: 'Helping it happen', detail: 'Responding to what people need and lending a hand to get work moving.', phase: 'implementation' },
  { id: 'finish', label: 'Finishing and pushing through', detail: 'Driving tasks to completion and making sure results actually land.', phase: 'implementation' },
];
export const STAGE_BY_ID: ReadonlyMap<Stage, StageDef> = new Map(STAGE_DEFS.map((s) => [s.id, s]));
export const PHASE_LABEL: Record<StagePhase, string> = { ideation: 'Ideation', activation: 'Activation', implementation: 'Implementation' };

export const ENERGY = ['energizing', 'neutral', 'draining'] as const;
export type Energy = (typeof ENERGY)[number];
export const ENERGY_LABEL: Record<Energy, string> = { energizing: 'Energizes me', neutral: 'Neutral', draining: 'Drains me' };

/** Per-person preferences. Missing stages are "not answered", which is distinct from neutral. */
export type Contribution = { stages: Partial<Record<Stage, Energy>>; source: string };
export const emptyContribution = (): Contribution => ({ stages: {}, source: '' });
export const hasContribution = (c: Contribution | undefined | null): c is Contribution => !!c && Object.keys(c.stages).length > 0;

export interface StageCoverage {
  stage: StageDef;
  energized: string[];   // people names
  neutral: string[];
  drained: string[];
  unanswered: number;
}

/** Who brings energy to each stage. Names are of people who chose to share their preferences. */
export function stageCoverage(people: ReadonlyArray<{ name: string; contribution?: Contribution | undefined }>): StageCoverage[] {
  return STAGE_DEFS.map((stage) => {
    const row: StageCoverage = { stage, energized: [], neutral: [], drained: [], unanswered: 0 };
    for (const p of people) {
      const e = p.contribution?.stages[stage.id];
      if (e === 'energizing') row.energized.push(p.name);
      else if (e === 'neutral') row.neutral.push(p.name);
      else if (e === 'draining') row.drained.push(p.name);
      else row.unanswered += 1;
    }
    return row;
  });
}

/** Plain-language observations about a team's stage balance. Never about an individual. */
export function stageObservations(cov: StageCoverage[], shared: number): string[] {
  if (shared < 1) return [];
  const out: string[] = [];
  const gaps = cov.filter((r) => r.energized.length === 0);
  if (gaps.length) out.push(`Nobody who shared preferences is energized by: ${gaps.map((g) => g.stage.label.toLowerCase()).join(', ')}. Work in those stages may need deliberate ownership.`);
  const single = cov.filter((r) => r.energized.length === 1 && shared >= 3);
  if (single.length) out.push(`Only one person carries the energy for: ${single.map((g) => g.stage.label.toLowerCase()).join(', ')}.`);
  for (const phase of STAGE_PHASES) {
    const rows = cov.filter((r) => r.stage.phase === phase);
    const drained = rows.reduce((n, r) => n + r.drained.length, 0), energized = rows.reduce((n, r) => n + r.energized.length, 0);
    if (shared >= 3 && drained > energized && drained >= Math.ceil(shared / 2)) out.push(`${PHASE_LABEL[phase]} work drains more of this team than it energizes.`);
  }
  return out;
}
