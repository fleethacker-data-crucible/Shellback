/**
 * Capability taxonomy: 13 domains × 8 task-oriented skills = 104 skills.
 * Skill ids are stable slugs; every persisted record references skills by id.
 * Nothing here is a proficiency scale — a skill is either attested by the employee or not.
 */

export interface Domain {
  readonly index: number;
  readonly name: string;
  /** Short label for dense charts. */
  readonly short: string;
  readonly color: string;
}

export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly di: number;
  readonly si: number;
  /** Concrete task used for the confidence pulse question. */
  readonly task: string;
}

const domainDefs: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Data Engineering', ['SQL Pipelines', 'Data Modeling', 'ETL / ELT', 'Data Quality', 'Database Design', 'Data Governance', 'Streaming Data', 'Data Integration']],
  ['Cloud & Infrastructure', ['AWS Architecture', 'Infrastructure as Code', 'Cloud Networking', 'Identity & Access', 'Cost Optimization', 'Resilience & Recovery', 'Container Platforms', 'Cloud Observability']],
  ['Cybersecurity & Compliance', ['Security Controls', 'Threat Modeling', 'Vulnerability Triage', 'Security Documentation', 'Access Reviews', 'Zero Trust Design', 'Incident Readiness', 'Risk Assessment']],
  ['Software Development', ['JavaScript Development', 'PowerShell Automation', 'Python Development', 'API Design', 'Frontend Engineering', 'Backend Services', 'Code Reviews', 'Application Architecture']],
  ['Analytics & BI', ['Power BI', 'Dashboard Design', 'Statistical Analysis', 'Metrics Definition', 'Data Storytelling', 'Forecasting', 'Data Visualization', 'Exploratory Analysis']],
  ['Systems Engineering', ['Requirements Analysis', 'Systems Integration', 'Interface Control', 'Architecture Modeling', 'Trade Studies', 'Configuration Management', 'Reliability Analysis', 'Verification Planning']],
  ['DevOps & Automation', ['CI/CD Pipelines', 'Git Workflows', 'Test Automation', 'Release Engineering', 'Monitoring & Alerting', 'Build Tooling', 'Environment Management', 'Workflow Automation']],
  ['Project & Program Delivery', ['Agile Facilitation', 'Roadmap Planning', 'Stakeholder Alignment', 'Risk Register', 'Resource Planning', 'Milestone Tracking', 'Backlog Refinement', 'Outcome Measurement']],
  ['Shipyard & Mission Operations', ['Qualification Planning', 'Work Package Readiness', 'Fleet Sustainment', 'Shipyard Process Mapping', 'Technical Work Instructions', 'Maintenance Coordination', 'Mission Continuity', 'Safety Process Awareness']],
  ['Quality & Testing', ['Test Strategy', 'Acceptance Criteria', 'Defect Triage', 'Quality Assurance', 'Regression Testing', 'Root Cause Analysis', 'Process Improvement', 'Audit Evidence']],
  ['Knowledge & Training', ['Knowledge Transfer', 'Mentoring', 'Technical Writing', 'Curriculum Design', 'Training Facilitation', 'Skills Taxonomy Design', 'Onboarding Plans', 'Documentation Stewardship']],
  ['Collaboration & Leadership', ['Cross-Team Facilitation', 'Technical Communication', 'Conflict Navigation', 'Decision Framing', 'Peer Coaching', 'Change Management', 'Customer Discovery', 'Inclusive Collaboration']],
  ['Innovation, Vision & AI Orchestration', ['Problem Framing', 'Creative Vision', 'Product Judgment', 'Systems Thinking', 'AI Orchestration', 'AI Outcome Validation', 'Rapid Prototyping', 'Responsible AI Use']],
];

export const DOMAIN_COLORS: readonly string[] = ['#56e3ce', '#70b4ff', '#bb91f8', '#ffc278', '#f485af', '#7de0a3', '#f2a379', '#96a5ff', '#e7cd75', '#5ac6e7', '#bfdd7c', '#e497e7', '#6af1ff'];

const tasks: Readonly<Record<string, string>> = {
  'SQL Pipelines': 'Diagnose a failed SQL pipeline and validate its corrected output.',
  'AWS Architecture': 'Plan and implement a basic AWS infrastructure change using approved procedures.',
  'AI Orchestration': 'Direct an approved AI-enabled workflow and independently validate its result.',
  'Problem Framing': 'Turn an ambiguous workflow problem into testable objectives and success criteria.',
  'PowerShell Automation': 'Build, review, and safely test a PowerShell automation script.',
  'Qualification Planning': 'Identify upcoming qualification renewals and coordinate a timely action plan.',
  'Power BI': 'Build a dashboard with traceable measures and check source-data quality.',
  'Agile Facilitation': 'Facilitate a focused sprint review and capture decisions and follow-ups.',
  'Threat Modeling': 'Identify likely system threats and recommend practical mitigations.',
  'Technical Writing': 'Create work instructions that another team member can safely follow.',
  'AI Outcome Validation': 'Check an AI-produced recommendation against evidence, tests, and requirements.',
  'Data Quality': 'Define and test checks for missing, duplicated, or inconsistent records.',
};

export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const DOMAINS: readonly Domain[] = domainDefs.map(([name], index) => ({
  index,
  name,
  short: name.replace(' & ', ' / ').split(',')[0] ?? name,
  color: DOMAIN_COLORS[index] ?? '#9fb3c8',
}));

export const SKILLS: readonly Skill[] = domainDefs.flatMap(([domain, labels], di) =>
  labels.map((name, si) => ({
    id: slug(name),
    name,
    domain,
    di,
    si,
    task: tasks[name] ?? `Apply ${name.toLowerCase()} to a clearly defined, reviewable work task using approved procedures.`,
  })),
);

export const SKILL_BY_ID: ReadonlyMap<string, Skill> = new Map(SKILLS.map((s) => [s.id, s]));
export const isSkillId = (id: unknown): id is string => typeof id === 'string' && SKILL_BY_ID.has(id);
export const skillName = (id: string): string => SKILL_BY_ID.get(id)?.name ?? id;
export const skillsInDomain = (di: number): Skill[] => SKILLS.filter((s) => s.di === di);

/** Curated cross-domain learning connections for the Pathways galaxy. */
export const BRIDGES: ReadonlyArray<readonly [string, string]> = [
  ['sql-pipelines', 'power-bi'], ['sql-pipelines', 'data-quality'], ['aws-architecture', 'identity-access'],
  ['aws-architecture', 'infrastructure-as-code'], ['powershell-automation', 'workflow-automation'],
  ['git-workflows', 'ci-cd-pipelines'], ['ai-orchestration', 'ai-outcome-validation'],
  ['shipyard-process-mapping', 'qualification-planning'], ['root-cause-analysis', 'data-quality'],
  ['knowledge-transfer', 'mentoring'], ['systems-thinking', 'systems-integration'],
  ['responsible-ai-use', 'security-controls'], ['rapid-prototyping', 'frontend-engineering'],
  ['requirements-analysis', 'acceptance-criteria'], ['threat-modeling', 'risk-assessment'],
  ['cloud-observability', 'monitoring-alerting'], ['dashboard-design', 'metrics-definition'],
  ['technical-writing', 'technical-work-instructions'], ['test-automation', 'regression-testing'],
  ['product-judgment', 'stakeholder-alignment'], ['cross-team-facilitation', 'agile-facilitation'],
  ['data-governance', 'audit-evidence'], ['incident-readiness', 'resilience-recovery'],
  ['ai-outcome-validation', 'quality-assurance'],
];

/** Fictional six-person cohort used by the synthetic demo team. */
export const SYNTHETIC_COHORT: ReadonlyArray<{ name: string; skills: string[] }> = [
  { name: 'Demo participant A', skills: ['sql-pipelines', 'data-modeling', 'aws-architecture', 'data-quality', 'power-bi', 'api-design', 'knowledge-transfer', 'problem-framing', 'ai-orchestration'] },
  { name: 'Demo participant B', skills: ['aws-architecture', 'cloud-networking', 'security-controls', 'incident-readiness', 'ci-cd-pipelines', 'git-workflows', 'agile-facilitation', 'qualification-planning', 'technical-writing'] },
  { name: 'Demo participant C', skills: ['requirements-analysis', 'systems-integration', 'trade-studies', 'shipyard-process-mapping', 'technical-work-instructions', 'risk-register', 'test-strategy', 'root-cause-analysis', 'mentoring'] },
  { name: 'Demo participant D', skills: ['sql-pipelines', 'data-governance', 'power-bi', 'dashboard-design', 'forecasting', 'metrics-definition', 'data-storytelling', 'training-facilitation', 'product-judgment'] },
  { name: 'Demo participant E', skills: ['powershell-automation', 'frontend-engineering', 'backend-services', 'test-automation', 'workflow-automation', 'knowledge-transfer', 'rapid-prototyping', 'ai-outcome-validation', 'quality-assurance'] },
  { name: 'Demo participant F', skills: ['cloud-observability', 'aws-architecture', 'configuration-management', 'shipyard-process-mapping', 'qualification-planning', 'milestone-tracking', 'peer-coaching', 'systems-thinking', 'responsible-ai-use'] },
];

export const SAMPLE_RESUME =
  'Cloud solutions architect who designed AWS architecture and infrastructure as code. Developed SQL pipelines, ETL / ELT, Power BI dashboards, PowerShell automation, API design, Git workflows, rapid prototyping, and responsible AI use. Facilitated knowledge transfer and agile delivery.\n' +
  'Certifications: AWS Certified Solutions Architect - Professional; CompTIA Security+; PMP.\n' +
  'Pursuing CISSP.';

/** Skills and confidence answers for the generic "synthetic example profile". */
export const SYNTHETIC_PROFILE_SKILLS: readonly string[] = [
  'sql-pipelines', 'data-quality', 'aws-architecture', 'infrastructure-as-code', 'security-controls', 'javascript-development',
  'powershell-automation', 'power-bi', 'requirements-analysis', 'ci-cd-pipelines', 'agile-facilitation', 'qualification-planning',
  'root-cause-analysis', 'knowledge-transfer', 'technical-communication', 'ai-orchestration', 'rapid-prototyping',
  'responsible-ai-use', 'test-strategy', 'systems-thinking',
];
export const SYNTHETIC_PROFILE_CONFIDENCE: readonly number[] = [3, 2, 4, 3, 2, 3, 4, 3, 2, 3, 4, 3, 2, 4, 3, 3, 4, 3, 2, 3];
