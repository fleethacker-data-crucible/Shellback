import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newWorkspace } from '../../src/core/schema';
import { defaultTeams } from '../../src/core/analytics';
import { journey, nextStep } from '../../src/app/state/journey';
import * as A from '../../src/app/state/actions';
import { runScan } from '../../src/core/scanners';
import { SAMPLE_RESUME } from '../../src/core/taxonomy';

const fresh = () => { const w = newWorkspace(); w.teams = defaultTeams(); return w; };
const stateOf = (w: ReturnType<typeof fresh>, id: string) => journey(w).find((s) => s.id === id)!.state;

test('a fresh workspace points at intake first', () => {
  const w = fresh();
  assert.equal(nextStep(journey(w))!.id, 'intake');
  assert.equal(stateOf(w, 'reflect'), 'optional');
});

test('after a scan, review needs attention until every suggestion is handled', () => {
  const w = fresh();
  A.applyScan(w, runScan({ text: SAMPLE_RESUME, confirmed: [] }));
  assert.equal(stateOf(w, 'intake'), 'done');
  assert.equal(stateOf(w, 'review'), 'attention');
  assert.equal(stateOf(w, 'credentials'), 'attention');
  assert.equal(nextStep(journey(w))!.id, 'review');
  for (const id of [...w.profile.candidates]) A.dismissSkillCandidate(w, id);
  assert.equal(stateOf(w, 'review'), 'done');
  assert.equal(nextStep(journey(w))!.id, 'confirm', 'nothing confirmed yet');
});

test('dismissed suggestions never come back from a later scan; confirming clears a dismissal', () => {
  const w = fresh();
  A.applyScan(w, runScan({ text: SAMPLE_RESUME, confirmed: [] }));
  const first = w.profile.candidates[0]!;
  A.dismissSkillCandidate(w, first);
  A.applyScan(w, runScan({ text: SAMPLE_RESUME, confirmed: [] }));
  assert.ok(!w.profile.candidates.includes(first));
  A.confirmSkill(w, first);
  assert.ok(!w.profile.candidateDismissed.includes(first));
});

test('once skills are confirmed the next step is the first optional item needing attention, else reflection', () => {
  const w = fresh();
  A.confirmSkill(w, 'sql-pipelines');
  w.profile.lastScan = '2026-10-24';
  assert.equal(stateOf(w, 'confirm'), 'done');
  assert.equal(nextStep(journey(w))!.id, 'reflect');
  A.saveSurvey(w, 'sql-pipelines', { confidence: '3', performed: 'recent', method: 'independent', note: '' });
  assert.equal(stateOf(w, 'reflect'), 'done');
  assert.equal(nextStep(journey(w)), null, 'all required steps done and nothing needs attention');
});

test('team step counts only real teams, never the synthetic cohort', () => {
  const w = fresh();
  assert.equal(stateOf(w, 'team'), 'optional');
  A.createTeam(w, 'Pilot');
  A.importMember(w, w.teams.active, { id: 'peer-example-01', name: 'Pat', synthetic: false, issued: '2026-10-24', skills: ['sql-pipelines'], surveys: {}, mentorOptIn: false, mentorTopics: [], availability: 'unknown', mentorIntro: '', qualificationClaims: [], orgCode: '', orgTitle: '', contribution: { stages: {}, source: '', detail: {} }, attested: true, draftNote: '' });
  assert.equal(stateOf(w, 'team'), 'done');
});
