/**
 * HR feed import (synthetic feed only until an authoritative feed is approved; see docs/HR-FEED.md).
 * Each record becomes an unverified draft member: it carries the organisation code, job title and
 * certification names HR holds, and no skills. The person has not attested to any of it, so the
 * draft stays out of coverage unless a supervisor includes drafts.
 */
import { memberSchema, type Member } from './schema';

export const HR_FEED_COLUMNS = ['employee_id', 'display_name', 'org_code', 'job_title', 'certifications'] as const;
export const HR_FEED_MAX_ROWS = 500;

/** One CSV line into fields. Handles double-quoted fields with commas and doubled quotes. No multi-line fields. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface HrImportResult { members: Member[]; warnings: string[]; rows: number }

/** Parse a feed. Throws if the header is wrong; bad rows are skipped with a warning, never fatal. */
export function parseHrFeed(text: string, importedOn: string): HrImportResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) throw new Error('The HR feed is empty.');
  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const col: Record<string, number> = {};
  for (const name of HR_FEED_COLUMNS) {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Not an HR feed: the header is missing "${name}".`);
    col[name] = i;
  }
  const records = lines.slice(1);
  if (records.length > HR_FEED_MAX_ROWS) throw new Error(`The HR feed has ${records.length} rows; the limit is ${HR_FEED_MAX_ROWS}.`);
  const warnings: string[] = [];
  const seen = new Set<string>();
  const members: Member[] = [];
  records.forEach((line, n) => {
    const f = parseCsvLine(line);
    const get = (name: (typeof HR_FEED_COLUMNS)[number]) => f[col[name]!] ?? '';
    const rowNo = n + 2;
    const employeeId = get('employee_id');
    const name = get('display_name').slice(0, 70);
    if (!employeeId) { warnings.push(`Row ${rowNo}: no employee_id, skipped.`); return; }
    if (!name) { warnings.push(`Row ${rowNo}: no display_name, skipped.`); return; }
    const id = `hr-${employeeId.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 60)}`;
    if (seen.has(id)) { warnings.push(`Row ${rowNo}: ${employeeId} appears more than once; the first row is kept.`); return; }
    seen.add(id);
    const certs = get('certifications').split(';').map((c) => c.trim().slice(0, 160)).filter(Boolean).slice(0, 100);
    members.push(memberSchema.parse({
      id, name, synthetic: false, issued: importedOn, skills: [], surveys: {}, mentorOptIn: false, mentorTopics: [], availability: 'unknown', mentorIntro: '',
      qualificationClaims: certs, orgCode: get('org_code'), orgTitle: get('job_title').slice(0, 80), contribution: { stages: {}, source: '', detail: {} },
      attested: false, draftNote: `From the HR feed on ${importedOn}. Not confirmed by the person.`,
    }));
  });
  return { members, warnings, rows: records.length };
}
