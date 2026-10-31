/**
 * Consent ledger (pilot slice, offline). Consent is an append-only list of grant and revoke events,
 * one per person, field and team. A field is shared at a given time only if its latest event on or
 * before that time is a grant. Revocation therefore takes effect for every later read, and the
 * ledger doubles as the audit trail. Nothing here is stored or sent: the pilot decides where the
 * ledger lives. See docs/ENTERPRISE-PILOT-DESIGN.md.
 */
import { z } from 'zod';

export const CONSENT_FIELDS = ['skills', 'confidence', 'mentoring', 'credentials', 'org', 'contribution'] as const;
export type ConsentField = (typeof CONSENT_FIELDS)[number];

export const consentEventSchema = z.object({
  type: z.enum(['grant', 'revoke']),
  personId: z.string().min(1).max(70),
  field: z.enum(CONSENT_FIELDS),
  teamId: z.string().min(1).max(80),
  at: z.string().datetime(),
});
export type ConsentEvent = z.infer<typeof consentEventSchema>;
export interface ConsentLedger { events: ConsentEvent[] }

export const emptyLedger = (): ConsentLedger => ({ events: [] });

/** Read a stored ledger. Invalid events are dropped and counted; a bad file never grants anything. */
export function parseLedger(raw: unknown): { ledger: ConsentLedger; dropped: number } {
  const list = raw && typeof raw === 'object' && Array.isArray((raw as { events?: unknown }).events) ? (raw as { events: unknown[] }).events : [];
  const events: ConsentEvent[] = [];
  let dropped = 0;
  for (const item of list.slice(0, 100_000)) {
    const r = consentEventSchema.safeParse(item);
    if (r.success) events.push(r.data); else dropped++;
  }
  return { ledger: { events: events.sort((a, b) => a.at.localeCompare(b.at)) }, dropped };
}

/** Append-only: returns a new ledger with the event added. Repeating the current state is recorded but changes nothing. */
export function appendEvent(ledger: ConsentLedger, event: Omit<ConsentEvent, 'at'> & { at?: string }, now: string): ConsentLedger {
  const e = consentEventSchema.parse({ ...event, at: event.at ?? now });
  return { events: [...ledger.events, e] };
}

/** Whether a field of one person is shared with one team at the given time. */
export function isShared(ledger: ConsentLedger, personId: string, field: ConsentField, teamId: string, at: string): boolean {
  let state = false;
  for (const e of ledger.events) {
    if (e.personId !== personId || e.field !== field || e.teamId !== teamId) continue;
    if (e.at > at) break;
    state = e.type === 'grant';
  }
  return state;
}

/** The fields of one person that a team may see at the given time. */
export function sharedFields(ledger: ConsentLedger, personId: string, teamId: string, at: string): ConsentField[] {
  return CONSENT_FIELDS.filter((f) => isShared(ledger, personId, f, teamId, at));
}

/**
 * Keep only what the team may see. A card's skills need the `skills` grant; confidence answers need
 * `confidence`, and so on. Anything not granted is removed, never just hidden.
 */
export function redactForTeam<T extends { skills: string[]; surveys?: Record<string, unknown>; mentorOptIn?: boolean; mentorTopics?: string[]; mentorIntro?: string; availability?: string; qualificationClaims?: string[]; orgCode?: string; orgTitle?: string; contribution?: unknown }>(
  card: T, ledger: ConsentLedger, personId: string, teamId: string, at: string,
): Partial<T> {
  const ok = (f: ConsentField) => isShared(ledger, personId, f, teamId, at);
  const out: Partial<T> = {};
  if (ok('skills')) out.skills = card.skills;
  if (ok('confidence') && card.surveys) out.surveys = card.surveys;
  if (ok('mentoring')) Object.assign(out, { mentorOptIn: card.mentorOptIn, mentorTopics: card.mentorTopics, mentorIntro: card.mentorIntro, availability: card.availability });
  if (ok('credentials') && card.qualificationClaims) out.qualificationClaims = card.qualificationClaims;
  if (ok('org')) Object.assign(out, { orgCode: card.orgCode, orgTitle: card.orgTitle });
  if (ok('contribution') && card.contribution) out.contribution = card.contribution;
  return out;
}

/** The audit trail for one person: every change, oldest first. */
export function auditTrail(ledger: ConsentLedger, personId: string): ConsentEvent[] {
  return ledger.events.filter((e) => e.personId === personId);
}
