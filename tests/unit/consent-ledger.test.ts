import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendEvent, auditTrail, emptyLedger, isShared, parseLedger, redactForTeam, sharedFields } from '../../src/core/consent-ledger';

const T0 = '2026-10-01T09:00:00.000Z';
const T1 = '2026-10-02T09:00:00.000Z';
const T2 = '2026-10-03T09:00:00.000Z';

test('nothing is shared until a grant is recorded', () => {
  assert.equal(isShared(emptyLedger(), 'p1', 'skills', 'team-a', T1), false);
});

test('a grant shares the field from its time onward, and only with that team', () => {
  const l = appendEvent(emptyLedger(), { type: 'grant', personId: 'p1', field: 'skills', teamId: 'team-a' }, T0);
  assert.equal(isShared(l, 'p1', 'skills', 'team-a', T0), true);
  assert.equal(isShared(l, 'p1', 'skills', 'team-a', '2026-09-30T00:00:00.000Z'), false, 'not before the grant');
  assert.equal(isShared(l, 'p1', 'skills', 'team-b', T1), false, 'other teams see nothing');
  assert.equal(isShared(l, 'p1', 'mentoring', 'team-a', T1), false, 'other fields are separate');
});

test('revocation takes effect for every later read, and a new grant restores it', () => {
  let l = appendEvent(emptyLedger(), { type: 'grant', personId: 'p1', field: 'mentoring', teamId: 'team-a' }, T0);
  l = appendEvent(l, { type: 'revoke', personId: 'p1', field: 'mentoring', teamId: 'team-a' }, T1);
  assert.equal(isShared(l, 'p1', 'mentoring', 'team-a', T1), false);
  assert.equal(isShared(l, 'p1', 'mentoring', 'team-a', T0), true, 'history is kept: the earlier read still holds');
  l = appendEvent(l, { type: 'grant', personId: 'p1', field: 'mentoring', teamId: 'team-a' }, T2);
  assert.equal(isShared(l, 'p1', 'mentoring', 'team-a', T2), true);
});

test('the ledger is append-only and the audit trail keeps every change in order', () => {
  let l = emptyLedger();
  l = appendEvent(l, { type: 'grant', personId: 'p1', field: 'org', teamId: 'team-a' }, T0);
  const before = l.events.length;
  l = appendEvent(l, { type: 'revoke', personId: 'p1', field: 'org', teamId: 'team-a' }, T1);
  assert.equal(l.events.length, before + 1);
  assert.deepEqual(auditTrail(l, 'p1').map((e) => e.type), ['grant', 'revoke']);
  assert.deepEqual(auditTrail(l, 'someone-else'), []);
});

test('redaction removes what is not granted, rather than hiding it', () => {
  const card = {
    skills: ['sql-pipelines'], surveys: { 'sql-pipelines': { confidence: 3 } }, mentorOptIn: true, mentorTopics: ['mentoring'], mentorIntro: 'hi', availability: 'available',
    qualificationClaims: ['Synthetic cert'], orgCode: 'ENG', orgTitle: 'Analyst',
  };
  let l = appendEvent(emptyLedger(), { type: 'grant', personId: 'p1', field: 'skills', teamId: 'team-a' }, T0);
  l = appendEvent(l, { type: 'grant', personId: 'p1', field: 'confidence', teamId: 'team-a' }, T0);
  const shown = redactForTeam(card, l, 'p1', 'team-a', T1);
  assert.deepEqual(Object.keys(shown).sort(), ['skills', 'surveys']);
  assert.equal('mentorIntro' in shown, false);
  assert.equal('qualificationClaims' in shown, false);
  assert.equal('orgCode' in shown, false);
  assert.deepEqual(sharedFields(l, 'p1', 'team-a', T1), ['skills', 'confidence']);
});

test('a stored ledger is read tolerantly: bad events are dropped and counted, and never grant anything', () => {
  const { ledger, dropped } = parseLedger({ events: [
    { type: 'grant', personId: 'p1', field: 'skills', teamId: 'team-a', at: T0 },
    { type: 'grant', personId: 'p1', field: 'telepathy', teamId: 'team-a', at: T0 },
    { type: 'grant', personId: 'p1', field: 'org', teamId: 'team-a', at: 'yesterday' },
  ] });
  assert.equal(dropped, 2);
  assert.equal(isShared(ledger, 'p1', 'skills', 'team-a', T1), true);
  assert.equal(isShared(ledger, 'p1', 'org', 'team-a', T1), false);
  assert.deepEqual(parseLedger('nope').ledger.events, []);
});

test('appending an invalid event throws instead of recording it', () => {
  assert.throws(() => appendEvent(emptyLedger(), { type: 'grant', personId: 'p1', field: 'telepathy' as never, teamId: 'team-a' }, T0));
});

