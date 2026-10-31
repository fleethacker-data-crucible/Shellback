import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareReports, evaluateProvider, parseGoldSet, scoreSets } from '../../src/core/evaluation';
import { BUILTIN_GOLD_SET } from '../../src/core/evaluation-data';
import { localRulesProvider, type IntelligenceProvider } from '../../src/core/intelligence';

const providerFrom = (scan: IntelligenceProvider['scanResume'], id = 'fake'): IntelligenceProvider => ({ ...localRulesProvider, describe: () => ({ id, label: id, dataHandling: 'test', offline: true }), scanResume: scan });

test('scoreSets: precision, recall and the empty-answer convention', () => {
  assert.deepEqual(scoreSets(['a', 'b'], ['a', 'b']), { expected: 2, predicted: 2, correct: 2, precision: 1, recall: 1, f1: 1 });
  const half = scoreSets(['a', 'b'], ['a', 'c']);
  assert.equal(half.precision, 0.5);
  assert.equal(half.recall, 0.5);
  assert.equal(scoreSets([], []).f1, 1, 'nothing expected and nothing suggested is a perfect answer');
  assert.equal(scoreSets([], ['x']).precision, 0, 'a suggestion where none was expected is wrong');
  assert.equal(scoreSets(['a'], []).recall, 0);
});

test('the built-in set is valid, synthetic and covers traps', () => {
  assert.ok(BUILTIN_GOLD_SET.cases.length >= 8);
  assert.ok(BUILTIN_GOLD_SET.cases.some((c) => c.expectedSkills.length === 0), 'has a no-evidence case');
  assert.ok(BUILTIN_GOLD_SET.cases.some((c) => /\bno Power BI\b/i.test(c.text)), 'has a negation case');
  assert.ok(BUILTIN_GOLD_SET.cases.some((c) => /pursuing/i.test(c.text)), 'has an in-progress credential case');
  for (const c of BUILTIN_GOLD_SET.cases) assert.ok(!/@|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/.test(c.text), `${c.id} has no contact details`);
});

test('parseGoldSet rejects unknown skills, unknown credentials and duplicate ids', () => {
  const base = { format: 'shellback-evaluation-set', version: 1, cases: [{ id: 'a', title: 'A', text: 'x', expectedSkills: ['sql-pipelines'], expectedCredentials: ['pmp'] }] };
  assert.equal(parseGoldSet(base).cases.length, 1);
  assert.throws(() => parseGoldSet({ ...base, cases: [{ ...base.cases[0], expectedSkills: ['nope'] }] }), /unknown skill id/);
  assert.throws(() => parseGoldSet({ ...base, cases: [{ ...base.cases[0], expectedCredentials: ['nope'] }] }), /unknown credential key/);
  assert.throws(() => parseGoldSet({ ...base, cases: [base.cases[0], base.cases[0]] }), /duplicate case id/);
  assert.throws(() => parseGoldSet({ format: 'other' }), /Not a Shellback evaluation set/);
});

test('local rules baseline on the built-in set: precise, with known recall headroom', async () => {
  const r = await evaluateProvider(localRulesProvider, BUILTIN_GOLD_SET.cases);
  assert.equal(r.failed, 0);
  assert.ok(r.micro.skills.precision >= 0.9, `skills precision ${r.micro.skills.precision}`);
  assert.ok(r.micro.skills.recall >= 0.8, `skills recall ${r.micro.skills.recall}`);
  assert.ok(r.micro.credentials.precision >= 0.9, `credential precision ${r.micro.credentials.precision}`);
  assert.ok(r.micro.credentials.recall >= 0.9, `credential recall ${r.micro.credentials.recall}`);
  const byId = new Map(r.cases.map((c) => [c.id, c]));
  assert.deepEqual(byId.get('negation-trap')!.skills.extra, [], 'negated skills are not suggested');
  assert.deepEqual(byId.get('cloud-architect')!.credentials.extra, [], 'a credential still being pursued is not suggested');
  assert.deepEqual(byId.get('no-evidence')!.skills.extra, []);
  assert.ok(byId.get('paraphrase')!.skills.missed.includes('mentoring'), 'keyword matching misses paraphrased evidence; that is what a model should improve');
});

test('a perfect oracle scores 100% and a silent provider scores 0% recall', async () => {
  const oracle = providerFrom(async ({ text }) => {
    const c = BUILTIN_GOLD_SET.cases.find((x) => x.text === text)!;
    return { skills: c.expectedSkills, credentials: c.expectedCredentials.map((key) => ({ key, name: key, authority: '', matched: key })), chars: text.length };
  }, 'oracle');
  const silent = providerFrom(async ({ text }) => ({ skills: [], credentials: [], chars: text.length }), 'silent');
  const best = await evaluateProvider(oracle, BUILTIN_GOLD_SET.cases);
  const none = await evaluateProvider(silent, BUILTIN_GOLD_SET.cases);
  assert.equal(best.micro.skills.f1, 1);
  assert.equal(best.micro.credentials.f1, 1);
  assert.equal(none.micro.skills.recall, 0);
  const baseline = await evaluateProvider(localRulesProvider, BUILTIN_GOLD_SET.cases);
  assert.ok(compareReports(baseline, best).skillsF1 > 0);
  assert.deepEqual(compareReports(baseline, best).regressions, []);
  assert.ok(compareReports(baseline, none).regressions.length > 0, 'a silent provider regresses cases the baseline got right');
});

test('a throwing provider scores zero for the failed case and the run continues', async () => {
  let n = 0;
  const flaky = providerFrom(async ({ text }) => { if (n++ === 0) throw new Error('boom'); return { skills: [], credentials: [], chars: text.length }; }, 'flaky');
  const seen: number[] = [];
  const r = await evaluateProvider(flaky, BUILTIN_GOLD_SET.cases, (d) => seen.push(d));
  assert.equal(r.failed, 1);
  assert.equal(r.cases[0]!.error, 'boom');
  assert.equal(r.cases[0]!.skills.precision, 0);
  assert.equal(r.cases.length, BUILTIN_GOLD_SET.cases.length);
  assert.equal(seen.at(-1), BUILTIN_GOLD_SET.cases.length);
});

test('suggestions outside the taxonomy are ignored, not counted', async () => {
  const sloppy = providerFrom(async ({ text }) => ({ skills: ['not-a-skill'], credentials: [], chars: text.length }), 'sloppy');
  const r = await evaluateProvider(sloppy, BUILTIN_GOLD_SET.cases.slice(0, 1));
  assert.equal(r.cases[0]!.skills.predicted, 0);
});
