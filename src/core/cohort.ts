/**
 * Synthetic demo cohort: 20 fictional people in a shipyard engineering department (Code 1500),
 * rich enough that Coverage, Missions, Mentors and the contribution map feel like a real team.
 * Every name, code, credential and preference here is invented.
 */
import type { ContextTag, Energy, EnergyScore, Fluency, Stage } from './contribution';

export interface CohortPerson {
  name: string;
  title: string;
  org: string;
  skills: string[];
  /** stage → [energy −2..2, fluency 0..3 | null, tags?] */
  stages: Partial<Record<Stage, [EnergyScore, Fluency | null, ContextTag[]?]>>;
  credentials?: string[];
  mentor?: { topics: string[]; availability: 'available' | 'limited' | 'unavailable' | 'unknown'; intro: string };
}

export const SYNTHETIC_COHORT_V2: readonly CohortPerson[] = [
  { name: 'Avery Lindqvist', title: 'Division Head', org: '1510', skills: ['stakeholder-alignment', 'decision-framing', 'roadmap-planning', 'resource-planning', 'change-management', 'problem-framing', 'technical-communication', 'risk-register', 'outcome-measurement'],
    stages: { question: [2, 3], ideate: [1, 2], evaluate: [1, 3], rally: [2, 3, ['large-group']], support: [0, 2], finish: [-2, 3, ['under-deadline']] }, credentials: ['PMP'], mentor: { topics: ['decision-framing', 'stakeholder-alignment'], availability: 'limited', intro: 'Happy to talk through how decisions get made above branch level.' } },
  { name: 'Brianna Okoro', title: 'Branch Head', org: '1513', skills: ['qualification-planning', 'work-package-readiness', 'maintenance-coordination', 'milestone-tracking', 'agile-facilitation', 'stakeholder-alignment', 'mentoring', 'safety-process-awareness', 'conflict-navigation'],
    stages: { question: [0, 2], ideate: [-1, 1], evaluate: [2, 3], rally: [2, 3], support: [1, 3], finish: [-1, 3, ['under-deadline']] }, credentials: ['Lean Six Sigma Green Belt'], mentor: { topics: ['qualification-planning', 'agile-facilitation'], availability: 'limited', intro: 'Ask me about planning work packages that survive contact with the yard.' } },
  { name: 'Carlos Mendieta', title: 'Data Engineer', org: '1513.2', skills: ['sql-pipelines', 'etl-elt', 'data-modeling', 'database-design', 'data-quality', 'python-development', 'infrastructure-as-code', 'container-platforms', 'knowledge-transfer'],
    stages: { question: [-1, 1], ideate: [0, 2], evaluate: [1, 2], rally: [-2, 1, ['large-group']], support: [1, 3], finish: [2, 3] }, credentials: ['AWS Certified Data Engineer – Associate'], mentor: { topics: ['sql-pipelines', 'etl-elt'], availability: 'available', intro: 'Monthly SQL clinic; bring a slow query.' } },
  { name: 'Dana Whitcombe', title: 'Data Analyst', org: '1513.2', skills: ['sql-pipelines', 'power-bi', 'dashboard-design', 'metrics-definition', 'data-storytelling', 'statistical-analysis', 'forecasting', 'data-quality', 'powershell-automation'],
    stages: { question: [1, 2], ideate: [1, 1], evaluate: [0, 2], rally: [-1, 1, ['new-people']], support: [2, 3], finish: [1, 2] }, credentials: ['CompTIA Data+', 'Microsoft PL-300'] },
  { name: 'Eli Vasquez-Ruiz', title: 'DevOps Engineer', org: '1513.3', skills: ['ci-cd-pipelines', 'git-workflows', 'container-platforms', 'infrastructure-as-code', 'cloud-observability', 'monitoring-alerting', 'identity-access', 'security-controls', 'incident-readiness', 'powershell-automation'],
    stages: { question: [0, 2], ideate: [-1, 1], evaluate: [1, 3], rally: [-2, 0], support: [2, 3, ['working-alone']], finish: [2, 3] }, credentials: ['CKA', 'CompTIA Security+', 'AWS Certified Solutions Architect – Associate'], mentor: { topics: ['ci-cd-pipelines', 'container-platforms'], availability: 'limited', intro: 'Pipelines, Kubernetes, and why the build agent is unhappy.' } },
  { name: 'Fatima Haddad', title: 'Software Developer', org: '1513.3', skills: ['javascript-development', 'frontend-engineering', 'api-design', 'backend-services', 'code-reviews', 'test-automation', 'git-workflows', 'python-development', 'agile-facilitation'],
    stages: { question: [1, 2], ideate: [2, 2, ['small-team']], evaluate: [0, 2], rally: [0, 1], support: [1, 3], finish: [-1, 3] }, credentials: ['Certified ScrumMaster'] },
  { name: 'Gabriel Osei', title: 'Analytics & BI Lead', org: '1513', skills: ['problem-framing', 'metrics-definition', 'stakeholder-alignment', 'roadmap-planning', 'power-bi', 'data-storytelling', 'mentoring', 'responsible-ai-use', 'systems-thinking', 'product-judgment'],
    stages: { question: [2, 3], ideate: [2, 3], evaluate: [1, 3], rally: [1, 2], support: [-1, 2], finish: [-2, 2, ['under-deadline']] }, credentials: ['PMP', 'Certified Analytics Professional'], mentor: { topics: ['problem-framing', 'metrics-definition'], availability: 'available', intro: 'Turning a vague leadership question into one we can answer.' } },
  { name: 'Hana Takeda', title: 'Systems Engineer', org: '1513.1', skills: ['requirements-analysis', 'systems-integration', 'interface-control', 'architecture-modeling', 'trade-studies', 'configuration-management', 'verification-planning', 'technical-writing'],
    stages: { question: [1, 3], ideate: [0, 2], evaluate: [2, 3], rally: [-1, 1], support: [0, 2], finish: [1, 3] }, credentials: ['INCOSE CSEP'] },
  { name: 'Isaac Brennan', title: 'Test Engineer', org: '1513.1', skills: ['test-strategy', 'acceptance-criteria', 'regression-testing', 'defect-triage', 'quality-assurance', 'root-cause-analysis', 'test-automation', 'audit-evidence'],
    stages: { question: [0, 2], ideate: [-1, 1], evaluate: [2, 3], rally: [-1, 0], support: [1, 2], finish: [2, 3, ['under-deadline']] }, credentials: ['ISTQB Foundation'] },
  { name: 'Jamal Richardson', title: 'Security Analyst', org: '1520', skills: ['security-controls', 'threat-modeling', 'vulnerability-triage', 'access-reviews', 'security-documentation', 'incident-readiness', 'risk-assessment', 'zero-trust-design'],
    stages: { question: [1, 2], ideate: [0, 1], evaluate: [2, 3], rally: [-2, 1], support: [0, 2], finish: [1, 2] }, credentials: ['CISSP', 'CompTIA Security+'], mentor: { topics: ['threat-modeling', 'vulnerability-triage'], availability: 'limited', intro: 'Threat models that fit on one page.' } },
  { name: 'Keiko Nakamura', title: 'Cloud Architect', org: '1520', skills: ['aws-architecture', 'cloud-networking', 'identity-access', 'cost-optimization', 'resilience-recovery', 'infrastructure-as-code', 'application-architecture', 'architecture-modeling'],
    stages: { question: [2, 3], ideate: [2, 3], evaluate: [1, 3], rally: [0, 2], support: [-1, 2], finish: [-1, 2] }, credentials: ['AWS Certified Solutions Architect – Professional'], mentor: { topics: ['aws-architecture', 'cost-optimization'], availability: 'available', intro: 'Landing zones, networking, and what the bill is trying to tell you.' } },
  { name: 'Liam O’Connell', title: 'Maintenance Planner', org: '1513.4', skills: ['work-package-readiness', 'maintenance-coordination', 'fleet-sustainment', 'shipyard-process-mapping', 'technical-work-instructions', 'safety-process-awareness', 'milestone-tracking'],
    stages: { question: [-1, 1], ideate: [-1, 1], evaluate: [0, 2], rally: [1, 2, ['people-i-know']], support: [2, 3], finish: [2, 3] }, credentials: ['Maintenance Planner Familiarization (synthetic)'] },
  { name: 'Maya Castellanos', title: 'Training Coordinator', org: '1513.4', skills: ['training-facilitation', 'curriculum-design', 'onboarding-plans', 'knowledge-transfer', 'documentation-stewardship', 'technical-writing', 'skills-taxonomy-design', 'peer-coaching'],
    stages: { question: [1, 2], ideate: [2, 2], evaluate: [0, 2], rally: [2, 3, ['large-group']], support: [2, 3], finish: [0, 2] }, mentor: { topics: ['training-facilitation', 'onboarding-plans'], availability: 'available', intro: 'Designing a course people actually finish.' } },
  { name: 'Noah Petrov', title: 'Reliability Engineer', org: '1513.1', skills: ['reliability-analysis', 'root-cause-analysis', 'statistical-analysis', 'risk-assessment', 'configuration-management', 'exploratory-analysis', 'process-improvement'],
    stages: { question: [2, 3], ideate: [0, 2], evaluate: [2, 3], rally: [-2, 0, ['large-group']], support: [0, 1], finish: [1, 2] }, credentials: ['ASQ CRE'] },
  { name: 'Olivia Marsh', title: 'Program Analyst', org: '1510', skills: ['milestone-tracking', 'resource-planning', 'backlog-refinement', 'outcome-measurement', 'risk-register', 'dashboard-design', 'data-visualization', 'technical-communication'],
    stages: { question: [0, 2], ideate: [-1, 1], evaluate: [1, 2], rally: [1, 2], support: [2, 3], finish: [2, 3] }, credentials: ['CAPM'] },
  { name: 'Priyanka Rao', title: 'Data Governance Lead', org: '1513.2', skills: ['data-governance', 'data-quality', 'data-integration', 'streaming-data', 'documentation-stewardship', 'audit-evidence', 'access-reviews', 'metrics-definition'],
    stages: { question: [1, 3], ideate: [0, 2], evaluate: [2, 3], rally: [0, 2], support: [1, 2], finish: [1, 3] }, credentials: ['DAMA CDMP'], mentor: { topics: ['data-governance', 'data-quality'], availability: 'limited', intro: 'Data lineage without the ceremony.' } },
  { name: 'Quentin Dubois', title: 'Release Engineer', org: '1513.3', skills: ['release-engineering', 'build-tooling', 'environment-management', 'ci-cd-pipelines', 'workflow-automation', 'git-workflows', 'monitoring-alerting', 'powershell-automation'],
    stages: { question: [-1, 1], ideate: [0, 1], evaluate: [1, 2], rally: [-1, 1], support: [2, 3, ['working-alone']], finish: [2, 3] } },
  { name: 'Rosa Alvarado', title: 'UX & Prototyping', org: '1513.3', skills: ['rapid-prototyping', 'customer-discovery', 'creative-vision', 'frontend-engineering', 'inclusive-collaboration', 'cross-team-facilitation', 'product-judgment', 'data-visualization'],
    stages: { question: [2, 3], ideate: [2, 3, ['small-team']], evaluate: [0, 2], rally: [2, 2], support: [1, 2], finish: [-2, 1] }, mentor: { topics: ['rapid-prototyping', 'customer-discovery'], availability: 'available', intro: 'From sticky notes to a clickable prototype in a day.' } },
  { name: 'Samir Khan', title: 'AI Integration Engineer', org: '1513.2', skills: ['ai-orchestration', 'ai-outcome-validation', 'responsible-ai-use', 'python-development', 'api-design', 'backend-services', 'security-documentation', 'systems-thinking'],
    stages: { question: [1, 3], ideate: [2, 3], evaluate: [1, 2], rally: [0, 1], support: [0, 2], finish: [-1, 2, ['under-deadline']] }, credentials: ['AWS Certified Machine Learning – Specialty'] },
  { name: 'Tessa Nguyen', title: 'Mission Continuity Lead', org: '1520', skills: ['mission-continuity', 'resilience-recovery', 'incident-readiness', 'fleet-sustainment', 'risk-assessment', 'cross-team-facilitation', 'change-management', 'conflict-navigation'],
    stages: { question: [1, 2], ideate: [0, 2], evaluate: [2, 3], rally: [2, 3, ['high-stakes']], support: [1, 3], finish: [1, 3] }, credentials: ['Certified Business Continuity Professional'], mentor: { topics: ['mission-continuity', 'incident-readiness'], availability: 'limited', intro: 'Tabletop exercises that people do not dread.' } },
];

export const energyLabelOf = (e: EnergyScore): Energy => (e > 0 ? 'energizing' : e < 0 ? 'draining' : 'neutral');
