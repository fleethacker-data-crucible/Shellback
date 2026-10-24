import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newWorkspace } from '../../src/core/schema';
import { defaultTeams } from '../../src/core/analytics';
import { encryptJson, decryptJson } from '../../src/core/crypto';
import { buildPeerCard } from '../../src/core/share';
import * as A from '../../src/app/state/actions';
import { runScan } from '../../src/core/scanners';
import { SAMPLE_RESUME } from '../../src/core/taxonomy';

const fresh = () => { const w = newWorkspace(); w.teams = defaultTeams(); return w; };

test('scan → review → save credential → duplicates rejected → dismissal persists', () => {
  const w = fresh();
  A.applyScan(w, runScan({ text: SAMPLE_RESUME, confirmed: [] }));
  assert.equal(A.pendingCredentialCandidates(w).length, 3);
  assert.equal(w.profile.credentials.length, 0);
  A.addCredential(w, { name: 'AWS Certified Solutions Architect – Professional', authority: 'AWS', expiry: '' }, 'aws-sap');
  assert.equal(w.profile.credentials[0]!.source, 'resume-reviewed');
  assert.equal(A.pendingCredentialCandidates(w).length, 2);
  assert.throws(() => A.addCredential(w, { name: 'AWS Solutions Architect Professional', authority: '', expiry: '' }, null), A.ActionError);
  A.dismissCredentialCandidate(w, 'pmp');
  A.applyScan(w, runScan({ text: SAMPLE_RESUME, confirmed: [] }));
  assert.deepEqual(A.pendingCredentialCandidates(w).map((c) => c.key), ['security-plus']);
});

test('survey rules: attested only; never-performed must pair with none', () => {
  const w = fresh();
  assert.throws(() => A.saveSurvey(w, 'sql-pipelines', { confidence: '3', performed: 'recent', method: 'ai', note: '' }), A.ActionError);
  A.confirmSkill(w, 'sql-pipelines');
  assert.throws(() => A.saveSurvey(w, 'sql-pipelines', { confidence: '3', performed: 'never', method: 'ai', note: '' }), /never performed/i);
  A.saveSurvey(w, 'sql-pipelines', { confidence: '3', performed: 'recent', method: 'ai', note: ' x ' });
  assert.equal(w.profile.surveys['sql-pipelines']!.note, 'x');
});

test('clearing the profile keeps the share id (review: duplicate cards)', () => {
  const w = fresh();
  const id = A.ensureShareId(w);
  A.confirmSkill(w, 'sql-pipelines');
  A.clearProfile(w);
  assert.equal(w.profile.shareId, id);
  assert.equal(w.profile.confirmed.length, 0);
});

test('deleting a team removes its plan data (review: orphaned fleetPlans)', () => {
  const w = fresh();
  A.createTeam(w, 'Pilot');
  const id = w.teams.active;
  w.fleetPlans[id] = { mission: ['sql-pipelines'], selected: [] };
  A.deleteTeam(w, id);
  assert.equal(w.fleetPlans[id], undefined);
  assert.equal(w.teams.active, 'team-demo');
});

test('importing a card with an existing id reports the replacement', () => {
  const w = fresh();
  A.createTeam(w, 'Pilot');
  const t = w.teams.active;
  const m = { id: 'peer-example-01', name: 'Pat', synthetic: false, issued: '2026-10-24', skills: ['sql-pipelines'], surveys: {}, mentorOptIn: false, mentorTopics: [], availability: 'unknown' as const, mentorIntro: '', qualificationClaims: [], orgCode: '', orgTitle: '', contribution: { stages: {}, source: '' } };
  assert.equal(A.importMember(w, t, m).replaced, false);
  const r = A.importMember(w, t, { ...m, name: 'Impostor' });
  assert.equal(r.replaced, true);
  assert.equal(r.previousName, 'Pat');
});

test('outline import creates drafts without answers; practice blocked until answered', () => {
  const w = fresh();
  const r = A.importOutline(w, '1.1 Explain the turnover process\nnot a task\n1.2 Describe escalation requirements', 'qualification-planning');
  assert.equal(r.created, 2);
  const id = w.workforce.modules[0]!.id;
  assert.throws(() => A.recordAttempt(w, id, 'reviewed'), A.ActionError);
  A.setModuleAnswer(w, id, 'Check owner and status');
  A.recordAttempt(w, id, 'reviewed');
  assert.equal(w.workforce.attempts.length, 1);
});

test('peer card disclosure is opt-in per field', () => {
  const w = fresh();
  A.confirmSkill(w, 'sql-pipelines');
  A.saveSurvey(w, 'sql-pipelines', { confidence: '4', performed: 'recent', method: 'independent', note: 'private note' });
  w.profile.credentials.push({ id: 'c', name: 'Cert', authority: '', expiry: '', created: '2026-10-24', source: 'self-entered', issued: '', verifier: '', provenance: 'claimed', note: '' });
  const minimal = buildPeerCard(w, 'Pat', { confidence: false, mentoring: false, credentials: false, org: false, contribution: false }, 'sp-0123456789');
  assert.deepEqual(minimal.surveys, {});
  assert.equal('qualificationClaims' in minimal, false);
  assert.equal('mentorOptIn' in minimal, false);
  assert.equal(JSON.stringify(minimal).includes('private note'), false);
  const full = buildPeerCard(w, 'Pat', { confidence: true, mentoring: true, credentials: true, org: true, contribution: true }, 'sp-0123456789');
  assert.equal(full.surveys['sql-pipelines']!.confidence, 4);
  assert.deepEqual(full.qualificationClaims, ['Cert']);
});

test('AES-GCM export round-trips and rejects a wrong passphrase', async () => {
  const env = await encryptJson({ hello: 'world' }, 'correct horse', 'test');
  assert.deepEqual(await decryptJson(env, 'correct horse'), { hello: 'world' });
  await assert.rejects(() => decryptJson(env, 'wrong passphrase'), /wrong passphrase/);
  await assert.rejects(() => encryptJson({}, 'short', 'test'), /at least 8/);
});
