/**
 * Workspace schema (v2), v1 migration, and tolerant import parsing.
 *
 * Design rules
 *  - Every persisted record is validated with zod before it touches app state.
 *  - Imports are tolerant: a malformed element is dropped (and reported as a warning),
 *    it never aborts the whole import or blanks the workspace.
 *  - The v1 export written by the original MVP (`version: 1`) remains importable.
 *  - Peer cards keep the `synapse-peer-card` v1 format so existing cards stay valid. The `synapse-*`
 *    format ids (peer card, draft card, knowledge relay, encrypted envelope) predate the rename to
 *    Shellback and are kept so old exports import and older copies of the app read new ones.
 */
import { z } from 'zod';
import { isSkillId } from './taxonomy';
import { CONTEXT_TAGS, ENERGY, ENERGY_SCALE, FLUENCY_SCALE, STAGES, emptyContribution, energyFromScore, type Contribution, type ContextTag, type EnergyScore, type Fluency } from './contribution';
import { normalizeOrgCode } from './org';

export const SCHEMA_VERSION = 2 as const;

// ----------------------------------------------------------------------------
// Primitives
// ----------------------------------------------------------------------------
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateOrToday = isoDate.catch(() => today());
const str = (max: number) => z.string().max(max).catch('');
const strTrim = (max: number) => z.string().transform((s) => s.trim().slice(0, max)).catch('');
const skillId = z.string().refine(isSkillId, 'unknown skill id');
export const today = (): string => new Date().toISOString().slice(0, 10);

/** Keep the first element for each id (hand-edited files may repeat ids). */
function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

/** Parse an unknown array element-by-element; drops invalid items instead of failing. */
function arrayOf<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, max: number, onDrop?: (issue: string) => void) {
  return z.unknown().transform((value) => {
    if (!Array.isArray(value)) return [] as T[];
    const out: T[] = [];
    for (const item of value.slice(0, max)) {
      const r = schema.safeParse(item);
      if (r.success) out.push(r.data);
      else onDrop?.(r.error.issues[0]?.message ?? 'invalid item');
    }
    return out;
  });
}
const skillIdList = (max: number) =>
  z.unknown().transform((v) => (Array.isArray(v) ? [...new Set(v.filter(isSkillId))].slice(0, max) : []));

// ----------------------------------------------------------------------------
// Contribution preferences and organization code (shared by profile and peer cards)
// ----------------------------------------------------------------------------
export const contributionSchema = z.unknown().transform((value): Contribution => {
  const out = emptyContribution();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  const v = value as { stages?: unknown; source?: unknown };
  if (v.stages && typeof v.stages === 'object' && !Array.isArray(v.stages)) {
    for (const [k, e] of Object.entries(v.stages as Record<string, unknown>)) {
      if ((STAGES as readonly string[]).includes(k) && (ENERGY as readonly string[]).includes(e as string)) out.stages[k as (typeof STAGES)[number]] = e as (typeof ENERGY)[number];
    }
  }
  out.source = typeof v.source === 'string' ? v.source.trim().slice(0, 160) : '';
  const detail = (v as { detail?: unknown }).detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    for (const [k, raw] of Object.entries(detail as Record<string, unknown>)) {
      if (!(STAGES as readonly string[]).includes(k) || !raw || typeof raw !== 'object') continue;
      const d = raw as { energy?: unknown; fluency?: unknown; tags?: unknown; example?: unknown };
      if (!(ENERGY_SCALE as readonly unknown[]).includes(d.energy)) continue;
      const fluency = (FLUENCY_SCALE as readonly unknown[]).includes(d.fluency) ? (d.fluency as Fluency) : null;
      const tags = Array.isArray(d.tags) ? [...new Set(d.tags.filter((t): t is ContextTag => (CONTEXT_TAGS as readonly unknown[]).includes(t)))].slice(0, 7) : [];
      const stage = k as (typeof STAGES)[number];
      out.detail[stage] = { energy: d.energy as EnergyScore, fluency, tags, example: typeof d.example === 'string' ? d.example.trim().slice(0, 160) : '' };
      out.stages[stage] = energyFromScore(d.energy as EnergyScore); // the summary always agrees with the detail
    }
  }
  return out;
});
const orgCodeSchema = z.unknown().transform((v) => normalizeOrgCode(v));

// ----------------------------------------------------------------------------
// Profile
// ----------------------------------------------------------------------------
export const PERFORMED = ['never', 'before', 'recent'] as const;
export const METHODS = ['none', 'independent', 'guided', 'ai'] as const;
export type Performed = (typeof PERFORMED)[number];
export type Method = (typeof METHODS)[number];

export const surveySchema = z.object({
  confidence: z.coerce.number().int().min(0).max(4),
  performed: z.enum(PERFORMED).catch('never'),
  method: z.enum(METHODS).catch('none'),
  note: str(1000),
  updated: dateOrToday,
});
export type Survey = z.infer<typeof surveySchema>;

export const credentialSchema = z.object({
  id: z.string().min(1).max(64),
  name: strTrim(160).pipe(z.string().min(1)),
  authority: strTrim(160),
  expiry: isoDate.or(z.literal('')).catch(''),
  created: dateOrToday,
  source: z.enum(['self-entered', 'resume-reviewed']).catch('self-entered'),
  /** v1.3 additions (all optional; older records read as claimed/reviewed from `source`). */
  issued: isoDate.or(z.literal('')).catch(''),
  verifier: strTrim(160).catch(''),
  provenance: z.enum(['claimed', 'reviewed', 'verified']).optional().catch(undefined),
  note: strTrim(300).catch(''),
}).transform((c) => ({ ...c, provenance: c.provenance ?? (c.source === 'resume-reviewed' ? 'reviewed' : 'claimed') } as const));
export type Credential = z.infer<typeof credentialSchema>;
export type CredentialProvenance = Credential['provenance'];

export const credentialCandidateSchema = z.object({
  key: z.string().min(1).max(65),
  name: str(160),
  authority: str(160),
  matched: str(100),
});
export type CredentialCandidate = z.infer<typeof credentialCandidateSchema>;

const surveysSchema = z.unknown().transform((value) => {
  const out: Record<string, Survey> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [id, raw] of Object.entries(value as Record<string, unknown>).slice(0, 104)) {
    if (!isSkillId(id)) continue;
    const r = surveySchema.safeParse(raw);
    if (r.success) out[id] = r.data;
  }
  return out;
});

export const profileSchema = z.object({
  confirmed: skillIdList(104),
  surveys: surveysSchema,
  credentials: arrayOf(credentialSchema, 100).transform(uniqueById),
  candidates: skillIdList(104),
  /** Skill suggestions the employee dismissed; never suggested again by later scans. */
  candidateDismissed: skillIdList(104),
  /** Date of the last résumé scan (journey progress only; résumé text is never stored). */
  lastScan: isoDate.or(z.literal('')).catch(''),
  credentialCandidates: arrayOf(credentialCandidateSchema, 100),
  credentialDismissed: z.unknown().transform((v) => (Array.isArray(v) ? [...new Set(v.filter((k): k is string => typeof k === 'string' && k.length <= 65))].slice(0, 100) : [])),
  consent: z.boolean().catch(false),
  shareMentoringLocally: z.boolean().catch(false),
  shareCredentialsLocally: z.boolean().catch(false),
  /** Include my org code/title and contribution preferences in this browser's team tools. */
  shareOrgLocally: z.boolean().catch(false),
  shareContributionLocally: z.boolean().catch(false),
  orgCode: orgCodeSchema,
  orgTitle: strTrim(80),
  contribution: contributionSchema,
  displayName: str(90),
  demoPersona: str(60),
  shareId: z.string().regex(/^[a-zA-Z0-9-]{8,70}$/).or(z.literal('')).catch(''),
}).transform((p) => ({ ...p, candidates: p.candidates.filter((id) => !p.confirmed.includes(id) && !p.candidateDismissed.includes(id)) }));
export type Profile = z.infer<typeof profileSchema>;

// ----------------------------------------------------------------------------
// Teams and peer cards
// ----------------------------------------------------------------------------
export const AVAILABILITY = ['unknown', 'available', 'limited', 'unavailable'] as const;
export type Availability = (typeof AVAILABILITY)[number];

const peerSurveySchema = z.object({ confidence: z.coerce.number().int().min(0).max(4), method: z.enum(METHODS) });
const peerSurveysSchema = z.unknown().transform((value) => {
  const out: Record<string, { confidence: number; method: Method }> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [id, raw] of Object.entries(value as Record<string, unknown>).slice(0, 104)) {
    if (!isSkillId(id)) continue;
    const r = peerSurveySchema.safeParse(raw);
    if (r.success) out[id] = r.data;
  }
  return out;
});

export const memberSchema = z.object({
  id: z.string().min(1).max(70),
  name: strTrim(70).pipe(z.string().min(1)),
  synthetic: z.boolean().catch(false),
  issued: z.string().max(10).catch('Unknown'),
  skills: skillIdList(104),
  surveys: peerSurveysSchema,
  mentorOptIn: z.boolean().catch(false),
  mentorTopics: skillIdList(30),
  availability: z.enum(AVAILABILITY).catch('unknown'),
  mentorIntro: str(500),
  qualificationClaims: z.unknown().transform((v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 160)).slice(0, 100) : [])),
  orgCode: orgCodeSchema,
  orgTitle: strTrim(80),
  contribution: contributionSchema,
  /** false = a draft someone else prepared (e.g. from a résumé); the person has not attested to it. */
  attested: z.boolean().catch(true),
  draftNote: strTrim(200).catch(''),
}).transform((m) => ({ ...m, surveys: Object.fromEntries(Object.entries(m.surveys).filter(([id]) => m.skills.includes(id))) }));
export type Member = z.infer<typeof memberSchema>;

export const teamSchema = z.object({
  id: z.string().min(1).max(80),
  name: strTrim(80).pipe(z.string().min(1)),
  members: arrayOf(memberSchema, 100).transform(uniqueById),
  priorities: skillIdList(104),
  /** Count unattested drafts in coverage views. Off by default; always labelled when on. */
  includeDrafts: z.boolean().catch(false),
});
export type Team = z.infer<typeof teamSchema>;

export const teamsSchema = z.object({ active: str(80), items: arrayOf(teamSchema, 25).transform(uniqueById) }).catch({ active: '', items: [] });
export type Teams = z.infer<typeof teamsSchema>;

/** Wire format of an exported opt-in capability card (unchanged from v1). */
export const peerCardSchema = z.object({
  format: z.literal('synapse-peer-card'),
  version: z.literal(1),
  id: z.string().regex(/^[a-zA-Z0-9-]{8,70}$/),
  name: z.string().transform((s) => s.trim().slice(0, 70)).pipe(z.string().min(1)),
  consent: z.literal(true),
  issued: isoDate.catch('Unknown'),
  skills: z.array(z.unknown()).max(104),
  surveys: z.unknown().optional(),
  mentorOptIn: z.unknown().optional(),
  mentorTopics: z.unknown().optional(),
  availability: z.unknown().optional(),
  mentorIntro: z.unknown().optional(),
  qualificationClaims: z.unknown().optional(),
  orgCode: z.unknown().optional(),
  orgTitle: z.unknown().optional(),
  contribution: z.unknown().optional(),
});
export type PeerCard = {
  format: 'synapse-peer-card'; version: 1; id: string; name: string; consent: true; issued: string;
  skills: string[]; surveys: Record<string, { confidence: number; method: Method }>;
  mentorOptIn?: boolean; mentorTopics?: string[]; availability?: Availability; mentorIntro?: string;
  qualificationClaims?: string[]; qualificationDisclaimer?: string;
  orgCode?: string; orgTitle?: string; contribution?: Contribution;
};

/**
 * Draft card: prepared by someone else (typically a supervisor from a résumé). Not consented, not attested.
 * A team can hold it as a draft member; the person can import it into their own profile as suggestions.
 */
export const draftCardSchema = z.object({
  format: z.literal('synapse-draft-card'),
  version: z.literal(1),
  id: z.string().regex(/^[a-zA-Z0-9-]{8,70}$/),
  name: z.string().transform((s) => s.trim().slice(0, 70)).pipe(z.string().min(1)),
  attested: z.literal(false),
  issued: isoDate.catch('Unknown'),
  draftedBy: strTrim(70).catch(''),
  skills: skillIdList(104),
  credentialNames: z.unknown().transform((v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 160)).filter(Boolean).slice(0, 50) : [])),
  orgCode: orgCodeSchema,
  orgTitle: strTrim(80).catch(''),
  note: strTrim(200).catch(''),
});
export type DraftCard = z.infer<typeof draftCardSchema>;
export const isDraftCard = (v: unknown): v is { format: 'synapse-draft-card' } => !!v && typeof v === 'object' && (v as { format?: unknown }).format === 'synapse-draft-card';

export function parseDraftCard(input: unknown): DraftCard {
  const r = draftCardSchema.safeParse(input);
  if (!r.success) { const i = r.error.issues[0]; throw new Error(i ? `Not a Shellback draft card (${i.path.join('.') || 'root'}: ${i.message}).` : 'Not a Shellback draft card.'); }
  if (RESERVED_MEMBER_ID.test(r.data.id)) throw new Error('This card uses a reserved identifier and cannot be imported.');
  return r.data;
}

/** A draft becomes a team member that is clearly marked as unattested. */
export function draftToMember(d: DraftCard): Member {
  return memberSchema.parse({
    id: d.id, name: d.name, synthetic: false, issued: d.issued, skills: d.skills, surveys: {}, mentorOptIn: false, mentorTopics: [], availability: 'unknown', mentorIntro: '',
    qualificationClaims: d.credentialNames, orgCode: d.orgCode, orgTitle: d.orgTitle, contribution: { stages: {}, source: '', detail: {} },
    attested: false, draftNote: d.note || `Draft prepared${d.draftedBy ? ` by ${d.draftedBy}` : ''} on ${d.issued}; not confirmed by ${d.name}.`,
  });
}

/** Ids the app uses for the local profile and the synthetic cohort. */
const RESERVED_MEMBER_ID = /^(self-current|demo-\d+)$/;

export function parsePeerCard(input: unknown): Member {
  const base = peerCardSchema.safeParse(input);
  if (!base.success) {
    const msg = base.error.issues[0];
    throw new Error(msg ? `Not an opt-in Shellback peer card (${msg.path.join('.') || 'root'}: ${msg.message}).` : 'Not an opt-in Shellback peer card.');
  }
  if (RESERVED_MEMBER_ID.test(base.data.id)) throw new Error('This card uses a reserved identifier and cannot be imported.');
  const member = memberSchema.parse({ ...(input as object), synthetic: false });
  return member;
}

// ----------------------------------------------------------------------------
// Workforce (FLEETHACKER modules)
// ----------------------------------------------------------------------------
export const studyModuleSchema = z.object({
  id: z.string().min(1).max(64),
  title: strTrim(120).pipe(z.string().min(1)),
  skill: skillId,
  source: strTrim(220),
  question: strTrim(1000).pipe(z.string().min(1)),
  answer: strTrim(1600),
  scenario: strTrim(1200),
  created: dateOrToday,
});
export type StudyModule = z.infer<typeof studyModuleSchema>;

export const attemptSchema = z.object({
  moduleId: z.string().min(1).max(64),
  result: z.enum(['reviewed', 'practice']).catch('practice'),
  date: dateOrToday,
});
export type Attempt = z.infer<typeof attemptSchema>;

export const goalSchema = z.object({
  id: z.string().min(1).max(64),
  skill: skillId,
  target: strTrim(250).pipe(z.string().min(1)),
  due: isoDate.or(z.literal('')).catch(''),
  status: z.enum(['planned', 'done']).catch('planned'),
});
export type Goal = z.infer<typeof goalSchema>;

export const mentorshipSchema = z.object({
  enabled: z.boolean().catch(false),
  topics: skillIdList(30),
  availability: z.enum(AVAILABILITY).catch('unknown'),
  intro: strTrim(500),
}).catch({ enabled: false, topics: [], availability: 'unknown', intro: '' });
export type Mentorship = z.infer<typeof mentorshipSchema>;

export const knowledgeSchema = z.object({
  id: z.string().min(1).max(64),
  topic: strTrim(150).pipe(z.string().min(1)),
  skill: skillId,
  owner: strTrim(90),
  context: strTrim(1200),
  steps: strTrim(3000),
  handoff: strTrim(1500),
  source: strTrim(250),
  approved: z.boolean().catch(false),
  created: dateOrToday,
});
export type KnowledgeRecord = z.infer<typeof knowledgeSchema>;

export const requirementSchema = z.object({
  id: z.string().min(1).max(64),
  skill: skillId,
  min: z.coerce.number().int().min(1).max(20).catch(1),
  credential: strTrim(100),
  /** Optional stage of work someone on the roster should be energized by. */
  stage: z.enum(STAGES).or(z.literal('')).catch(''),
});
export type Requirement = z.infer<typeof requirementSchema>;

export const missionSchema = z.object({
  requirements: arrayOf(requirementSchema, 40).transform(uniqueById),
  selected: z.unknown().transform((v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length <= 80).slice(0, 100) : [])),
  teamId: str(80),
}).catch({ requirements: [], selected: [], teamId: '' });

export const workforceSchema = z.object({
  modules: arrayOf(studyModuleSchema, 100).transform(uniqueById),
  attempts: arrayOf(attemptSchema, 1000),
  goals: arrayOf(goalSchema, 120).transform(uniqueById),
  mentorship: mentorshipSchema,
  knowledge: arrayOf(knowledgeSchema, 250).transform(uniqueById),
  mission: missionSchema,
}).transform((w) => {
  const ids = new Set(w.modules.map((m) => m.id));
  return { ...w, attempts: w.attempts.filter((a) => ids.has(a.moduleId)) };
}).catch(() => emptyWorkforce());
export type Workforce = z.infer<typeof workforceSchema>;

export const fleetPlansSchema = z.unknown().transform((value) => {
  const out: Record<string, { mission: string[]; selected: string[] }> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [id, raw] of Object.entries(value as Record<string, unknown>).slice(0, 25)) {
    if (id.length > 90 || !raw || typeof raw !== 'object') continue;
    const p = raw as { mission?: unknown; selected?: unknown };
    out[id] = {
      mission: Array.isArray(p.mission) ? p.mission.filter(isSkillId).slice(0, 25) : [],
      selected: Array.isArray(p.selected) ? p.selected.filter((k): k is string => typeof k === 'string' && k.length <= 80).slice(0, 100) : [],
    };
  }
  return out;
});

// ----------------------------------------------------------------------------
// ROI
// ----------------------------------------------------------------------------
/** Conservative, illustrative defaults for a 100-person pilot. Every one of them should be replaced by a measured figure. */
export const ROI_DEFAULTS = {
  employees: 100, adoption: 60, hourlyRate: 85, weeks: 46,
  externalHours: 600, externalRate: 180, internalCoverage: 25, internalAnswerHours: 1.25,
  trainingCost: 1500, trainingAvoidance: 8, trainingHours: 24,
  lapsesPerYear: 6, lapseCost: 2500, lapseAvoidance: 50,
  leads: 12, searchMinutes: 30, realization: 50,
  annualCost: 25000, upkeepMinutes: 15, adminHours: 120,
} as const;
export type RoiKey = keyof typeof ROI_DEFAULTS;
export type RoiInputs = { -readonly [K in RoiKey]: number };
export const ROI_PERCENT_KEYS: ReadonlySet<RoiKey> = new Set<RoiKey>(['adoption', 'internalCoverage', 'trainingAvoidance', 'lapseAvoidance', 'realization']);
export const ROI_BASES = ['assumed', 'benchmark', 'measured'] as const;
export type RoiBasis = (typeof ROI_BASES)[number];
export type RoiBasisMap = Partial<Record<RoiKey, RoiBasis>>;

/** Inputs from the retired v1.0–v1.4 model that map onto the new one; everything else is dropped. */
const ROI_LEGACY: Partial<Record<string, RoiKey>> = { minutesSaved: 'searchMinutes' };

export const roiSchema = z.unknown().transform((value): RoiInputs => {
  const out: RoiInputs = { ...ROI_DEFAULTS };
  if (!value || typeof value !== 'object') return out;
  const v = value as Record<string, unknown>;
  for (const key of Object.keys(ROI_DEFAULTS) as RoiKey[]) {
    const n = Number(v[key]);
    if (Number.isFinite(n) && n >= 0) out[key] = Math.min(n, ROI_PERCENT_KEYS.has(key) ? 100 : 100_000_000);
  }
  for (const [legacy, key] of Object.entries(ROI_LEGACY)) { const n = Number(v[legacy]); if (key && v[key] === undefined && Number.isFinite(n) && n >= 0) out[key] = Math.min(n, 100_000_000); }
  return out;
});
export const roiBasisSchema = z.unknown().transform((value): RoiBasisMap => {
  const out: RoiBasisMap = {};
  if (!value || typeof value !== 'object') return out;
  for (const [k, b] of Object.entries(value as Record<string, unknown>)) if (k in ROI_DEFAULTS && (ROI_BASES as readonly unknown[]).includes(b)) out[k as RoiKey] = b as RoiBasis;
  return out;
}).catch({});

// ----------------------------------------------------------------------------
// Workspace (v2)
// ----------------------------------------------------------------------------
export const workspaceSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  profile: profileSchema,
  teams: teamsSchema,
  fleetPlans: fleetPlansSchema,
  workforce: workforceSchema,
  roi: roiSchema,
  roiBasis: roiBasisSchema,
  meta: z.object({ created: dateOrToday, updated: dateOrToday, rev: z.number().int().min(0).catch(0) }).catch({ created: today(), updated: today(), rev: 0 }),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export function emptyProfile(): Profile {
  return {
    confirmed: [], surveys: {}, credentials: [], candidates: [], credentialCandidates: [], credentialDismissed: [],
    consent: false, shareMentoringLocally: false, shareCredentialsLocally: false, displayName: '', demoPersona: '', shareId: '',
    candidateDismissed: [], lastScan: '',
    shareOrgLocally: false, shareContributionLocally: false, orgCode: '', orgTitle: '', contribution: emptyContribution(),
  };
}
export function emptyWorkforce(): Workforce {
  return { modules: [], attempts: [], goals: [], mentorship: { enabled: false, topics: [], availability: 'unknown', intro: '' }, knowledge: [], mission: { requirements: [], selected: [], teamId: '' } };
}
export function newWorkspace(): Workspace {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: emptyProfile(),
    teams: { active: '', items: [] },
    fleetPlans: {},
    workforce: emptyWorkforce(),
    roi: { ...ROI_DEFAULTS },
    roiBasis: {},
    meta: { created: today(), updated: today(), rev: 0 },
  };
}

export interface ParseResult { workspace: Workspace; warnings: string[]; migratedFrom?: 1 }

/** Accepts a v2 workspace or a v1 MVP export; throws only when the input is not a Shellback workspace at all. */
export function parseWorkspace(input: unknown): ParseResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('This file is not a Shellback workspace.');
  const raw = input as Record<string, unknown>;
  const warnings: string[] = [];
  let candidate: Record<string, unknown>;
  let migratedFrom: 1 | undefined;
  if (raw.schemaVersion === SCHEMA_VERSION) candidate = raw;
  else if (raw.version === 1 && raw.profile && typeof raw.profile === 'object') { candidate = migrateV1(raw); migratedFrom = 1; }
  else throw new Error('Unrecognized Shellback workspace version. Expected a v1 MVP export or a v2 workspace.');

  // Count dropped records for the warning list by comparing array lengths before/after.
  const r = workspaceSchema.safeParse(candidate);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new Error(`Workspace could not be validated (${issue?.path.join('.') || 'root'}: ${issue?.message ?? 'invalid'}).`);
  }
  const ws = r.data;
  const before = (candidate.profile as Record<string, unknown> | undefined);
  const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
  if (before) {
    if (count(before.credentials) > ws.profile.credentials.length) warnings.push(`${count(before.credentials) - ws.profile.credentials.length} malformed credential record(s) were skipped.`);
    if (count(before.confirmed) > ws.profile.confirmed.length) warnings.push(`${count(before.confirmed) - ws.profile.confirmed.length} unknown skill id(s) were skipped.`);
  }
  const teamsIn = candidate.teams as { items?: unknown } | undefined;
  if (teamsIn && count(teamsIn.items) > ws.teams.items.length) warnings.push(`${count(teamsIn.items) - ws.teams.items.length} malformed team(s) were skipped.`);
  if (!ws.teams.items.some((t) => t.id === ws.teams.active)) ws.teams.active = ws.teams.items[0]?.id ?? '';
  return migratedFrom ? { workspace: ws, warnings, migratedFrom } : { workspace: ws, warnings };
}

/** Shape a v1 (`synapse-mvp-v1`) export into the v2 layout. Validation happens afterwards. */
export function migrateV1(v1: Record<string, unknown>): Record<string, unknown> {
  const profile = (v1.profile ?? {}) as Record<string, unknown>;
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      ...profile,
      shareMentoringLocally: false,
      shareCredentialsLocally: false,
    },
    teams: v1.teams ?? { active: '', items: [] },
    fleetPlans: v1.fleetPlans ?? {},
    workforce: v1.workforce ?? {},
    roi: v1.roi ?? {},
    meta: { created: today(), updated: today(), rev: 0 },
  };
}

/** Payload written by "Export reviewed knowledge package". */
export interface KnowledgePackage { format: 'synapse-knowledge-relay'; version: 1; exported: string; records: KnowledgeRecord[] }
