/**
 * Map free-text skill names onto the taxonomy. Pure, deterministic, offline.
 * Used for CSV/JSON imports, provider output (which may invent names), and the manual skill box.
 */
import { SKILLS, type Skill } from './taxonomy';

export interface MappedSkill { input: string; skill: Skill | null; score: number; reason: 'exact' | 'alias' | 'fuzzy' | 'none' }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s: string) => new Set(norm(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t)));
const STOP = new Set(['and', 'or', 'of', 'the', 'for', 'with', 'in', 'to', 'a', 'an', 'skills', 'skill', 'experience']);

/** Short aliases that are not worth a regex in the scanner but help mapping. */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  'sql-pipelines': ['sql', 't-sql', 'pl/sql'],
  'etl-elt': ['etl', 'elt', 'data pipelines'],
  'aws-architecture': ['aws', 'amazon web services'],
  'infrastructure-as-code': ['iac', 'terraform', 'cloudformation', 'bicep'],
  'container-platforms': ['docker', 'kubernetes', 'k8s', 'containers'],
  'identity-access': ['iam', 'sso', 'identity management'],
  'javascript-development': ['javascript', 'typescript', 'node', 'nodejs', 'react'],
  'powershell-automation': ['powershell', 'pwsh'],
  'python-development': ['python', 'pandas'],
  'api-design': ['rest', 'rest api', 'graphql', 'openapi'],
  'power-bi': ['powerbi', 'pbi'],
  'ci-cd-pipelines': ['ci/cd', 'cicd', 'github actions', 'azure pipelines', 'jenkins'],
  'git-workflows': ['git', 'github', 'gitlab', 'version control'],
  'agile-facilitation': ['agile', 'scrum', 'scrum master', 'kanban'],
  'ai-orchestration': ['llm', 'llms', 'agents', 'prompt engineering', 'generative ai', 'genai'],
  'knowledge-transfer': ['cross training', 'cross-training', 'onboarding'],
  'technical-writing': ['documentation', 'tech writing'],
};

const index = SKILLS.map((s) => ({ s, n: norm(s.name), t: tokens(s.name), aliases: (ALIASES[s.id] ?? []).map(norm) }));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function mapSkillName(input: string): MappedSkill {
  const q = norm(input);
  if (!q) return { input, skill: null, score: 0, reason: 'none' };
  for (const e of index) if (e.n === q) return { input, skill: e.s, score: 1, reason: 'exact' };
  for (const e of index) if (e.aliases.includes(q)) return { input, skill: e.s, score: 0.95, reason: 'alias' };
  const qt = tokens(input);
  let best: MappedSkill = { input, skill: null, score: 0, reason: 'none' };
  for (const e of index) {
    let score = jaccard(qt, e.t);
    if (e.n.includes(q) || q.includes(e.n)) score = Math.max(score, 0.75);
    for (const a of e.aliases) if (q.includes(a) && a.length >= 3) score = Math.max(score, 0.7);
    if (score > best.score) best = { input, skill: e.s, score, reason: 'fuzzy' };
  }
  return best.score >= 0.5 ? best : { input, skill: null, score: best.score, reason: 'none' };
}

export function mapSkillNames(inputs: readonly string[]): MappedSkill[] {
  const seen = new Set<string>();
  const out: MappedSkill[] = [];
  for (const raw of inputs.slice(0, 500)) {
    const input = String(raw ?? '').trim().slice(0, 120);
    if (!input) continue;
    const m = mapSkillName(input);
    if (m.skill && seen.has(m.skill.id)) continue;
    if (m.skill) seen.add(m.skill.id);
    out.push(m);
  }
  return out;
}
