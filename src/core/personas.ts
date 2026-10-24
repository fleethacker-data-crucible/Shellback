/**
 * Fictional employee personas. The workspace JSON under examples/employees/ is the single
 * source of truth: it is imported at build time, so the app and the fixture files cannot drift.
 */
import morgan from '../../examples/employees/morgan-vale-workspace.json';
import riley from '../../examples/employees/riley-chen-workspace.json';
import jordan from '../../examples/employees/jordan-brooks-workspace.json';
import casey from '../../examples/employees/casey-rivera-workspace.json';

export interface Persona {
  id: string;
  name: string;
  role: string;
  overview: string;
  /** v1 or v2 workspace JSON, parsed through parseWorkspace() when loaded. */
  workspace: unknown;
}

export const PERSONAS: readonly Persona[] = [
  { id: 'morgan-vale', name: 'Morgan Vale', role: 'Shipyard Maintenance Planner', overview: 'Maintenance work packages, fleet sustainment, qualification planning, and practical operations handoffs.', workspace: morgan },
  { id: 'riley-chen', name: 'Riley Chen', role: 'Cybersecurity & Compliance Analyst', overview: 'Access review processes, defensive cyber architecture, security documentation, and risk analysis.', workspace: riley },
  { id: 'jordan-brooks', name: 'Jordan Brooks', role: 'Data & Cloud Engineer', overview: 'Data pipelines, dashboards, cloud architecture, automation, and AI-assisted prototyping.', workspace: jordan },
  { id: 'casey-rivera', name: 'Casey Rivera', role: 'Training & Knowledge Transfer Lead', overview: 'Curriculum, mentoring, structured handoffs, onboarding, and qualification learning pathways.', workspace: casey },
];
