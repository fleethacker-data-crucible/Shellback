/**
 * Provider evaluation set.
 *
 * Runs an intelligence provider over synthetic gold résumé snippets and reports how closely its
 * suggestions match what a careful human reader expects. The numbers describe the *provider*, never a
 * person: every document in the set is fictional, and the report has no per-person output.
 */
import { z } from 'zod';
import { isSkillId } from './taxonomy';
import { CREDENTIAL_CATALOG } from './scanners';
import type { IntelligenceProvider } from './intelligence';

const credentialKeys: ReadonlySet<string> = new Set(CREDENTIAL_CATALOG.map((c) => c.key));

export const goldCaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  title: z.string().min(1).max(120),
  text: z.string().min(1).max(20_000),
  expectedSkills: z.array(z.string().refine(isSkillId, 'unknown skill id')).max(104),
  expectedCredentials: z.array(z.string().refine((k) => credentialKeys.has(k), 'unknown credential key')).max(50),
});
export type GoldCase = z.infer<typeof goldCaseSchema>;

export const goldSetSchema = z.object({
  format: z.literal('shellback-evaluation-set'),
  version: z.literal(1),
  description: z.string().max(600).default(''),
  cases: z.array(goldCaseSchema).min(1).max(200),
}).superRefine((set, ctx) => {
  const seen = new Set<string>();
  for (const c of set.cases) {
    if (seen.has(c.id)) ctx.addIssue({ code: 'custom', message: `duplicate case id ${c.id}` });
    seen.add(c.id);
  }
});
export type GoldSet = z.infer<typeof goldSetSchema>;

export function parseGoldSet(input: unknown): GoldSet {
  const r = goldSetSchema.safeParse(input);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new Error(`Not a Shellback evaluation set (${i?.path.join('.') || 'root'}: ${i?.message ?? 'invalid'}).`);
  }
  return r.data;
}

export interface SetScore { expected: number; predicted: number; correct: number; precision: number; recall: number; f1: number }

const f1Of = (precision: number, recall: number) => (precision + recall ? (2 * precision * recall) / (precision + recall) : 0);

/** Precision/recall with the convention that "nothing expected and nothing suggested" is a perfect answer. */
export function scoreSets(expected: readonly string[], predicted: readonly string[]): SetScore {
  const exp = new Set(expected);
  const pred = new Set(predicted);
  const correct = [...pred].filter((x) => exp.has(x)).length;
  const precision = pred.size ? correct / pred.size : exp.size ? 0 : 1;
  const recall = exp.size ? correct / exp.size : 1;
  return { expected: exp.size, predicted: pred.size, correct, precision, recall, f1: f1Of(precision, recall) };
}

export interface SetResult extends SetScore { missed: string[]; extra: string[] }
export interface CaseResult { id: string; title: string; skills: SetResult; credentials: SetResult; error?: string }
export interface EvaluationReport {
  provider: { id: string; label: string; offline: boolean };
  cases: CaseResult[];
  /** Counts pooled across cases. */
  micro: { skills: SetScore; credentials: SetScore };
  /** Mean of the per-case F1 scores. */
  macro: { skills: number; credentials: number };
  failed: number;
}

const diff = (a: readonly string[], b: readonly string[]) => { const s = new Set(b); return a.filter((x) => !s.has(x)); };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
function pool(rows: SetScore[]): SetScore {
  const expected = rows.reduce((n, r) => n + r.expected, 0);
  const predicted = rows.reduce((n, r) => n + r.predicted, 0);
  const correct = rows.reduce((n, r) => n + r.correct, 0);
  const precision = predicted ? correct / predicted : expected ? 0 : 1;
  const recall = expected ? correct / expected : 1;
  return { expected, predicted, correct, precision, recall, f1: f1Of(precision, recall) };
}

function scored(expected: readonly string[], predicted: readonly string[], failed: boolean): SetResult {
  const s = scoreSets(expected, failed ? [] : predicted);
  return { ...s, ...(failed ? { precision: 0, f1: 0 } : {}), missed: diff(expected, failed ? [] : predicted), extra: failed ? [] : diff(predicted, expected) };
}

/** A provider that throws on a case scores zero for that case and the run continues. */
export async function evaluateProvider(provider: IntelligenceProvider, cases: readonly GoldCase[], onProgress?: (done: number, total: number) => void): Promise<EvaluationReport> {
  const info = provider.describe();
  const results: CaseResult[] = [];
  for (const [i, c] of cases.entries()) {
    let skills: string[] = [];
    let creds: string[] = [];
    let error: string | undefined;
    try {
      const r = await provider.scanResume({ text: c.text, confirmed: [] });
      skills = r.skills.filter(isSkillId);
      creds = r.credentials.map((x) => x.key);
    } catch (err) { error = err instanceof Error ? err.message : String(err); }
    results.push({ id: c.id, title: c.title, skills: scored(c.expectedSkills, skills, !!error), credentials: scored(c.expectedCredentials, creds, !!error), ...(error ? { error } : {}) });
    onProgress?.(i + 1, cases.length);
  }
  return {
    provider: { id: info.id, label: info.label, offline: info.offline },
    cases: results,
    micro: { skills: pool(results.map((r) => r.skills)), credentials: pool(results.map((r) => r.credentials)) },
    macro: { skills: mean(results.map((r) => r.skills.f1)), credentials: mean(results.map((r) => r.credentials.f1)) },
    failed: results.filter((r) => r.error).length,
  };
}

export interface ReportDelta { skillsF1: number; credentialsF1: number; regressions: string[] }

/** How a candidate provider moved against a baseline report on the same set (cases matched by id). */
export function compareReports(baseline: EvaluationReport, candidate: EvaluationReport): ReportDelta {
  const base = new Map(baseline.cases.map((c) => [c.id, c]));
  const regressions = candidate.cases
    .filter((c) => { const b = base.get(c.id); return !!b && (c.skills.f1 < b.skills.f1 - 1e-9 || c.credentials.f1 < b.credentials.f1 - 1e-9); })
    .map((c) => c.id);
  return { skillsF1: candidate.micro.skills.f1 - baseline.micro.skills.f1, credentialsF1: candidate.micro.credentials.f1 - baseline.micro.credentials.f1, regressions };
}
