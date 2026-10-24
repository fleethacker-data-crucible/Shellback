import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanCredentials, scanSkills, identifyCredential, credentialKey } from '../../src/core/scanners';
import { SAMPLE_RESUME } from '../../src/core/taxonomy';

const keys = (text: string) => scanCredentials(text).map((c) => c.key).sort();

test('sample résumé yields exactly the three held credentials, not the pursued one', () => {
  assert.deepEqual(keys(SAMPLE_RESUME), ['aws-sap', 'pmp', 'security-plus']);
});

test('pursuing / in-progress / planned credentials are not suggested', () => {
  assert.deepEqual(keys('Pursuing CISSP.'), []);
  assert.deepEqual(keys('CISSP (in progress)'), []);
  assert.deepEqual(keys('CISSP - expected 2027'), []);
  assert.deepEqual(keys('Studying for the CompTIA Security+ exam'), []);
  assert.deepEqual(keys('Working toward PMP certification'), []);
});

test('ambiguous acronyms need certification context (review bug #4)', () => {
  assert.deepEqual(keys('Coordinated with CISA on incident response. Our CSM team owns renewals. Used PSM methodology.'), []);
  assert.deepEqual(keys('Certifications: CISA, CSM'), ['cisa', 'csm']);
});

test('acronym codes are case-sensitive; long names are not', () => {
  assert.deepEqual(keys('i used pmp-style planning'), []);
  assert.deepEqual(keys('project management professional (certified 2023)'), ['pmp']);
});

test('negated skills are not suggested (review bug #6)', () => {
  const { candidates } = scanSkills('I am not a Python developer; no Git experience; never used SQL. Built Power BI dashboards.');
  assert.deepEqual(candidates, ['power-bi']);
});

test('skill aliases match on word boundaries only', () => {
  assert.deepEqual(scanSkills('Built a prototype').candidates, []);
  assert.deepEqual(scanSkills('Rapid prototyping and proof of concept work').candidates, ['rapid-prototyping']);
  assert.ok(!scanSkills('jsonschema tooling').candidates.includes('javascript-development'));
});

test('confirmed skills are excluded from suggestions', () => {
  assert.ok(!scanSkills('SQL and AWS', ['sql-pipelines']).candidates.includes('sql-pipelines'));
});

test('credential identity is stable across spellings for duplicate prevention', () => {
  assert.equal(identifyCredential('AWS Certified Solutions Architect – Professional'), 'aws-sap');
  assert.equal(credentialKey('AWS Solutions Architect Professional'), credentialKey('AWS Certified Solutions Architect - Professional'));
  assert.equal(credentialKey('My Internal Badge'), 'myinternalbadge');
});

test('scan input is bounded', () => {
  const big = 'SQL '.repeat(60_000);
  assert.deepEqual(scanSkills(big).candidates, ['sql-pipelines']);
});
