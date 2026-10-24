/** Builders for the files an employee deliberately exports. */
import { SKILL_BY_ID } from './taxonomy';
import { METHODS, today, type PeerCard, type Workspace, type KnowledgePackage } from './schema';

export interface Disclosure { confidence: boolean; mentoring: boolean; credentials: boolean }

export function buildPeerCard(ws: Workspace, displayName: string, disclose: Disclosure, shareId: string): PeerCard {
  const name = displayName.trim().slice(0, 70);
  if (!name) throw new Error('Enter a display name for your card.');
  const skills = [...new Set(ws.profile.confirmed.filter((id) => SKILL_BY_ID.has(id)))];
  if (!skills.length) throw new Error('Confirm at least one experience mention before sharing.');
  const surveys: PeerCard['surveys'] = {};
  if (disclose.confidence) {
    for (const [id, r] of Object.entries(ws.profile.surveys)) {
      if (!skills.includes(id)) continue;
      surveys[id] = { confidence: r.confidence, method: METHODS.includes(r.method) ? r.method : 'none' };
    }
  }
  const m = ws.workforce.mentorship;
  return {
    format: 'synapse-peer-card', version: 1, id: shareId, name, consent: true, issued: today(), skills, surveys,
    ...(disclose.mentoring ? { mentorOptIn: m.enabled, mentorTopics: m.topics.slice(0, 30), availability: m.availability, mentorIntro: m.intro.slice(0, 500) } : {}),
    ...(disclose.credentials ? { qualificationClaims: ws.profile.credentials.map((c) => c.name.slice(0, 160)).filter(Boolean).slice(0, 100), qualificationDisclaimer: 'employee-entered, unverified' } : {}),
  };
}

export function describeCard(card: PeerCard): string {
  const parts = [`${card.skills.length} skill mention(s)`];
  const n = Object.keys(card.surveys).length;
  if (n) parts.push(`${n} self-reported task response(s)`);
  if ('mentorOptIn' in card) parts.push('mentoring/availability disclosures');
  if (card.qualificationClaims) parts.push(`${card.qualificationClaims.length} employee-entered credential name(s)`);
  return parts.join(', ');
}

export function buildKnowledgePackage(ws: Workspace): KnowledgePackage {
  const records = ws.workforce.knowledge.filter((k) => k.approved);
  if (!records.length) throw new Error('Mark records as owner-reviewed before exporting.');
  return { format: 'synapse-knowledge-relay', version: 1, exported: today(), records };
}

/** Export payload: the workspace plus a format tag so importers can route it. */
export function buildWorkspaceExport(ws: Workspace) {
  return { ...ws, meta: { ...ws.meta, updated: today() }, format: 'synapse-workspace' };
}
