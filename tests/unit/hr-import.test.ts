import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsvLine, parseHrFeed } from '../../src/core/hr-import';

const root = process.env.SHELLBACK_ROOT ?? process.cwd();
const fixture = readFileSync(path.join(root, 'examples', 'hr', 'hr-feed-synthetic.csv'), 'utf8');

test('CSV fields: quotes, commas inside quotes, doubled quotes', () => {
  assert.deepEqual(parseCsvLine('a,"b, c","say ""hi""",d'), ['a', 'b, c', 'say "hi"', 'd']);
  assert.deepEqual(parseCsvLine('x,,'), ['x', '', '']);
});

test('the synthetic feed imports as unverified drafts with no skills, and bad rows are skipped with a warning', () => {
  const r = parseHrFeed(fixture, '2026-10-31');
  assert.equal(r.rows, 6);
  assert.equal(r.members.length, 5);
  assert.ok(r.warnings.some((w) => /Row 7: no display_name/.test(w)), r.warnings.join(' | '));
  for (const m of r.members) {
    assert.equal(m.attested, false, `${m.id} is not attested`);
    assert.equal(m.synthetic, false);
    assert.deepEqual(m.skills, []);
    assert.match(m.draftNote, /Not confirmed by the person/);
    assert.match(m.id, /^hr-HR-10\d\d$/);
  }
  const ellis = r.members.find((m) => m.id === 'hr-HR-1005');
  assert.equal(ellis?.name, 'Ellis Duarte, Jr.', 'a quoted comma stays inside the name');
  const avery = r.members.find((m) => m.id === 'hr-HR-1001');
  assert.deepEqual(avery?.qualificationClaims, ['AWS Certified Cloud Practitioner', 'Power BI Data Analyst Associate (PL-300)']);
  assert.equal(avery?.orgTitle, 'Data analyst');
});

test('a feed without the required header is refused', () => {
  assert.throws(() => parseHrFeed('employee_id,name\nHR-1,A', '2026-10-31'), /missing "display_name"/);
  assert.throws(() => parseHrFeed('', '2026-10-31'), /empty/);
});

test('duplicate ids keep the first row and say so; the row cap is enforced', () => {
  const dup = 'employee_id,display_name,org_code,job_title,certifications\nHR-9,First,A,T,\nHR-9,Second,A,T,';
  const r = parseHrFeed(dup, '2026-10-31');
  assert.equal(r.members.length, 1);
  assert.equal(r.members[0]?.name, 'First');
  assert.match(r.warnings[0] ?? '', /appears more than once/);
  const big = ['employee_id,display_name,org_code,job_title,certifications', ...Array.from({ length: 501 }, (_, i) => `E${i},N${i},A,T,`)].join('\n');
  assert.throws(() => parseHrFeed(big, '2026-10-31'), /limit is 500/);
});

test('a byte-order mark and CRLF line endings are accepted', () => {
  const r = parseHrFeed('\uFEFFemployee_id,display_name,org_code,job_title,certifications\r\nHR-7,Quinn,A,T,\r\n', '2026-10-31');
  assert.equal(r.members.length, 1);
});
