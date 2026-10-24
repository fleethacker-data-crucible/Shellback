/**
 * Local résumé scanners. Deterministic keyword matching — no AI, no network.
 * Results are *suggestions for employee review*; nothing here is proficiency evidence.
 */
import { SKILLS, SKILL_BY_ID } from './taxonomy';
import type { CredentialCandidate } from './schema';

export const MAX_SCAN_CHARS = 100_000;

// ----------------------------------------------------------------------------
// Skill suggestions
// ----------------------------------------------------------------------------
const keywordAliases: Readonly<Record<string, readonly string[]>> = {
  'sql-pipelines': ['sql', 'postgresql', 't-sql', 'sql server'],
  'data-modeling': ['data model', 'schema design'],
  'etl-elt': ['etl', 'elt', 'extract transform'],
  'aws-architecture': ['aws', 'amazon web services'],
  'infrastructure-as-code': ['terraform', 'cloudformation', 'iac'],
  'cloud-networking': ['vpc', 'route53'],
  'identity-access': ['iam', 'sso'],
  'javascript-development': ['javascript', 'typescript', 'js'],
  'powershell-automation': ['powershell', 'ps1'],
  'python-development': ['python'],
  'api-design': ['rest api', 'restful', 'api development'],
  'power-bi': ['power bi', 'powerbi'],
  'ci-cd-pipelines': ['ci/cd', 'github actions', 'azure pipelines'],
  'git-workflows': ['git', 'github', 'gitlab'],
  'agile-facilitation': ['agile', 'scrum', 'sprint'],
  'ai-orchestration': ['llm', 'ai agent', 'agentic', 'prompt engineering'],
  'ai-outcome-validation': ['ai validation', 'ai evaluation'],
  'responsible-ai-use': ['responsible ai', 'ai governance'],
  'rapid-prototyping': ['prototyping', 'proof of concept'],
  'knowledge-transfer': ['knowledge transfer', 'cross-training'],
  'systems-thinking': ['systems thinking'],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const skillPatterns = SKILLS.map((s) => ({
  id: s.id,
  re: new RegExp('(^|[^a-z0-9])(' + [s.name, ...(keywordAliases[s.id] ?? [])].map(escapeRe).join('|') + ')(?=$|[^a-z0-9])', 'gi'),
}));

/** Negation / absence cues that disqualify a keyword hit inside the same clause. */
const NEGATION_BEFORE = /\b(?:no|not|never|without|lack(?:s|ing)?|unfamiliar(?:\s+with)?|limited|minimal|zero|n't|non)\b[^.;\n]{0,40}$/i;
const CLAUSE_SPLIT = /[.;\n\r•|]+/;

export interface SkillScanResult { candidates: string[]; clauses: number }

/** Returns taxonomy skill ids mentioned in the text, excluding any id in `exclude`. */
export function scanSkills(rawText: string, exclude: Iterable<string> = []): SkillScanResult {
  const text = String(rawText ?? '').slice(0, MAX_SCAN_CHARS);
  const skip = new Set(exclude);
  const found = new Set<string>();
  const clauses = text.split(CLAUSE_SPLIT);
  for (const clause of clauses) {
    if (!clause.trim()) continue;
    for (const { id, re } of skillPatterns) {
      if (found.has(id) || skip.has(id)) continue;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(clause))) {
        const start = m.index + m[1].length;
        const before = clause.slice(Math.max(0, start - 48), start);
        if (!NEGATION_BEFORE.test(before)) { found.add(id); break; }
      }
    }
  }
  const ordered = SKILLS.filter((s) => found.has(s.id)).map((s) => s.id);
  return { candidates: ordered, clauses: clauses.length };
}

// ----------------------------------------------------------------------------
// Credential suggestions
// ----------------------------------------------------------------------------
interface CredentialDef {
  key: string;
  name: string;
  authority: string;
  /** Case-insensitive long-form phrases. */
  phrases: readonly string[];
  /** Case-SENSITIVE acronyms / exam codes (uppercase as printed). */
  codes: readonly string[];
  /** Acronym collides with common words or organizations; require certification context. */
  ambiguous?: boolean;
}

const C = (key: string, name: string, authority: string, phrases: string[], codes: string[], ambiguous = false): CredentialDef =>
  ({ key, name, authority, phrases, codes, ambiguous });

export const CREDENTIAL_CATALOG: readonly CredentialDef[] = [
  C('aws-sap', 'AWS Certified Solutions Architect – Professional', 'Amazon Web Services', [String.raw`AWS\s+(?:Certified\s+)?Solutions?\s+Architect\s*[-–:]?\s*Professional`], [String.raw`AWS[\s-]*SAP[\s-]*C0[12]`, String.raw`SAP[\s-]*C0[12]`]),
  C('aws-saa', 'AWS Certified Solutions Architect – Associate', 'Amazon Web Services', [String.raw`AWS\s+(?:Certified\s+)?Solutions?\s+Architect\s*[-–:]?\s*Associate`], [String.raw`AWS[\s-]*SAA[\s-]*C0[23]`, String.raw`SAA[\s-]*C0[23]`]),
  C('aws-cp', 'AWS Certified Cloud Practitioner', 'Amazon Web Services', [String.raw`AWS\s+(?:Certified\s+)?Cloud\s+Practitioner`], [String.raw`CLF[\s-]*C0[12]`]),
  C('aws-dev', 'AWS Certified Developer – Associate', 'Amazon Web Services', [String.raw`AWS\s+(?:Certified\s+)?Developer\s*[-–:]?\s*Associate`], [String.raw`DVA[\s-]*C0[12]`]),
  C('aws-sysops', 'AWS Certified SysOps Administrator – Associate', 'Amazon Web Services', [String.raw`AWS\s+(?:Certified\s+)?SysOps\s+Administrator\s*[-–:]?\s*Associate`], [String.raw`SOA[\s-]*C0[23]`]),
  C('aws-security', 'AWS Certified Security – Specialty', 'Amazon Web Services', [String.raw`AWS\s+(?:Certified\s+)?Security\s*[-–:]?\s*Specialty`], [String.raw`SCS[\s-]*C0[12]`]),
  C('security-plus', 'CompTIA Security+', 'CompTIA', [String.raw`(?:CompTIA\s+)?Security\s*\+`], [String.raw`SY0[\s-]*70[1-9]`]),
  C('network-plus', 'CompTIA Network+', 'CompTIA', [String.raw`(?:CompTIA\s+)?Network\s*\+`], [String.raw`N10[\s-]*00[89]`]),
  C('a-plus', 'CompTIA A+', 'CompTIA', [String.raw`CompTIA\s+A\s*\+`], [String.raw`220[\s-]*11(?:01|02)`]),
  C('cysa', 'CompTIA CySA+', 'CompTIA', [String.raw`(?:CompTIA\s+)?CySA\s*\+`], [String.raw`CS0[\s-]*00[34]`]),
  C('cissp', 'CISSP', 'ISC2', [String.raw`Certified\s+Information\s+Systems\s+Security\s+Professional`], ['CISSP']),
  C('ccsp', 'CCSP', 'ISC2', [String.raw`Certified\s+Cloud\s+Security\s+Professional`], ['CCSP']),
  C('cism', 'CISM', 'ISACA', [String.raw`Certified\s+Information\s+Security\s+Manager`], ['CISM']),
  C('cisa', 'CISA', 'ISACA', [String.raw`Certified\s+Information\s+Systems\s+Auditor`], ['CISA'], true),
  C('pmp', 'Project Management Professional (PMP)', 'Project Management Institute', [String.raw`Project\s+Management\s+Professional`], ['PMP']),
  C('capm', 'Certified Associate in Project Management (CAPM)', 'Project Management Institute', [String.raw`Certified\s+Associate\s+in\s+Project\s+Management`], ['CAPM']),
  C('csm', 'Certified ScrumMaster (CSM)', 'Scrum Alliance', [String.raw`Certified\s+Scrum\s*Master`], ['CSM'], true),
  C('psm', 'Professional Scrum Master (PSM)', 'Scrum.org', [String.raw`Professional\s+Scrum\s+Master`], [String.raw`PSM[\s-]*I{1,3}`], true),
  C('itil', 'ITIL Foundation', 'PeopleCert / AXELOS', [String.raw`ITIL\s+(?:[Vv]?[345]\s*)?(?:Foundation|Certification)`], [String.raw`ITIL\s*[Vv]?[345]`]),
  C('ccna', 'Cisco Certified Network Associate (CCNA)', 'Cisco', [String.raw`Cisco\s+Certified\s+Network\s+Associate`], ['CCNA']),
  C('ccnp', 'Cisco Certified Network Professional (CCNP)', 'Cisco', [String.raw`Cisco\s+Certified\s+Network\s+Professional`], ['CCNP']),
  C('az900', 'Microsoft Azure Fundamentals (AZ-900)', 'Microsoft', [String.raw`Azure\s+Fundamentals`], [String.raw`AZ[\s-]*900`]),
  C('az104', 'Microsoft Azure Administrator Associate (AZ-104)', 'Microsoft', [String.raw`Azure\s+Administrator\s+Associate`], [String.raw`AZ[\s-]*104`]),
  C('az305', 'Microsoft Azure Solutions Architect Expert (AZ-305)', 'Microsoft', [String.raw`Azure\s+Solutions?\s+Architect\s+Expert`], [String.raw`AZ[\s-]*305`]),
  C('dp900', 'Microsoft Azure Data Fundamentals (DP-900)', 'Microsoft', [String.raw`Azure\s+Data\s+Fundamentals`], [String.raw`DP[\s-]*900`]),
  C('pl300', 'Microsoft Power BI Data Analyst Associate (PL-300)', 'Microsoft', [String.raw`Power\s+BI\s+Data\s+Analyst\s+Associate`], [String.raw`PL[\s-]*300`]),
  C('gcp', 'Google Professional Cloud Architect', 'Google Cloud', [String.raw`Google\s+(?:Cloud\s+)?Professional\s+Cloud\s+Architect`, String.raw`Google\s+Cloud\s+Architect\s+Certification`], []),
  C('cka', 'Certified Kubernetes Administrator (CKA)', 'CNCF', [String.raw`Certified\s+Kubernetes\s+Administrator`], ['CKA'], true),
  C('ckad', 'Certified Kubernetes Application Developer (CKAD)', 'CNCF', [String.raw`Certified\s+Kubernetes\s+Application\s+Developer`], ['CKAD']),
  C('osha30', 'OSHA 30-Hour Training', 'OSHA-authorized provider', [String.raw`OSHA\s*[- ]?\s*30(?:[- ]?hour)?(?:\s+(?:training|certificate|card))?`], []),
  C('osha10', 'OSHA 10-Hour Training', 'OSHA-authorized provider', [String.raw`OSHA\s*[- ]?\s*10(?:[- ]?hour)?(?:\s+(?:training|certificate|card))?`], []),
  C('esws', 'Enlisted Surface Warfare Specialist (ESWS)', 'Self-reported Navy qualification', [String.raw`Enlisted\s+Surface\s+Warfare\s+Specialist`], ['ESWS']),
  C('eaws', 'Enlisted Aviation Warfare Specialist (EAWS)', 'Self-reported Navy qualification', [String.raw`Enlisted\s+Aviation\s+Warfare\s+Specialist`], ['EAWS']),
  C('eidws', 'Enlisted Information Dominance Warfare Specialist (EIDWS)', 'Self-reported Navy qualification', [String.raw`Enlisted\s+Information\s+Dominance\s+Warfare\s+Specialist`], ['EIDWS']),
];

const boundary = (p: string, flags: string) => new RegExp('(^|[^A-Za-z0-9])(' + p + ')(?=$|[^A-Za-z0-9])', flags);
const compiled = CREDENTIAL_CATALOG.map((d) => ({
  def: d,
  phraseRe: d.phrases.length ? boundary(d.phrases.join('|'), 'i') : null,
  codeRe: d.codes.length ? boundary(d.codes.join('|'), '') : null,
}));

const CERT_CONTEXT = /\b(?:certif(?:ied|ication|icate)s?|credential|licen[cs]e|accredit|qualification|\bcert\b|exam|designation)/i;
const FUTURE_BEFORE = /(?:pursu(?:ing|e)|studying(?:\s+for)?|prepar(?:ing|e|ed)(?:\s+for)?|working\s+toward(?:s)?|planning\s+to(?:\s+\w+)?|aspiring|seeking|hoping|not\s+(?:yet\s+)?certified|without|failed|candidate\s+for|enrolled\s+in|scheduled\s+for)\s*(?:for|a|the|to|in|an|my)?\s*$/i;
const FUTURE_AFTER = /^\s*[(\[\-–—:,]?\s*(?:exam\s+prep|study(?:ing)?|in[\s-]+progress|candidate|planned|pending|scheduled|target(?:ed)?|expected|anticipated|not\s+(?:yet\s+)?(?:complete|certified|obtained)|in\s+training)\b/i;

export function normalizedCredential(label: unknown): string {
  return String(label ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Map a free-text credential label to a catalog key, or null. Used for duplicate prevention. */
export function identifyCredential(label: unknown): string | null {
  const t = String(label ?? '').slice(0, 320);
  for (const { def, phraseRe, codeRe } of compiled) {
    if (phraseRe?.test(t) || codeRe?.test(t)) return def.key;
  }
  return null;
}

export const credentialKey = (label: unknown): string => identifyCredential(label) ?? normalizedCredential(label);

export function scanCredentials(rawText: string): CredentialCandidate[] {
  const text = String(rawText ?? '').slice(0, MAX_SCAN_CHARS);
  const results = new Map<string, CredentialCandidate>();
  const clauses = text.split(/[\n\r;•]+/).slice(0, 700);
  for (const clause of clauses) {
    if (!clause || clause.length > 1400) continue;
    const hasContext = CERT_CONTEXT.test(clause);
    for (const { def, phraseRe, codeRe } of compiled) {
      if (results.has(def.key)) continue;
      let m: RegExpExecArray | null = phraseRe ? phraseRe.exec(clause) : null;
      if (!m && codeRe) {
        m = codeRe.exec(clause);
        if (m && def.ambiguous && !hasContext) m = null;
      }
      if (!m) continue;
      const start = m.index + m[1].length;
      const end = start + m[2].length;
      const before = clause.slice(Math.max(0, start - 70), start);
      const after = clause.slice(end, end + 48);
      if (FUTURE_BEFORE.test(before) || FUTURE_AFTER.test(after)) continue;
      results.set(def.key, { key: def.key, name: def.name, authority: def.authority, matched: m[2].trim().slice(0, 100) });
    }
  }
  return [...results.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface ScanRequest { text: string; confirmed: string[] }
export interface ScanResponse { skills: string[]; credentials: CredentialCandidate[]; chars: number }

/** Full résumé scan — runs in the Web Worker, or on the main thread as a fallback. */
export function runScan({ text, confirmed }: ScanRequest): ScanResponse {
  const { candidates } = scanSkills(text, confirmed.filter((id) => SKILL_BY_ID.has(id)));
  return { skills: candidates, credentials: scanCredentials(text), chars: Math.min(text.length, MAX_SCAN_CHARS) };
}
