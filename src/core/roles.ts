/**
 * Role switching. One person can be an employee and a supervisor. The role decides which team
 * sections are open in the app. Supervisor is the default, so existing workspaces see no change.
 * Employee keeps the sharing roster (export and import of their own card) and loses the team-level
 * sections: coverage, missions, mentors and knowledge. This is a presentation rule, not access control:
 * everything stays on this computer, and the team-level data is aggregate by design.
 */
export const ROLES = ['employee', 'supervisor'] as const;
export type Role = (typeof ROLES)[number];
export const DEFAULT_ROLE: Role = 'supervisor';

export const TEAM_TABS = ['roster', 'coverage', 'missions', 'mentors', 'knowledge'] as const;
export type TeamSection = (typeof TEAM_TABS)[number];

export function parseRole(v: unknown): Role {
  return (ROLES as readonly unknown[]).includes(v) ? (v as Role) : DEFAULT_ROLE;
}

/** The team sections a role may open, in display order. */
export function teamSectionsFor(role: Role): readonly TeamSection[] {
  return role === 'supervisor' ? TEAM_TABS : ['roster'];
}

/** A requested section, or the roster when the role may not open it. */
export function resolveTeamSection(role: Role, requested: string): TeamSection {
  const allowed = teamSectionsFor(role);
  return (allowed as readonly string[]).includes(requested) ? (requested as TeamSection) : 'roster';
}
