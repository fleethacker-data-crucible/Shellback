/**
 * Intelligence provider seam.
 *
 * Shellback ships with exactly one built-in provider, `local-rules`: deterministic keyword matching
 * that runs in the browser and makes no network calls. A model-backed provider hosted on an
 * authorized enterprise platform can be configured at run time as a *remote HTTP provider* that
 * speaks the small JSON contract below (see docs/INTELLIGENCE_PROVIDERS.md). Selecting a provider
 * is a user-visible setting; until one is configured and chosen, every call is answered locally
 * and nothing leaves the workstation.
 *
 * Rules every provider must keep:
 *   - outputs are suggestions for the employee to confirm or dismiss, never conclusions;
 *   - no provider scores or ranks a person;
 *   - a provider that sends data off the workstation must say so in `describe()`, and the UI
 *     shows that text wherever the provider is used;
 *   - everything a remote provider returns is validated and clamped here before the app sees it.
 */
import { z } from 'zod';
import { runScan, credentialKey, type ScanRequest, type ScanResponse } from './scanners';
import { isSkillId, SKILL_BY_ID, DOMAINS, SKILLS } from './taxonomy';
import { mapSkillNames, type MappedSkill } from './mapping';
import { STAGE_DEFS } from './contribution';

// ----------------------------------------------------------------------------- types
export interface ProviderInfo {
  id: string;
  label: string;
  /** Where processing happens and what leaves the workstation, in plain words. */
  dataHandling: string;
  offline: boolean;
  /** Origin that requests go to (remote providers only). */
  origin?: string;
}

/** Aggregate-only inputs for a supervisor brief. No names, no per-person rows, ever. */
export interface TeamBriefInput {
  teamName: string;
  people: number;
  /** Distinct people with ≥1 confirmed skill per domain, in DOMAINS order. */
  domainCounts: number[];
  /** Skills with exactly one (or zero) opt-in holders, by name. */
  thinSkills: string[];
  /** Mission priorities by skill name, with how many people cover each. */
  priorities: Array<{ skill: string; covered: number }>;
  /** Contribution stage → number energized / drained (only when ≥ MIN_AGGREGATE shared). */
  stages?: Array<{ stage: string; energized: number; drained: number; grind?: number; growth?: number }>;
  /** Credentials renewing within 90 days (count only). */
  renewalsSoon: number;
}

export interface TeamBrief { text: string; generatedBy: string; inputs: TeamBriefInput }

export interface IntelligenceProvider {
  describe(): ProviderInfo;
  /** Models / deployments the endpoint offers, when it can say. */
  listModels?(): Promise<string[]>;
  /** Suggest taxonomy skills and credential names from free text. */
  scanResume(req: ScanRequest): Promise<ScanResponse>;
  /** Map free-text skill names (from imports, other systems, or a model) onto the taxonomy. */
  mapSkills(names: readonly string[]): Promise<MappedSkill[]>;
  /** Write a short plain-language brief from aggregate inputs. Never receives a person's name. */
  teamBrief(input: TeamBriefInput): Promise<TeamBrief>;
  /** Connectivity / contract check. */
  ping(): Promise<{ ok: boolean; detail: string }>;
}

// ----------------------------------------------------------------------------- local rules
export function localTeamBrief(input: TeamBriefInput): string {
  const lines: string[] = [];
  const strong = DOMAINS.map((d, i) => ({ d, n: input.domainCounts[i] ?? 0 })).filter((x) => x.n >= Math.max(2, Math.ceil(input.people * 0.4))).map((x) => x.d.name);
  const absent = DOMAINS.map((d, i) => ({ d, n: input.domainCounts[i] ?? 0 })).filter((x) => x.n === 0).map((x) => x.d.name);
  lines.push(`${input.teamName}: ${input.people} people opted in to local sharing. Everything below is self-reported and aggregate; it is a conversation starter, not an assessment.`);
  if (strong.length) lines.push(`Breadth: ${strong.length === 1 ? 'the deepest bench is in' : 'the deepest benches are in'} ${strong.join(', ')}.`);
  if (absent.length) lines.push(`No one has confirmed a skill in ${absent.slice(0, 4).join(', ')}${absent.length > 4 ? ` and ${absent.length - 4} more` : ''}. That may be fine for this team's mission; it is a question to ask, not a gap to fill by default.`);
  if (input.thinSkills.length) lines.push(`Single points of knowledge: ${input.thinSkills.slice(0, 6).join(', ')}${input.thinSkills.length > 6 ? '…' : ''} each rest with one person. Consider pairing or cross-training before a leave or move makes it urgent.`);
  const uncovered = input.priorities.filter((p) => p.covered === 0);
  const thin = input.priorities.filter((p) => p.covered === 1);
  if (uncovered.length) lines.push(`Mission priorities with no confirmed coverage: ${uncovered.map((p) => p.skill).join(', ')}.`);
  if (thin.length) lines.push(`Priorities covered by exactly one person: ${thin.map((p) => p.skill).join(', ')}.`);
  if (input.stages?.length) {
    const nobody = input.stages.filter((s) => s.energized === 0).map((s) => s.stage);
    const drained = input.stages.filter((s) => s.drained >= Math.max(2, Math.ceil(input.people / 2))).map((s) => s.stage);
    if (nobody.length) lines.push(`Stages of work nobody said energizes them: ${nobody.join(', ')}. Work there still gets done; ask who carries it and whether that is sustainable.`);
    if (drained.length) lines.push(`Stages that drain most of the team: ${drained.join(', ')}.`);
    const grind = input.stages.filter((s) => (s.grind ?? 0) >= 2).map((s) => s.stage);
    if (grind.length) lines.push(`Two or more people are good at, but drained by: ${grind.join(', ')}. Competence is carrying that work; it is the first place to look for burnout.`);
  }
  if (input.renewalsSoon) lines.push(`${input.renewalsSoon} self-reported credential${input.renewalsSoon === 1 ? '' : 's'} renew within 90 days.`);
  lines.push('Suggested next step: share this brief with the team and ask what is missing, rather than acting on it alone.');
  return lines.join('\n\n');
}

export const localRulesProvider: IntelligenceProvider = {
  describe: () => ({
    id: 'local-rules',
    label: 'Local rules (no network)',
    dataHandling: 'Keyword and certification matching runs in this browser. Résumé text is never stored or sent anywhere.',
    offline: true,
  }),
  scanResume: async (req) => runScan(req),
  mapSkills: async (names) => mapSkillNames(names),
  teamBrief: async (input) => ({ text: localTeamBrief(input), generatedBy: 'local-rules', inputs: input }),
  ping: async () => ({ ok: true, detail: 'Local rules are always available.' }),
};

// ----------------------------------------------------------------------------- remote HTTP contract
export const REMOTE_CONTRACT_VERSION = 1;

/** `synapse` is the stored id of the contract kind (saved in users' settings); kept for compatibility. */
export type RemoteKind = 'openai' | 'synapse';
export const REMOTE_KIND_LABEL: Record<RemoteKind, string> = { openai: 'OpenAI-compatible gateway (chat completions)', synapse: 'Shellback contract endpoint (platform-implemented)' };

export interface RemoteProviderConfig {
  /** openai: endpoint is the API base (…/v1); synapse: endpoint accepts the Shellback contract POST. */
  kind?: RemoteKind;
  label: string;
  /** Absolute https URL. Example: https://ai.example.mil/v1  or  https://ai.example.mil/shellback */
  endpoint: string;
  /** Opaque model / deployment name forwarded verbatim. */
  model?: string;
  /** Operator-supplied disclosure shown to users. */
  dataHandling?: string;
}

export type RemoteTask =
  | { task: 'ping' }
  | { task: 'list-models' }
  | { task: 'scan-resume'; text: string; confirmed: string[]; taxonomy: Array<{ id: string; name: string; domain: string }> }
  | { task: 'map-skills'; names: string[]; taxonomy: Array<{ id: string; name: string; domain: string }> }
  | { task: 'team-brief'; input: TeamBriefInput };

export interface RemoteRequest { contract: number; model?: string; payload: RemoteTask }

const skillIdList = z.array(z.string()).max(104).transform((ids) => [...new Set(ids.filter(isSkillId))]);
const credentialList = z.array(z.object({ name: z.string().min(1).max(160), authority: z.string().max(160).default(''), matched: z.string().max(100).default('') })).max(50)
  .transform((rows) => rows.map((r) => ({ key: credentialKey(r.name).slice(0, 65), name: r.name, authority: r.authority, matched: r.matched || r.name.slice(0, 100) })));
const remoteEnvelope = z.object({ ok: z.literal(true), result: z.unknown() }).or(z.object({ ok: z.literal(false), error: z.string().max(400) }));
const scanResult = z.object({ skills: skillIdList, credentials: credentialList.default([]) });
const mapResult = z.object({ mapped: z.array(z.object({ input: z.string().max(120), skillId: z.string().nullable(), score: z.number().min(0).max(1).default(0.5) })).max(500) });
const briefResult = z.object({ text: z.string().min(1).max(6000) });
const pingResult = z.object({ detail: z.string().max(200).default('ok') });
const modelsResult = z.object({ models: z.array(z.string().min(1).max(120)).max(500) });
const openaiModels = z.object({ data: z.array(z.object({ id: z.string().min(1).max(120) })).max(1000) });
const openaiChat = z.object({ choices: z.array(z.object({ message: z.object({ content: z.string().nullable().default('') }) })).min(1) });

export interface RemoteDeps { fetch: typeof fetch; token: () => string | null; timeoutMs?: number }

export function validateEndpoint(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost'))) return 'Endpoint must use https:// (http is only allowed for 127.0.0.1 / localhost).';
    if (u.username || u.password) return 'Do not put credentials in the URL.';
    if (u.hash) return 'Endpoint must not contain a #fragment.';
    return null;
  } catch { return 'Endpoint is not a valid URL.'; }
}

export const endpointOrigin = (url: string): string | null => { try { return new URL(url).origin; } catch { return null; } };

const taxonomyPayload = () => SKILLS.map((s) => ({ id: s.id, name: s.name, domain: s.domain }));

export function createRemoteProvider(cfg: RemoteProviderConfig, deps: RemoteDeps): IntelligenceProvider {
  const origin = endpointOrigin(cfg.endpoint) ?? cfg.endpoint;
  const info: ProviderInfo = {
    id: 'remote-http',
    label: cfg.label || 'Remote provider',
    dataHandling: cfg.dataHandling?.trim() || `Text you scan, skill names you map and aggregate team numbers are sent over HTTPS to ${origin}. Your workspace, peer cards and names are never sent.`,
    offline: false,
    origin,
  };
  async function call<T>(payload: RemoteTask, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
    const bad = validateEndpoint(cfg.endpoint);
    if (bad) throw new Error(bad);
    const body: RemoteRequest = { contract: REMOTE_CONTRACT_VERSION, payload, ...(cfg.model ? { model: cfg.model } : {}) };
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
    const token = deps.token();
    if (token) headers.authorization = `Bearer ${token}`;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 30_000) : null;
    let res: Response;
    try {
      res = await deps.fetch(cfg.endpoint, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'omit', referrerPolicy: 'no-referrer', ...(ctrl ? { signal: ctrl.signal } : {}) });
    } catch (err) {
      throw new Error(`Could not reach ${origin}: ${err instanceof Error ? err.message : String(err)}. If this is a new host, the build must allow it (see Program → Intelligence).`);
    } finally { if (timer) clearTimeout(timer); }
    if (res.status === 401 || res.status === 403) throw new Error(`The provider rejected the token (${res.status}).`);
    if (!res.ok) throw new Error(`The provider answered ${res.status}.`);
    let json: unknown;
    try { json = await res.json(); } catch { throw new Error('The provider did not return JSON.'); }
    const env = remoteEnvelope.safeParse(json);
    if (!env.success) throw new Error('The provider response does not follow the Shellback contract.');
    if (!env.data.ok) throw new Error(`Provider error: ${env.data.error}`);
    const parsed = schema.safeParse(env.data.result);
    if (!parsed.success) throw new Error('The provider result failed validation and was discarded.');
    return parsed.data;
  }
  return {
    describe: () => info,
    async scanResume(req) {
      const text = String(req.text ?? '').slice(0, 100_000);
      const r = await call({ task: 'scan-resume', text, confirmed: req.confirmed, taxonomy: taxonomyPayload() }, scanResult);
      const confirmed = new Set(req.confirmed);
      return { skills: r.skills.filter((id) => !confirmed.has(id)), credentials: r.credentials, chars: text.length };
    },
    async mapSkills(names) {
      const r = await call({ task: 'map-skills', names: names.map((n) => String(n).slice(0, 120)).slice(0, 500), taxonomy: taxonomyPayload() }, mapResult);
      const local = mapSkillNames(names);
      return local.map((m) => {
        const remote = r.mapped.find((x) => x.input === m.input);
        if (remote?.skillId && isSkillId(remote.skillId)) return { input: m.input, skill: SKILL_BY_ID.get(remote.skillId)!, score: remote.score, reason: 'fuzzy' as const };
        return m;
      });
    },
    async teamBrief(input) {
      const r = await call({ task: 'team-brief', input }, briefResult);
      return { text: r.text, generatedBy: info.label, inputs: input };
    },
    async ping() {
      try { const r = await call({ task: 'ping' }, pingResult); return { ok: true, detail: r.detail }; }
      catch (err) { return { ok: false, detail: err instanceof Error ? err.message : String(err) }; }
    },
    async listModels() { return (await call({ task: 'list-models' }, modelsResult)).models; },
  };
}
// ----------------------------------------------------------------------------- OpenAI-compatible gateway (browser-side)
const TAXONOMY_TEXT = () => SKILLS.map((t) => `${t.id} — ${t.name} — ${t.domain}`).join('\n');
export const SYSTEM_PROMPT = 'You help employees see their own capabilities. You never score, rank or judge a person. Answer ONLY with the JSON object requested, no prose, no code fences.';
export const PROMPTS = {
  scanResume: (text: string, confirmed: string[]) => `Taxonomy (id — name — domain):\n${TAXONOMY_TEXT()}\n\nRésumé text:\n<<<\n${text}\n>>>\n\nAlready confirmed ids (exclude): ${confirmed.join(', ') || 'none'}\n\nReturn {"skills": [taxonomy ids clearly evidenced by the text, max 25], "credentials": [{"name": certification or qualification actually HELD (not pursued), "authority": issuer or "", "matched": the exact phrase}]}. Only include skills with real evidence; prefer precision over recall.`,
  mapSkills: (names: string[]) => `Taxonomy (id — name — domain):\n${TAXONOMY_TEXT()}\n\nMap each of these free-text skill names to the single best taxonomy id, or null if nothing fits:\n${names.map((n) => `- ${n}`).join('\n')}\n\nReturn {"mapped": [{"input": name exactly as given, "skillId": id or null, "score": 0..1}]}.`,
  teamBrief: (input: TeamBriefInput) => `Write a short, plain-language brief (3–6 short paragraphs, plain text, blank line between paragraphs) for a supervisor from these AGGREGATE team numbers. Never name or imply an individual. Treat everything as self-reported and as a conversation starter, not an assessment. End with one suggested next step that involves asking the team.\n\n${JSON.stringify(input, null, 2)}\n\nReturn {"text": "..."}.`,
};

const trimSlash = (u: string) => u.replace(/\/+$/, '');

/**
 * Talks to an OpenAI-shaped API (`/models`, `/chat/completions`) directly from the browser.
 * The API key is the bearer token the user sealed. The gateway must allow CORS from the Shellback
 * origin and the build must allow the host (SHELLBACK_INTEL_HOST); otherwise use tools/intel-adapter.mjs.
 */
export function createOpenAIProvider(cfg: RemoteProviderConfig, deps: RemoteDeps): IntelligenceProvider {
  const base = trimSlash(cfg.endpoint);
  const origin = endpointOrigin(cfg.endpoint) ?? cfg.endpoint;
  const info: ProviderInfo = {
    id: 'remote-http',
    label: cfg.label || 'AI gateway',
    dataHandling: cfg.dataHandling?.trim() || `Text you scan, skill names you map and aggregate team numbers are sent over HTTPS to ${origin}${cfg.model ? ` (model ${cfg.model})` : ''}. Your workspace, peer cards and names are never sent.`,
    offline: false,
    origin,
  };
  async function http(path: string, init: RequestInit): Promise<unknown> {
    const bad = validateEndpoint(cfg.endpoint);
    if (bad) throw new Error(bad);
    const token = deps.token();
    if (!token) throw new Error('No API key unlocked. Add or unlock the key under Program → Intelligence.');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 45_000) : null;
    let res: Response;
    try {
      res = await deps.fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` }, credentials: 'omit', referrerPolicy: 'no-referrer', ...(ctrl ? { signal: ctrl.signal } : {}) });
    } catch (err) {
      throw new Error(`Could not reach ${origin}: ${err instanceof Error ? err.message : String(err)}. Check that this build allows the host (Program → Intelligence) and that the gateway permits browser (CORS) requests; otherwise run the loopback adapter.`);
    } finally { if (timer) clearTimeout(timer); }
    if (res.status === 401 || res.status === 403) throw new Error(`The gateway rejected the API key (${res.status}).`);
    if (res.status === 404) throw new Error(`${origin} answered 404 for ${path}. The endpoint should be the API base, usually ending in /v1.`);
    if (!res.ok) throw new Error(`The gateway answered ${res.status}.`);
    try { return await res.json(); } catch { throw new Error('The gateway did not return JSON.'); }
  }
  async function chat<T>(user: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
    if (!cfg.model) throw new Error('Choose a model first (Program → Intelligence → Load models).');
    const json = await http('/chat/completions', { method: 'POST', body: JSON.stringify({ model: cfg.model, temperature: 0, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: user }] }) });
    const parsed = openaiChat.safeParse(json);
    if (!parsed.success) throw new Error('The gateway response is not a chat completion.');
    const content = parsed.data.choices[0]!.message.content ?? '';
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('The model did not return JSON.');
    let obj: unknown;
    try { obj = JSON.parse(m[0]); } catch { throw new Error('The model returned malformed JSON.'); }
    const out = schema.safeParse(obj);
    if (!out.success) throw new Error('The model result failed validation and was discarded.');
    return out.data;
  }
  const provider: IntelligenceProvider = {
    describe: () => info,
    async listModels() {
      const json = await http('/models', { method: 'GET' });
      const parsed = openaiModels.safeParse(json);
      if (!parsed.success) throw new Error('The gateway /models response is not in the expected shape.');
      return [...new Set(parsed.data.data.map((m) => m.id))].sort();
    },
    async ping() {
      try {
        const models = await provider.listModels!();
        const has = !cfg.model || models.includes(cfg.model);
        return { ok: has, detail: has ? `${origin} reachable · ${models.length} model${models.length === 1 ? '' : 's'}${cfg.model ? ` · using ${cfg.model}` : ''}` : `Reachable, but model "${cfg.model}" is not in the gateway's list.` };
      } catch (err) { return { ok: false, detail: err instanceof Error ? err.message : String(err) }; }
    },
    async scanResume(req) {
      const text = String(req.text ?? '').slice(0, 100_000);
      const r = await chat(PROMPTS.scanResume(text, req.confirmed), scanResult);
      const confirmed = new Set(req.confirmed);
      return { skills: r.skills.filter((id) => !confirmed.has(id)), credentials: r.credentials, chars: text.length };
    },
    async mapSkills(names) {
      const r = await chat(PROMPTS.mapSkills(names.map((n) => String(n).slice(0, 120)).slice(0, 500)), mapResult);
      return mapSkillNames(names).map((m) => { const remote = r.mapped.find((x) => x.input === m.input); return remote?.skillId && isSkillId(remote.skillId) ? { input: m.input, skill: SKILL_BY_ID.get(remote.skillId)!, score: remote.score, reason: 'fuzzy' as const } : m; });
    },
    async teamBrief(input) { const r = await chat(PROMPTS.teamBrief(input), briefResult); return { text: r.text, generatedBy: info.label, inputs: input }; },
  };
  return provider;
}

/** Pick the implementation from the config. */
export function createConfiguredProvider(cfg: RemoteProviderConfig, deps: RemoteDeps): IntelligenceProvider {
  return (cfg.kind ?? 'synapse') === 'openai' ? createOpenAIProvider(cfg, deps) : createRemoteProvider(cfg, deps);
}


/** Everything the team brief task could ever carry, for the disclosure UI. */
export const TEAM_BRIEF_FIELDS = ['team name', 'number of people', 'people per domain (13 numbers)', 'skills held by only one person (names of skills, not people)', 'mission priorities and coverage counts', `energized / drained / grind / growth counts per stage (${STAGE_DEFS.length} stages)`, 'count of credentials renewing within 90 days'] as const;

// ----------------------------------------------------------------------------- registry
const registry = new Map<string, IntelligenceProvider>([[localRulesProvider.describe().id, localRulesProvider]]);

export function registerProvider(p: IntelligenceProvider): void { registry.set(p.describe().id, p); }
export function unregisterProvider(id: string): void { if (id !== 'local-rules') registry.delete(id); }
export function listProviders(): ProviderInfo[] { return [...registry.values()].map((p) => p.describe()); }
export function getProvider(id: string | undefined): IntelligenceProvider { return (id && registry.get(id)) || localRulesProvider; }
