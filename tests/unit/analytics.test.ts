import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newWorkspace } from '../../src/core/schema';
import { aggregate, defaultTeams, missionCoverage, participants, renewalState, selfParticipant, visibleConfidence, SELF_ID } from '../../src/core/analytics';
import { roiScenario } from '../../src/core/roi';
import { ROI_DEFAULTS } from '../../src/core/schema';
import { signalFor } from '../../src/app/viz/galaxy-model';

function ws() {
  const w = newWorkspace();
  w.teams = defaultTeams();
  w.profile.confirmed = ['aws-architecture'];
  w.profile.credentials = [{ id: 'c1', name: 'Secret Internal Cert', authority: '', expiry: '', created: '2026-10-24', source: 'self-entered' }];
  w.workforce.mentorship = { enabled: true, topics: ['aws-architecture'], availability: 'available', intro: 'hi' };
  return w;
}

test('self joins team tools only with consent', () => {
  const w = ws();
  assert.equal(selfParticipant(w), null);
  w.profile.consent = true;
  assert.equal(selfParticipant(w)!.id, SELF_ID);
});

test('consent shares skills only; mentoring and credentials need their own toggles (review bug #3)', () => {
  const w = ws();
  w.profile.consent = true;
  let me = selfParticipant(w)!;
  assert.deepEqual(me.qualificationClaims, []);
  assert.equal(me.mentorOptIn, false);
  assert.equal(me.availability, 'unknown');
  w.profile.shareCredentialsLocally = true;
  w.profile.shareMentoringLocally = true;
  me = selfParticipant(w)!;
  assert.deepEqual(me.qualificationClaims, ['Secret Internal Cert']);
  assert.equal(me.mentorOptIn, true);
});

test('aggregates count distinct people per domain and gate at 3', () => {
  const w = ws();
  const agg = aggregate(participants(w));
  assert.equal(agg.n, 6);
  assert.ok(agg.allowed);
  const two = aggregate(participants(w).slice(0, 2));
  assert.equal(two.allowed, false);
  assert.ok(agg.domainCounts.every((c) => c <= agg.n));
});

test('mission coverage reports gaps and unverified qualification text', () => {
  const w = ws();
  w.profile.consent = true;
  w.profile.shareCredentialsLocally = true;
  const res = missionCoverage(participants(w), [{ skill: 'aws-architecture', min: 2, credential: 'secret internal' }]);
  assert.equal(res[0]!.qualified.length, 1);
  assert.equal(res[0]!.gap, false);
});

test('withdrawn skills hide their confidence everywhere (review bug #2)', () => {
  const w = ws();
  w.profile.surveys['python-development'] = { confidence: 4, performed: 'recent', method: 'independent', note: '', updated: '2026-10-24' };
  assert.equal(visibleConfidence(w, 'python-development'), null);
  assert.equal(signalFor('python-development', w.profile).rated, false);
  w.profile.confirmed.push('python-development');
  assert.equal(visibleConfidence(w, 'python-development'), 4);
  assert.equal(signalFor('python-development', w.profile).value, 4);
});

test('renewal states use one consistent rule', () => {
  const now = new Date('2026-10-24T12:00:00');
  assert.equal(renewalState({ expiry: '' }, now).state, 'none');
  assert.equal(renewalState({ expiry: '2026-10-01' }, now).state, 'past');
  assert.equal(renewalState({ expiry: '2027-01-22' }, now).state, 'soon');
  assert.equal(renewalState({ expiry: '2027-01-23' }, now).state, 'future');
});

test('ROI keeps cash separate and matches the documented audit figure', () => {
  const p = { ...ROI_DEFAULTS, adoption: 100, realization: 70, trainingAvoidance: 0, overlap: 0 };
  const o = roiScenario(p);
  assert.equal(Math.round(o.grossWorkflow), 221_375); // 55 min × 100 × 46 wk × $75 × 70%
  assert.equal(o.cash, ROI_DEFAULTS.externalSpend * 0.1);
  assert.equal(roiScenario({ ...p, adoption: 0 }).capacity, 0);
  assert.equal(roiScenario({ ...p, annualCost: 0 }).multiple, null);
});
