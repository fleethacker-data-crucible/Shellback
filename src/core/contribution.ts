/**
 * "How I like to contribute": six generic stages of work, each marked energizing, neutral or
 * draining by the employee. This is Shellback's own vocabulary; it is not an assessment and does
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

// ----------------------------------------------------------------------------- v2: two axes per stage
/** Energy: −2 drains a lot … +2 energizes a lot. Fluency: 0 new to it … 3 fluent. */
export const ENERGY_SCALE = [-2, -1, 0, 1, 2] as const;
export type EnergyScore = (typeof ENERGY_SCALE)[number];
export const ENERGY_SCORE_LABEL: Record<EnergyScore, string> = { [-2]: 'Drains me a lot', [-1]: 'Drains me', 0: 'Neutral', 1: 'Energizes me', 2: 'Energizes me a lot' };
export const FLUENCY_SCALE = [0, 1, 2, 3] as const;
export type Fluency = (typeof FLUENCY_SCALE)[number];
export const FLUENCY_LABEL: Record<Fluency, string> = { 0: 'New to it', 1: 'Some practice', 2: 'Practiced', 3: 'Fluent' };

/** When a preference holds. Optional, plain words, no scoring. */
export const CONTEXT_TAGS = ['high-stakes', 'under-deadline', 'small-team', 'large-group', 'people-i-know', 'new-people', 'working-alone'] as const;
export type ContextTag = (typeof CONTEXT_TAGS)[number];
export const CONTEXT_TAG_LABEL: Record<ContextTag, string> = { 'high-stakes': 'when stakes are high', 'under-deadline': 'under deadline', 'small-team': 'in a small team', 'large-group': 'in a large group', 'people-i-know': 'with people I know', 'new-people': 'with new people', 'working-alone': 'working alone' };

export interface StageDetail { energy: EnergyScore; fluency: Fluency | null; tags: ContextTag[]; example: string }

/** The four honest combinations of energy and fluency, plus the two that a single axis cannot resolve. */
export const QUADRANTS = ['flow', 'growth', 'grind', 'avoid', 'steady', 'unknown'] as const;
export type Quadrant = (typeof QUADRANTS)[number];
export const QUADRANT_LABEL: Record<Quadrant, string> = { flow: 'Flow', growth: 'Growth edge', grind: 'Grind', avoid: 'Avoid / pair', steady: 'Steady', unknown: 'Not answered' };
export const QUADRANT_DETAIL: Record<Quadrant, string> = {
  flow: 'Energizes you and you are practiced at it. Where you do your best work.',
  growth: 'Energizes you but you are still learning. The best place to invest.',
  grind: 'You are good at it and it drains you. Sustainable only in small doses; a burnout watch for the team.',
  avoid: 'Neither energizing nor practiced. Pair with someone, or let it go.',
  steady: 'Neutral energy. Fine to do, nothing to protect or invest in.',
  unknown: 'Energy or fluency not answered yet.',
};
export function quadrant(d: Pick<StageDetail, 'energy' | 'fluency'> | undefined): Quadrant {
  if (!d) return 'unknown';
  if (d.energy === 0) return 'steady';
  if (d.fluency === null) return 'unknown';
  if (d.energy > 0) return d.fluency >= 2 ? 'flow' : 'growth';
  return d.fluency >= 2 ? 'grind' : 'avoid';
}
export const energyFromScore = (e: EnergyScore): Energy => (e > 0 ? 'energizing' : e < 0 ? 'draining' : 'neutral');
export const scoreFromEnergy = (e: Energy): EnergyScore => (e === 'energizing' ? 1 : e === 'draining' ? -1 : 0);

/**
 * Per-person preferences. `stages` is the one-axis summary (kept for peer cards and older data);
 * `detail` is the two-axis answer when given. Missing stages are "not answered", distinct from neutral.
 */
export type Contribution = { stages: Partial<Record<Stage, Energy>>; source: string; detail: Partial<Record<Stage, StageDetail>> };
export const emptyContribution = (): Contribution => ({ stages: {}, source: '', detail: {} });
export const hasContribution = (c: Contribution | undefined | null): c is Contribution => !!c && Object.keys(c.stages).length > 0;
/** The two-axis detail for a stage, synthesised from the one-axis answer when no detail exists. */
export function stageDetail(c: Contribution | undefined, stage: Stage): StageDetail | undefined {
  if (!c) return undefined;
  const d = c.detail[stage];
  if (d) return d;
  const e = c.stages[stage];
  return e ? { energy: scoreFromEnergy(e), fluency: null, tags: [], example: '' } : undefined;
}

export interface StageCoverage {
  stage: StageDef;
  energized: string[];   // people names
  neutral: string[];
  drained: string[];
  unanswered: number;
  /** Two-axis read-out; names of people per quadrant (only those who answered fluency). */
  quadrants: Record<Quadrant, string[]>;
}

/** Who brings energy to each stage. Names are of people who chose to share their preferences. */
export function stageCoverage(people: ReadonlyArray<{ name: string; contribution?: Contribution | undefined }>): StageCoverage[] {
  return STAGE_DEFS.map((stage) => {
    const row: StageCoverage = { stage, energized: [], neutral: [], drained: [], unanswered: 0, quadrants: { flow: [], growth: [], grind: [], avoid: [], steady: [], unknown: [] } };
    for (const p of people) {
      const e = p.contribution?.stages[stage.id];
      if (e === 'energizing') row.energized.push(p.name);
      else if (e === 'neutral') row.neutral.push(p.name);
      else if (e === 'draining') row.drained.push(p.name);
      else row.unanswered += 1;
      if (e) row.quadrants[quadrant(stageDetail(p.contribution, stage.id))].push(p.name);
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
  const grind = cov.filter((r) => r.quadrants.grind.length >= 2);
  if (grind.length) out.push(`Good at it but drained by it (two or more people): ${grind.map((g) => g.stage.label.toLowerCase()).join(', ')}. Competence is carrying this work; check it is not burning people out.`);
  const growth = cov.filter((r) => r.quadrants.growth.length >= 1 && r.quadrants.flow.length >= 1);
  if (growth.length) out.push(`Natural mentoring pairs exist for: ${growth.map((g) => g.stage.label.toLowerCase()).join(', ')} (someone in flow, someone on a growth edge).`);
  for (const phase of STAGE_PHASES) {
    const rows = cov.filter((r) => r.stage.phase === phase);
    const drained = rows.reduce((n, r) => n + r.drained.length, 0), energized = rows.reduce((n, r) => n + r.energized.length, 0);
    if (shared >= 3 && drained > energized && drained >= Math.ceil(shared / 2)) out.push(`${PHASE_LABEL[phase]} work drains more of this team than it energizes.`);
  }
  return out;
}

// ----------------------------------------------------------------------------- results import (vendor-neutral)
/**
 * Parse a results file someone exported from a workshop or an assessment they took.
 * Accepted shapes, all case-insensitive:
 *   CSV   stage,energy            e.g. "Rallying people,energizes" / "finish,drains" / "3,neutral"
 *   JSON  { "stages": { "rally": "energizing", ... }, "source": "optional" }
 *         or [{ "stage": "rally", "energy": "draining" }, ...]
 * Stage may be the id, the label, a distinctive word from the label, or its 1–6 order.
 * Energy accepts plain English synonyms. Unknown rows are reported, never guessed.
 */
export interface ContributionImport { contribution: Contribution; applied: number; skipped: string[] }

const STAGE_WORDS: ReadonlyArray<readonly [Stage, readonly string[]]> = [
  ['question', ['question', 'questions', 'wonder', 'wondering', 'ask', 'asking', '1']],
  ['ideate', ['ideate', 'ideas', 'idea', 'invent', 'inventing', 'invention', 'create', 'creating', '2']],
  ['evaluate', ['evaluate', 'judge', 'judging', 'judgment', 'judgement', 'discern', 'discernment', 'assess', '3']],
  ['rally', ['rally', 'rallying', 'galvanize', 'galvanizing', 'mobilize', 'mobilizing', 'inspire', '4']],
  ['support', ['support', 'supporting', 'help', 'helping', 'enable', 'enabling', 'enablement', 'assist', '5']],
  ['finish', ['finish', 'finishing', 'complete', 'completing', 'tenacity', 'tenacious', 'deliver', 'push', '6']],
];
const ENERGY_WORDS: ReadonlyArray<readonly [Energy, readonly string[]]> = [
  ['energizing', ['energizing', 'energising', 'energizes', 'energises', 'energized', 'energy', 'strength', 'love', 'loves', 'genius', 'gift', 'thrive', 'high', '+', '2']],
  ['neutral', ['neutral', 'ok', 'okay', 'fine', 'competent', 'competency', 'competence', 'capable', 'medium', 'mid', '0', '1']],
  ['draining', ['draining', 'drains', 'drained', 'drain', 'frustration', 'frustrating', 'frustrates', 'dislike', 'avoid', 'low', '-', '-1']],
];
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9+\- ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function parseStage(v: unknown): Stage | null {
  const q = norm(v);
  if (!q) return null;
  for (const [id, words] of STAGE_WORDS) if (q === id || words.includes(q)) return id;
  for (const d of STAGE_DEFS) if (norm(d.label) === q) return d.id;
  const toks = q.split(' ');
  for (const [id, words] of STAGE_WORDS) if (toks.some((t) => words.includes(t) && !/^\d$/.test(t))) return id;
  return null;
}
export function parseEnergy(v: unknown): Energy | null {
  const q = norm(v);
  if (!q) return null;
  for (const [id, words] of ENERGY_WORDS) if (q === id || words.includes(q)) return id;
  const toks = q.split(' ');
  for (const [id, words] of ENERGY_WORDS) if (toks.some((t) => words.includes(t) && !/^[\d+-]+$/.test(t))) return id;
  return null;
}

export function importContribution(text: string, existing: Contribution = emptyContribution()): ContributionImport {
  const out: ContributionImport = { contribution: { stages: { ...existing.stages }, source: existing.source, detail: structuredClone(existing.detail ?? {}) }, applied: 0, skipped: [] };
  const rows: Array<[unknown, unknown]> = [];
  const trimmed = text.trim().slice(0, 50_000);
  if (!trimmed) return out;
  let source = '';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let json: unknown;
    try { json = JSON.parse(trimmed); } catch { out.skipped.push('File is not valid JSON.'); return out; }
    if (Array.isArray(json)) for (const r of json.slice(0, 50)) { const o = r as Record<string, unknown>; rows.push([o?.stage ?? o?.name ?? o?.id, o?.energy ?? o?.value ?? o?.rating]); }
    else if (json && typeof json === 'object') {
      const o = json as Record<string, unknown>;
      if (typeof o.source === 'string') source = o.source;
      const stages = (o.stages && typeof o.stages === 'object' ? o.stages : o) as Record<string, unknown>;
      for (const [k, v] of Object.entries(stages).slice(0, 50)) if (k !== 'source') rows.push([k, v]);
    }
  } else {
    for (const line of trimmed.split(/\r?\n/).slice(0, 60)) {
      const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cells.length < 2) { if (line.trim()) out.skipped.push(`"${line.trim().slice(0, 40)}" has no separator.`); continue; }
      if (/^stage$/i.test(cells[0] ?? '') && /^(energy|value|rating)$/i.test(cells[1] ?? '')) continue; // header
      rows.push([cells[0], cells[1]]);
    }
  }
  for (const [s, e] of rows) {
    const stage = parseStage(s), energy = parseEnergy(e);
    if (!stage || !energy) { out.skipped.push(`"${String(s ?? '').slice(0, 30)} → ${String(e ?? '').slice(0, 20)}" not understood.`); continue; }
    out.contribution.stages[stage] = energy;
    const prev = out.contribution.detail[stage];
    out.contribution.detail[stage] = { energy: scoreFromEnergy(energy), fluency: prev?.fluency ?? null, tags: prev?.tags ?? [], example: prev?.example ?? '' };
    out.applied++;
  }
  if (source && !out.contribution.source) out.contribution.source = source.slice(0, 160);
  return out;
}
