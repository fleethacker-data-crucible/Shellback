import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWorkspace, parsePeerCard, newWorkspace, SCHEMA_VERSION } from '../../src/core/schema';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`../../examples/employees/${name}`, import.meta.url), 'utf8'));

test('all four v1 persona workspaces migrate to v2 without losing confirmed skills', () => {
  for (const p of ['morgan-vale', 'riley-chen', 'jordan-brooks', 'casey-rivera']) {
    const raw = fixture(`${p}-workspace.json`);
    const { workspace, migratedFrom, warnings } = parseWorkspace(raw);
    assert.equal(migratedFrom, 1, p);
    assert.equal(workspace.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(workspace.profile.confirmed, raw.profile.confirmed, p);
    assert.equal(Object.keys(workspace.profile.surveys).length, Object.keys(raw.profile.surveys).length, p);
    assert.deepEqual(warnings, [], p);
  }
});

test('a v2 workspace round-trips unchanged', () => {
  const ws = newWorkspace();
  ws.profile.confirmed = ['sql-pipelines'];
  ws.profile.surveys['sql-pipelines'] = { confidence: 3, performed: 'recent', method: 'independent', note: '', updated: '2026-10-24' };
  const again = parseWorkspace(JSON.parse(JSON.stringify(ws))).workspace;
  assert.deepEqual(again, ws);
});

test('malformed records are dropped with warnings, not fatal (review bug #9)', () => {
  const raw = { version: 1, profile: { confirmed: ['sql-pipelines', 'not-a-skill'], surveys: {}, credentials: [null, { name: 'Valid cert', id: 'c1' }, 42], consent: 'yes' }, roi: {}, teams: { active: 'x', items: [null, { id: 't1', name: 'Team', members: [null, { id: 'm1', name: 'Pat' }] }] } };
  const { workspace, warnings } = parseWorkspace(raw);
  assert.deepEqual(workspace.profile.confirmed, ['sql-pipelines']);
  assert.equal(workspace.profile.credentials.length, 1);
  assert.equal(workspace.profile.consent, false, 'bad consent value coerced to off, rest of workspace kept (review bug #8)');
  assert.equal(workspace.teams.items.length, 1);
  assert.equal(workspace.teams.items[0]!.members.length, 1);
  assert.equal(workspace.teams.active, 't1');
  assert.ok(warnings.length >= 2);
});

test('non-workspace input is rejected clearly', () => {
  assert.throws(() => parseWorkspace(null), /not a Shellback workspace/);
  assert.throws(() => parseWorkspace({ version: 9 }), /Unrecognized/);
});

test('survey confidence is bounded and attached only to known skills', () => {
  const raw = { version: 1, profile: { confirmed: [], surveys: { 'sql-pipelines': { confidence: 9 }, 'power-bi': { confidence: '3', method: 'weird' }, bogus: { confidence: 2 } }, credentials: [], consent: false }, roi: {} };
  const { workspace } = parseWorkspace(raw);
  assert.deepEqual(Object.keys(workspace.profile.surveys), ['power-bi']);
  assert.equal(workspace.profile.surveys['power-bi']!.method, 'none');
});

test('ROI inputs are clamped (percentages to 100)', () => {
  const { workspace } = parseWorkspace({ version: 1, profile: { confirmed: [], surveys: {}, credentials: [], consent: false }, roi: { adoption: 400, employees: -5, weeks: 'x' } });
  assert.equal(workspace.roi.adoption, 100);
  assert.equal(workspace.roi.employees, 100);
  assert.equal(workspace.roi.weeks, 46);
});

test('peer card fixtures parse; surveys only for shared skills', () => {
  for (const p of ['morgan-vale', 'riley-chen', 'jordan-brooks', 'casey-rivera']) {
    const m = parsePeerCard(fixture(`${p}-peer-card.json`));
    assert.ok(m.skills.length > 0);
    for (const id of Object.keys(m.surveys)) assert.ok(m.skills.includes(id));
  }
});

test('peer card without consent or with a bad id is refused', () => {
  const base = { format: 'synapse-peer-card', version: 1, id: 'peer-example-01', name: 'Pat', consent: true, skills: ['sql-pipelines'] };
  assert.ok(parsePeerCard(base));
  assert.throws(() => parsePeerCard({ ...base, consent: false }));
  assert.throws(() => parsePeerCard({ ...base, id: 'x' }));
  assert.throws(() => parsePeerCard({ ...base, name: '   ' }));
});

test('reserved member ids are refused; duplicate ids are collapsed (independent review #7, #8)', () => {
  const base = { format: 'synapse-peer-card', version: 1, name: 'X', consent: true, skills: ['sql-pipelines'] };
  assert.throws(() => parsePeerCard({ ...base, id: 'self-current' }), /reserved/);
  assert.throws(() => parsePeerCard({ ...base, id: 'demo-12345678' }), /reserved/);
  const ws = newWorkspace();
  const raw = { ...ws, teams: { active: 't', items: [{ id: 't', name: 'A', members: [{ id: 'm1', name: 'P' }, { id: 'm1', name: 'Q' }] }, { id: 't', name: 'B' }] } };
  const parsed = parseWorkspace(JSON.parse(JSON.stringify(raw))).workspace;
  assert.equal(parsed.teams.items.length, 1);
  assert.deepEqual(parsed.teams.items[0]!.members.map((m) => m.name), ['P']);
});

test('a v2 file with missing or null sections still imports (independent review #8)', () => {
  const ws = JSON.parse(JSON.stringify(newWorkspace()));
  ws.profile.confirmed = ['sql-pipelines'];
  delete ws.workforce;
  ws.teams = null;
  delete ws.meta;
  const parsed = parseWorkspace(ws).workspace;
  assert.deepEqual(parsed.profile.confirmed, ['sql-pipelines']);
  assert.deepEqual(parsed.workforce.modules, []);
  assert.deepEqual(parsed.teams.items, []);
  assert.equal(parsed.meta.rev, 0);
});
