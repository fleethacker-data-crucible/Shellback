import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parsePeerCard, parseWorkspace, peerCardSchema } from '../../src/core/schema';
import { buildPeerCard } from '../../src/core/share';

const root = process.env.SHELLBACK_ROOT ?? process.cwd();
const dir = path.join(root, 'examples', 'employees');
const doc = readFileSync(path.join(root, 'docs', 'PEER-CARD-CONTRACT.md'), 'utf8');
const documented = (key: string) => doc.includes(`\`${key}\``);
const cards = readdirSync(dir).filter((f) => f.endsWith('-peer-card.json'));
const read = (f: string) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Record<string, unknown>;
const validCard = () => structuredClone(read(cards[0]!));

test('every field the importer reads is documented', () => {
  for (const key of Object.keys(peerCardSchema.shape)) assert.ok(documented(key), `${key} is missing from docs/PEER-CARD-CONTRACT.md`);
});

test('every key in an example card is documented, including the ones the importer ignores', () => {
  assert.ok(cards.length >= 4);
  for (const f of cards) for (const key of Object.keys(read(f))) assert.ok(documented(key), `${f}: ${key} is missing from the contract`);
});

test('the example cards import, and fixture-only fields do not reach the team', () => {
  for (const f of cards) {
    const m = parsePeerCard(read(f));
    assert.equal(m.synthetic, false);
    assert.equal(m.attested, true);
    assert.equal('syntheticExample' in m, false, `${f}: syntheticExample must not be carried`);
    assert.ok(m.skills.length > 0, `${f} lists skills`);
  }
});

test('the contract refuses what it says it refuses', () => {
  assert.throws(() => parsePeerCard({ ...validCard(), format: 'other' }), /Not an opt-in Shellback peer card/);
  assert.throws(() => parsePeerCard({ ...validCard(), version: 2 }), /Not an opt-in Shellback peer card/);
  assert.throws(() => parsePeerCard({ ...validCard(), consent: false }), /Not an opt-in Shellback peer card/);
  assert.throws(() => parsePeerCard({ ...validCard(), id: 'short' }), /Not an opt-in Shellback peer card/);
  assert.throws(() => parsePeerCard({ ...validCard(), id: 'demo-1234' }), /reserved identifier/);
  assert.throws(() => parsePeerCard({ ...validCard(), id: 'self-current' }), /reserved identifier/);
});

test('the contract drops what it says it drops, without refusing the card', () => {
  const m = parsePeerCard({ ...validCard(), skills: ['sql-pipelines', 'not-a-skill'], surveys: { 'sql-pipelines': { confidence: 9, method: 'ai' }, 'data-quality': { confidence: 2, method: 'guided' } } });
  assert.deepEqual(m.skills, ['sql-pipelines']);
  assert.deepEqual(m.surveys, {}, 'an invalid confidence and a survey for an unlisted skill are both dropped');
  const n = parsePeerCard({ ...validCard(), availability: 'expert', issued: 'someday' });
  assert.equal(n.availability, 'unknown');
  assert.equal(n.issued, 'someday', 'known gap: issued is kept as written; the contract documents it');
});

test('a card the app exports matches the contract', () => {
  const { workspace } = parseWorkspace(JSON.parse(readFileSync(path.join(dir, 'casey-rivera-workspace.json'), 'utf8')));
  const card = buildPeerCard(workspace, 'Casey Rivera', { confidence: true, mentoring: true, credentials: true, org: true, contribution: true }, 'casey-rivera-export');
  const wire = JSON.parse(JSON.stringify(card)) as Record<string, unknown>;
  for (const key of Object.keys(wire)) assert.ok(documented(key), `exported ${key} is missing from the contract`);
  assert.equal(parsePeerCard(wire).name, 'Casey Rivera');
});

