import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrgTree, flattenOrg, isWithin, normalizeOrgCode, orgAncestors, orgLevelName } from '../../src/core/org';
import { importContribution, parseEnergy, parseStage, stageCoverage, stageObservations, type Contribution } from '../../src/core/contribution';
import { newWorkspace, parsePeerCard, parseWorkspace } from '../../src/core/schema';
import { buildPeerCard } from '../../src/core/share';
import { defaultTeams, missionCoverage, participants, selfParticipant } from '../../src/core/analytics';
import * as A from '../../src/app/state/actions';

test('org codes nest by prefix: 1500 → 1510 → 1513 → 1513.1', () => {
  assert.deepEqual(orgAncestors('1513.1'), ['1513', '1510', '1500']);
  assert.deepEqual(orgAncestors('1513'), ['1510', '1500']);
  assert.deepEqual(orgAncestors('246'), ['240', '200']);
  assert.deepEqual(orgAncestors('1500'), []);
  assert.equal(orgLevelName('1500'), 'Department');
  assert.equal(orgLevelName('1510'), 'Division');
  assert.equal(orgLevelName('1513'), 'Branch');
  assert.equal(orgLevelName('1513.2'), 'Section');
  assert.equal(normalizeOrgCode(' Code 1513.1 '), '1513.1');
  assert.ok(isWithin('1513.1', '1500'));
  assert.ok(!isWithin('1520', '1510'));
});

test('org tree is derived from the codes people carry, with roll-up counts', () => {
  const people = [{ orgCode: '1513', name: 'a' }, { orgCode: '1513.1', name: 'b' }, { orgCode: '1520', name: 'c' }, { orgCode: '1500', name: 'd' }, { orgCode: '', name: 'none' }];
  const tree = buildOrgTree(people);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]!.code, '1500');
  assert.equal(tree[0]!.all.length, 4, 'everyone with a code rolls up to the department');
  const codes = flattenOrg(tree).map((n) => n.code);
  assert.deepEqual(codes, ['1500', '1510', '1513', '1513.1', '1520']);
  const branch = flattenOrg(tree).find((n) => n.code === '1513')!;
  assert.equal(branch.direct.length, 1);
  assert.equal(branch.all.length, 2);
});

test('stage coverage counts only people who shared preferences; observations stay about the team', () => {
  const c = (e: Record<string, string>): Contribution => ({ stages: e as Contribution['stages'], source: '' });
  const people = [
    { name: 'A', contribution: c({ question: 'energizing', finish: 'draining' }) },
    { name: 'B', contribution: c({ question: 'energizing', finish: 'draining' }) },
    { name: 'C', contribution: c({ ideate: 'energizing', finish: 'draining' }) },
    { name: 'D' },
  ];
  const cov = stageCoverage(people);
  assert.deepEqual(cov.find((r) => r.stage.id === 'question')!.energized, ['A', 'B']);
  assert.equal(cov.find((r) => r.stage.id === 'finish')!.drained.length, 3);
  const notes = stageObservations(cov, 3);
  assert.ok(notes.some((n) => /finishing and pushing through/.test(n) && /Nobody/.test(n)));
  assert.ok(notes.some((n) => /Implementation work drains/.test(n)));
  assert.ok(notes.every((n) => !/\bA\b|\bB\b|\bC\b/.test(n)), 'no individual names in observations');
});

test('org and contribution are shared only behind their own opt-ins (local and on cards)', () => {
  const w = newWorkspace(); w.teams = defaultTeams();
  A.confirmSkill(w, 'sql-pipelines');
  A.setOrg(w, '1513', 'Branch Head');
  A.setContributionStage(w, 'rally', 'energizing');
  w.profile.consent = true;
  let me = selfParticipant(w)!;
  assert.equal(me.orgCode, '');
  assert.deepEqual(me.contribution.stages, {});
  w.profile.shareOrgLocally = true; w.profile.shareContributionLocally = true;
  me = selfParticipant(w)!;
  assert.equal(me.orgCode, '1513');
  assert.equal(me.contribution.stages.rally, 'energizing');
  const plain = buildPeerCard(w, 'Pat', { confidence: false, mentoring: false, credentials: false, org: false, contribution: false }, 'sp-0123456789');
  assert.ok(!('orgCode' in plain) && !('contribution' in plain));
  const full = buildPeerCard(w, 'Pat', { confidence: false, mentoring: false, credentials: false, org: true, contribution: true }, 'sp-0123456789');
  assert.equal(full.orgCode, '1513');
  const imported = parsePeerCard(JSON.parse(JSON.stringify(full)));
  assert.equal(imported.orgTitle, 'Branch Head');
  assert.equal(imported.contribution.stages.rally, 'energizing');
  assert.equal(parsePeerCard({ ...full, orgCode: 'Code 1513.1', contribution: { stages: { rally: 'bogus', finish: 'draining' } } }).orgCode, '1513.1');
  assert.deepEqual(parsePeerCard({ ...full, contribution: { stages: { rally: 'bogus', finish: 'draining' } } }).contribution.stages, { finish: 'draining' });
});

test('a mission requirement can ask for a stage; coverage reports who is energized by it', () => {
  const w = newWorkspace(); w.teams = defaultTeams();
  A.addRequirement(w, { skill: 'aws-architecture', min: 1, credential: '', stage: 'rally' });
  assert.equal(w.workforce.mission.requirements[0]!.stage, 'rally');
  const res = missionCoverage(participants(w), w.workforce.mission.requirements);
  assert.ok(res[0]!.covered.length >= 1);
  assert.ok(res[0]!.energized.every((p) => p.contribution.stages.rally === 'energizing'));
  const again = parseWorkspace(JSON.parse(JSON.stringify(w))).workspace;
  assert.equal(again.workforce.mission.requirements[0]!.stage, 'rally');
});

test('contribution import: CSV and JSON, vendor-neutral synonyms, unknown rows reported', () => {
  const csv = 'stage,energy\nRallying people,energizes\nfinish,drains\n3,neutral\nAsking the big questions,love it\nbogus,whatever\nno separator here';
  const r = importContribution(csv);
  assert.equal(r.applied, 4);
  assert.deepEqual(r.contribution.stages, { rally: 'energizing', finish: 'draining', evaluate: 'neutral', question: 'energizing' });
  assert.equal(r.skipped.length, 2);
  const json = importContribution(JSON.stringify({ source: 'team workshop 2026-09', stages: { ideate: 'frustration', support: 'competency' } }));
  assert.deepEqual(json.contribution.stages, { ideate: 'draining', support: 'neutral' });
  assert.equal(json.contribution.source, 'team workshop 2026-09');
  const arr = importContribution(JSON.stringify([{ stage: 'Helping it happen', energy: '+' }, { stage: 'invention', energy: 'high' }]));
  assert.deepEqual(arr.contribution.stages, { support: 'energizing', ideate: 'energizing' });
  // Existing answers are kept unless overwritten
  const merged = importContribution('finish,energizing', { stages: { rally: 'draining' }, source: 'me' });
  assert.deepEqual(merged.contribution.stages, { rally: 'draining', finish: 'energizing' });
  assert.equal(importContribution('{not json').skipped[0], 'File is not valid JSON.');
  assert.equal(parseStage('Tenacity'), 'finish');
  assert.equal(parseEnergy('Genius'), 'energizing');
  assert.equal(parseStage('something else'), null);
});
