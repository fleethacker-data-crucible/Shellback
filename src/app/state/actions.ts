/**
 * Business rules as pure mutators over a Workspace draft. Each returns the flash message
 * to show (or throws an Error with a user-facing message). Unit-tested in tests/unit.
 */
import { SKILL_BY_ID, SYNTHETIC_PROFILE_CONFIDENCE, SYNTHETIC_PROFILE_SKILLS } from '../../core/taxonomy';
import { credentialKey } from '../../core/scanners';
import { defaultTeams, DEMO_TEAM_ID, SELF_ID } from '../../core/analytics';
import { newId, newShareId } from '../../core/ids';
import { normalizeOrgCode } from '../../core/org';
import { STAGES, energyFromScore, scoreFromEnergy, type Contribution, type Energy, type Stage, type StageDetail } from '../../core/contribution';
import { emptyProfile, today, type DraftCard, type Member, type Method, type Performed, type Workspace, type CredentialCandidate, type CredentialProvenance } from '../../core/schema';
import type { ScanResponse } from '../../core/scanners';

export class ActionError extends Error {}
const fail = (msg: string): never => { throw new ActionError(msg); };

// ---------------------------------------------------------------------------- Profile
export function confirmSkill(ws: Workspace, id: string): string {
  if (!SKILL_BY_ID.has(id)) return fail('Unknown skill.');
  if (ws.profile.confirmed.includes(id)) return fail('You have already confirmed this skill.');
  ws.profile.confirmed.push(id);
  ws.profile.candidates = ws.profile.candidates.filter((x) => x !== id);
  ws.profile.candidateDismissed = ws.profile.candidateDismissed.filter((x) => x !== id);
  return 'Skill confirmed. No confidence value was assigned.';
}

export function dismissSkillCandidate(ws: Workspace, id: string): string {
  ws.profile.candidates = ws.profile.candidates.filter((x) => x !== id);
  ws.profile.candidateDismissed = [...new Set([...ws.profile.candidateDismissed, id])];
  return 'Suggestion dismissed. Later résumé scans will not suggest it again; you can still add it manually.';
}

export function removeSkill(ws: Workspace, id: string): string {
  ws.profile.confirmed = ws.profile.confirmed.filter((x) => x !== id);
  return 'Capability removed from your web. Its previous confidence stays private until you re-confirm it.';
}

export function applyScan(ws: Workspace, result: ScanResponse): string {
  ws.profile.lastScan = today();
  ws.profile.candidates = result.skills.filter((id) => SKILL_BY_ID.has(id) && !ws.profile.confirmed.includes(id) && !ws.profile.candidateDismissed.includes(id));
  const held = new Set(ws.profile.credentials.map((c) => credentialKey(c.name)));
  const dismissed = new Set(ws.profile.credentialDismissed);
  ws.profile.credentialCandidates = result.credentials.filter((c) => !held.has(c.key) && !dismissed.has(c.key));
  return `${ws.profile.candidates.length} skill suggestion(s) and ${ws.profile.credentialCandidates.length} possible résumé credential(s) found. Review each before adding anything to your profile.`;
}

export function saveSurvey(ws: Workspace, id: string, input: { confidence: string; performed: string; method: string; note: string }): string {
  if (!SKILL_BY_ID.has(id) || !ws.profile.confirmed.includes(id)) return fail('Attest to this capability before recording a confidence pulse.');
  const confidence = Number(input.confidence);
  if (input.confidence === '' || !Number.isInteger(confidence) || confidence < 0 || confidence > 4) return fail('Choose a confidence level.');
  if (!input.performed || !input.method) return fail('Choose a task, confidence, experience, and execution mode.');
  if ((input.performed === 'never') !== (input.method === 'none')) return fail('If never performed, choose "Not yet performed" as the execution mode.');
  ws.profile.surveys[id] = { confidence, performed: input.performed as Performed, method: input.method as Method, note: input.note.trim().slice(0, 1000), updated: today() };
  return 'Task reflection saved locally, separately from validated evidence.';
}

export function setConsent(ws: Workspace, on: boolean): string {
  ws.profile.consent = on;
  return on ? 'Aggregate contribution enabled: your confirmed skills join local team tools.' : 'Aggregate contribution withdrawn.';
}

export function clearProfile(ws: Workspace): string {
  const keep = ws.profile.shareId; // keep identity stable so later cards update, not duplicate
  ws.profile = { ...emptyProfile(), shareId: keep };
  return 'Your local profile was cleared.';
}

export function loadSyntheticProfile(ws: Workspace): string {
  const ids = SYNTHETIC_PROFILE_SKILLS.filter((id) => SKILL_BY_ID.has(id));
  const surveys: Workspace['profile']['surveys'] = {};
  ids.forEach((id, i) => {
    surveys[id] = {
      confidence: SYNTHETIC_PROFILE_CONFIDENCE[i] ?? 3,
      performed: i % 3 === 0 ? 'recent' : 'before',
      method: i % 5 === 0 ? 'ai' : i % 4 === 0 ? 'guided' : 'independent',
      note: 'Synthetic demonstration response, not a personnel claim.',
      updated: today(),
    };
  });
  ws.profile = {
    ...emptyProfile(), shareId: ws.profile.shareId, confirmed: [...ids], surveys,
    credentials: [{ id: newId('cred'), name: 'Synthetic AWS credential', authority: 'Example authority — not verified', expiry: '2027-04-15', created: today(), source: 'self-entered', issued: '2024-04-15', verifier: '', provenance: 'claimed', note: '' }],
    displayName: 'Synthetic example', demoPersona: 'synthetic-example',
  };
  return 'Synthetic profile loaded. All skill claims and ratings are fictional.';
}

export function setOrg(ws: Workspace, code: string, title: string): void {
  ws.profile.orgCode = normalizeOrgCode(code);
  ws.profile.orgTitle = title.trim().slice(0, 80);
}
export function setContributionStage(ws: Workspace, stage: Stage, energy: Energy | null): void {
  if (energy === null) { delete ws.profile.contribution.stages[stage]; delete ws.profile.contribution.detail[stage]; return; }
  ws.profile.contribution.stages[stage] = energy;
  const d = ws.profile.contribution.detail[stage];
  ws.profile.contribution.detail[stage] = { energy: scoreFromEnergy(energy), fluency: d?.fluency ?? null, tags: d?.tags ?? [], example: d?.example ?? '' };
}
/** Two-axis answer. Energy keeps the one-axis summary in sync; fluency/tags/example are optional. */
export function setStageDetail(ws: Workspace, stage: Stage, patch: Partial<StageDetail>): void {
  const c = ws.profile.contribution;
  const cur = c.detail[stage] ?? { energy: scoreFromEnergy(c.stages[stage] ?? 'neutral'), fluency: null, tags: [], example: '' };
  const next: StageDetail = { ...cur, ...patch, tags: [...new Set(patch.tags ?? cur.tags)].slice(0, 7), example: (patch.example ?? cur.example).trim().slice(0, 160) };
  c.detail[stage] = next;
  c.stages[stage] = energyFromScore(next.energy);
}
export function setContribution(ws: Workspace, c: Contribution): void { ws.profile.contribution = { stages: { ...c.stages }, source: c.source.trim().slice(0, 160), detail: structuredClone(c.detail ?? {}) }; }
export function setContributionSource(ws: Workspace, source: string): void { ws.profile.contribution.source = source.trim().slice(0, 160); }
export function clearContribution(ws: Workspace): string { ws.profile.contribution = { stages: {}, source: '', detail: {} }; return 'Contribution preferences cleared.'; }

// ---------------------------------------------------------------------------- Credentials
export interface CredentialInput { name: string; authority: string; expiry: string; issued?: string; verifier?: string; provenance?: CredentialProvenance; note?: string }
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function normalizeCredentialInput(input: CredentialInput): { ok: true; v: Required<CredentialInput> } | { ok: false; msg: string } {
  const name = input.name.trim().slice(0, 160), authority = input.authority.trim().slice(0, 160), expiry = input.expiry ?? '', issued = input.issued ?? '';
  const verifier = (input.verifier ?? '').trim().slice(0, 160), note = (input.note ?? '').trim().slice(0, 300);
  const provenance: CredentialProvenance = input.provenance ?? 'claimed';
  if (!name) return { ok: false, msg: 'Enter a credential or qualification name.' };
  if (expiry && !ISO.test(expiry)) return { ok: false, msg: 'Choose a valid expiration date.' };
  if (issued && !ISO.test(issued)) return { ok: false, msg: 'Choose a valid issue date.' };
  if (issued && expiry && issued > expiry) return { ok: false, msg: 'The issue date must be before the expiration date.' };
  if (provenance === 'verified' && !verifier) return { ok: false, msg: 'Name who verified it (an authority, registrar or supervisor) to mark a credential verified.' };
  return { ok: true, v: { name, authority, expiry, issued, verifier, provenance, note } };
}

export function addCredential(ws: Workspace, input: CredentialInput, fromCandidateKey: string | null): string {
  const n = normalizeCredentialInput(input);
  if (!n.ok) return fail(n.msg);
  const key = credentialKey(n.v.name);
  if (ws.profile.credentials.some((c) => credentialKey(c.name) === key)) return fail('This credential is already in your inventory. Avoid duplicate claims.');
  const provenance = fromCandidateKey && n.v.provenance === 'claimed' ? 'reviewed' : n.v.provenance;
  ws.profile.credentials.push({ id: newId('cred'), ...n.v, provenance, created: today(), source: fromCandidateKey ? 'resume-reviewed' : 'self-entered' });
  if (fromCandidateKey) ws.profile.credentialCandidates = ws.profile.credentialCandidates.filter((c) => c.key !== fromCandidateKey);
  ws.profile.credentialCandidates = ws.profile.credentialCandidates.filter((c) => c.key !== key);
  return provenance === 'verified' ? 'Credential saved with the verifier you named. Shellback itself has not checked it.' : 'Credential saved as your self-report. It has not been independently verified.';
}

export function updateCredential(ws: Workspace, id: string, input: CredentialInput): string {
  const cur = ws.profile.credentials.find((c) => c.id === id);
  if (!cur) return fail('That credential no longer exists.');
  const n = normalizeCredentialInput(input);
  if (!n.ok) return fail(n.msg);
  const key = credentialKey(n.v.name);
  if (ws.profile.credentials.some((c) => c.id !== id && credentialKey(c.name) === key)) return fail('Another credential in your inventory already has this name.');
  Object.assign(cur, n.v);
  return 'Credential updated.';
}

export function deleteCredential(ws: Workspace, id: string): string {
  ws.profile.credentials = ws.profile.credentials.filter((c) => c.id !== id);
  return 'Credential removed from local inventory.';
}

export function dismissCredentialCandidate(ws: Workspace, key: string): string {
  ws.profile.credentialCandidates = ws.profile.credentialCandidates.filter((c) => c.key !== key);
  ws.profile.credentialDismissed = [...new Set([...ws.profile.credentialDismissed, key])].slice(-100);
  return 'Suggestion dismissed; it stays hidden on later scans of this workspace.';
}

export const pendingCredentialCandidates = (ws: Workspace): CredentialCandidate[] =>
  ws.profile.credentialCandidates.filter((c) => !ws.profile.credentials.some((held) => credentialKey(held.name) === c.key));

// ---------------------------------------------------------------------------- Teams
export function createTeam(ws: Workspace, name: string): string {
  const n = name.trim().slice(0, 80);
  if (!n) return fail('Enter a name for your team.');
  if (ws.teams.items.length >= 25) return fail('Limit of 25 local team workspaces reached.');
  const id = newId('team');
  ws.teams.items.push({ id, name: n, members: [], priorities: [], includeDrafts: false });
  ws.teams.active = id;
  return `Created ${n}. Import peer cards to populate it.`;
}

export function deleteTeam(ws: Workspace, id: string): string {
  ws.teams.items = ws.teams.items.filter((t) => t.id !== id);
  delete ws.fleetPlans[id];
  if (ws.workforce.mission.teamId === id) ws.workforce.mission = { requirements: ws.workforce.mission.requirements, selected: [], teamId: '' };
  if (!ws.teams.items.length) ws.teams = defaultTeams();
  if (!ws.teams.items.some((t) => t.id === ws.teams.active)) ws.teams.active = ws.teams.items[0]!.id;
  return 'Local team deleted.';
}

export function selectTeam(ws: Workspace, id: string): void {
  if (ws.teams.items.some((t) => t.id === id)) ws.teams.active = id;
}

export interface ImportOutcome { replaced: boolean; previousName?: string }
export function importMember(ws: Workspace, teamId: string, member: Member): ImportOutcome {
  const team = ws.teams.items.find((t) => t.id === teamId) ?? fail('Select a team first.');
  const existing = team.members.find((m) => m.id === member.id);
  if (!existing && team.members.length >= 100) return fail('Team limit of 100 peer cards reached.');
  team.members = team.members.filter((m) => m.id !== member.id);
  team.members.push(member);
  return existing ? { replaced: true, previousName: existing.name } : { replaced: false };
}

export function setIncludeDrafts(ws: Workspace, teamId: string, on: boolean): void {
  const team = ws.teams.items.find((t) => t.id === teamId);
  if (team) team.includeDrafts = on;
}

/** Employee side: a draft card prepared for me becomes suggestions, never confirmed skills. */
export function applyDraftToProfile(ws: Workspace, d: DraftCard): string {
  const p = ws.profile;
  const dismissed = new Set(p.candidateDismissed), confirmed = new Set(p.confirmed);
  const newSkills = d.skills.filter((id) => !dismissed.has(id) && !confirmed.has(id) && !p.candidates.includes(id));
  p.candidates = [...p.candidates, ...newSkills].slice(0, 104);
  const haveCred = new Set(p.credentials.map((c) => credentialKey(c.name)));
  const dismissedCred = new Set(p.credentialDismissed);
  let newCreds = 0;
  for (const name of d.credentialNames) {
    const key = credentialKey(name);
    if (haveCred.has(key) || dismissedCred.has(key) || p.credentialCandidates.some((c) => c.key === key)) continue;
    p.credentialCandidates.push({ key: key.slice(0, 65), name, authority: '', matched: 'draft card' });
    newCreds++;
  }
  if (!p.orgCode && d.orgCode) p.orgCode = d.orgCode;
  if (!p.orgTitle && d.orgTitle) p.orgTitle = d.orgTitle;
  if (!p.displayName && d.name) p.displayName = d.name;
  if (!p.shareId) p.shareId = d.id; // so the draft in the team is replaced by the real card on export
  return `Draft loaded as suggestions: ${newSkills.length} skill${newSkills.length === 1 ? '' : 's'} and ${newCreds} credential${newCreds === 1 ? '' : 's'} to review. Nothing is confirmed until you say so.`;
}

export function removeMember(ws: Workspace, teamId: string, memberId: string): string {
  const team = ws.teams.items.find((t) => t.id === teamId);
  if (team) team.members = team.members.filter((m) => m.id !== memberId);
  return 'Imported peer card removed from this local team.';
}

export function togglePriority(ws: Workspace, teamId: string, skillId: string, on: boolean): void {
  const team = ws.teams.items.find((t) => t.id === teamId);
  if (!team || !SKILL_BY_ID.has(skillId)) return;
  team.priorities = on ? [...new Set([...team.priorities, skillId])] : team.priorities.filter((x) => x !== skillId);
}

export function ensureShareId(ws: Workspace): string {
  if (!ws.profile.shareId) ws.profile.shareId = newShareId();
  return ws.profile.shareId;
}

// ---------------------------------------------------------------------------- Capability lab plans
export function fleetPlan(ws: Workspace, teamId: string, peopleIds: string[]) {
  const team = ws.teams.items.find((t) => t.id === teamId);
  const existing = ws.fleetPlans[teamId];
  const plan = {
    mission: (existing?.mission ?? team?.priorities ?? []).filter((id) => SKILL_BY_ID.has(id)).slice(0, 25),
    selected: existing ? existing.selected.filter((id) => peopleIds.includes(id)) : [...peopleIds],
  };
  ws.fleetPlans[teamId] = plan;
  return plan;
}

// ---------------------------------------------------------------------------- Workforce
export function addStudyModule(ws: Workspace, input: { title: string; skill: string; source: string; question: string; answer: string; scenario: string }): string {
  const m = { id: newId('wf'), title: input.title.trim().slice(0, 120), skill: input.skill, source: input.source.trim().slice(0, 220), question: input.question.trim().slice(0, 1000), answer: input.answer.trim().slice(0, 1600), scenario: input.scenario.trim().slice(0, 1200), created: today() };
  if (!m.title || !m.question || !m.answer) return fail('Enter guide title, question, and reference answer.');
  if (!SKILL_BY_ID.has(m.skill)) return fail('Choose a capability area.');
  if (ws.workforce.modules.length >= 100) return fail('Local limit: 100 study guides.');
  ws.workforce.modules.push(m);
  return 'Study guide created locally.';
}

export function importOutline(ws: Workspace, raw: string, skill: string): { created: number; titles: string[] } {
  if (!SKILL_BY_ID.has(skill)) return fail('Choose a skill domain for the imported tasks.');
  const rows = raw.slice(0, 12000).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const titles: string[] = [];
  for (const row of rows) {
    const m = row.match(/^(?:TASK\s*)?(?:(?:\d+(?:\.\d+)*[.)]?|[A-Z][.)])\s+)(.{8,220})$/i);
    if (!m) continue;
    const title = (m[1] ?? '').replace(/\s+\.{3,}$/, '').trim().slice(0, 120);
    if (title && !titles.includes(title)) titles.push(title);
    if (titles.length >= 50) break;
  }
  if (!titles.length) return fail('No numbered task lines recognized. Example: 1.1 Explain the turnover process.');
  const count = Math.min(titles.length, 100 - ws.workforce.modules.length);
  if (count <= 0) return fail('Guide limit reached.');
  for (const title of titles.slice(0, count)) {
    ws.workforce.modules.push({ id: newId('wf'), title, skill, source: 'Employee-supplied approved outline (local; unverified)', question: 'Explain the approved steps, checks, and limitations for: ' + title, answer: '', scenario: 'Describe a practice situation where this task would apply and how you would validate its completion.', created: today() });
  }
  return { created: count, titles: titles.slice(0, count) };
}

export function recordAttempt(ws: Workspace, moduleId: string, result: 'reviewed' | 'practice'): string {
  const m = ws.workforce.modules.find((x) => x.id === moduleId) ?? fail('Guide not found.');
  if (!m.answer) return fail('Add a source-checked reference answer before recording practice.');
  ws.workforce.attempts.push({ moduleId, result, date: today() });
  if (ws.workforce.attempts.length > 1000) ws.workforce.attempts.shift();
  return result === 'reviewed' ? 'Self-review recorded (learning activity only).' : 'Marked for more practice.';
}

export function setModuleAnswer(ws: Workspace, moduleId: string, answer: string): string {
  const m = ws.workforce.modules.find((x) => x.id === moduleId) ?? fail('Guide not found.');
  const a = answer.trim().slice(0, 1600);
  if (!a) return fail('Review the approved source and supply the reference answer.');
  m.answer = a;
  return 'Reference answer saved. Practice can now be recorded.';
}

export function deleteModule(ws: Workspace, moduleId: string): string {
  ws.workforce.modules = ws.workforce.modules.filter((x) => x.id !== moduleId);
  ws.workforce.attempts = ws.workforce.attempts.filter((a) => a.moduleId !== moduleId);
  return 'Study guide and its practice history deleted.';
}

export function addGoal(ws: Workspace, input: { skill: string; target: string; due: string }): string {
  const target = input.target.trim().slice(0, 250);
  if (!target) return fail('Enter an intended learning or cross-training outcome.');
  if (!SKILL_BY_ID.has(input.skill)) return fail('Choose a skill to develop.');
  if (ws.workforce.goals.length >= 120) return fail('Local limit: 120 goals.');
  ws.workforce.goals.push({ id: newId('goal'), skill: input.skill, target, due: /^\d{4}-\d{2}-\d{2}$/.test(input.due) ? input.due : '', status: 'planned' });
  return 'Development goal added.';
}
export function toggleGoal(ws: Workspace, id: string): void {
  const g = ws.workforce.goals.find((x) => x.id === id);
  if (g) g.status = g.status === 'done' ? 'planned' : 'done';
}
export function deleteGoal(ws: Workspace, id: string): void { ws.workforce.goals = ws.workforce.goals.filter((x) => x.id !== id); }

export function addRequirement(ws: Workspace, input: { skill: string; min: string | number; credential: string; stage?: string }): string {
  if (!SKILL_BY_ID.has(input.skill)) return fail('Choose a needed capability.');
  if (ws.workforce.mission.requirements.length >= 40) return fail('Local limit: 40 mission requirements.');
  const min = Math.min(20, Math.max(1, Math.round(Number(input.min) || 1)));
  const stage = (STAGES as readonly string[]).includes(input.stage ?? '') ? (input.stage as Stage) : '';
  ws.workforce.mission.requirements.push({ id: newId('req'), skill: input.skill, min, credential: input.credential.trim().slice(0, 100), stage });
  return 'Mission requirement added.';
}
export function deleteRequirement(ws: Workspace, id: string): void { ws.workforce.mission.requirements = ws.workforce.mission.requirements.filter((r) => r.id !== id); }

/** Mission roster selection belongs to one team; switching teams resets to everyone in that team. */
export function syncMissionRoster(ws: Workspace, teamId: string, peopleIds: string[]): string[] {
  const m = ws.workforce.mission;
  if (m.teamId !== teamId) { m.teamId = teamId; m.selected = [...peopleIds]; }
  m.selected = m.selected.filter((id) => peopleIds.includes(id));
  return m.selected;
}
export function setMissionSelected(ws: Workspace, id: string, on: boolean): void {
  const m = ws.workforce.mission;
  m.selected = on ? [...new Set([...m.selected, id])] : m.selected.filter((x) => x !== id);
}

export function setMentorship(ws: Workspace, patch: Partial<Workspace['workforce']['mentorship']>): void {
  Object.assign(ws.workforce.mentorship, patch);
  ws.workforce.mentorship.topics = ws.workforce.mentorship.topics.filter((id) => SKILL_BY_ID.has(id)).slice(0, 30);
  ws.workforce.mentorship.intro = ws.workforce.mentorship.intro.slice(0, 500);
}

export function addKnowledge(ws: Workspace, input: { topic: string; skill: string; owner: string; context: string; steps: string; handoff: string; source: string }): string {
  const topic = input.topic.trim().slice(0, 150), steps = input.steps.trim().slice(0, 3000);
  if (!topic || !steps) return fail('Enter a topic and transferable practice steps.');
  if (!SKILL_BY_ID.has(input.skill)) return fail('Choose a related capability.');
  if (ws.workforce.knowledge.length >= 250) return fail('Local limit: 250 knowledge records.');
  ws.workforce.knowledge.push({ id: newId('kr'), topic, skill: input.skill, owner: input.owner.trim().slice(0, 90), context: input.context.trim().slice(0, 1200), steps, handoff: input.handoff.trim().slice(0, 1500), source: input.source.trim().slice(0, 250), approved: false, created: today() });
  return 'Knowledge draft saved (unreviewed).';
}
export function toggleKnowledgeApproved(ws: Workspace, id: string): void { const k = ws.workforce.knowledge.find((x) => x.id === id); if (k) k.approved = !k.approved; }
export function deleteKnowledge(ws: Workspace, id: string): void { ws.workforce.knowledge = ws.workforce.knowledge.filter((x) => x.id !== id); }

export { DEMO_TEAM_ID, SELF_ID };
