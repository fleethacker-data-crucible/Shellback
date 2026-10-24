/**
 * Pure layout + relationship model for the skills galaxy.
 *   confirmed  — exact projection of the employee's attestations (no adjacent/suggested nodes)
 *   pathways   — the complete taxonomy with conceptual learning links; nothing implies capability
 */
import { BRIDGES, DOMAINS, SKILLS, type Skill } from '../../core/taxonomy';
import type { Profile } from '../../core/schema';

export const GALAXY_W = 950;
export const GALAXY_H = 550;
const GOLDEN = 2.399963229728653;

export interface NodeSignal { rated: boolean; value: number | null; claimed: boolean; glow: number }
export interface GalaxyNode { s: Skill; homeX: number; homeY: number; signal: NodeSignal; confirmed: boolean; pending: boolean }
export interface GalaxyEdge { a: string; b: string; type: 'local' | 'branch' | 'semantic' | 'confirmed' }
export interface Hub { di: number; x: number; y: number; confirmed: number; pending: number }

export interface GalaxyModel {
  nodes: GalaxyNode[];
  byId: Map<string, GalaxyNode>;
  hubs: Hub[];
  edges: GalaxyEdge[];
  adj: Map<string, Set<string>>;
  displayed: Set<string>;
  activeDomains: Set<number>;
  pathways: boolean;
  attested: Set<string>;
  counts: { confirmed: number; pending: number; known: number };
}

/** Confidence only shows for skills that are currently attested (withdrawn skills hide their rating). */
export function signalFor(skillId: string, profile: Pick<Profile, 'confirmed' | 'surveys'>): NodeSignal {
  const claimed = profile.confirmed.includes(skillId);
  const answer = claimed ? profile.surveys[skillId] : undefined;
  if (answer && Number.isInteger(answer.confidence) && answer.confidence >= 0 && answer.confidence <= 4) {
    return { rated: true, value: answer.confidence, claimed: true, glow: 0.2 + answer.confidence * 0.2 };
  }
  if (claimed) return { rated: false, value: null, claimed: true, glow: 0.39 };
  return { rated: false, value: null, claimed: false, glow: 0.15 };
}

export function buildGalaxyModel(opts: { profile: Pick<Profile, 'confirmed' | 'surveys'>; pending: readonly string[]; scope: 'confirmed' | 'pathways'; filter: string; query: string }): GalaxyModel {
  const { profile, pending, scope, filter, query } = opts;
  const pendingSet = new Set(pending);
  const confirmed = new Set(profile.confirmed);
  const pathways = scope === 'pathways';

  const hubs: Hub[] = DOMAINS.map((d) => {
    const angle = d.index * GOLDEN - 0.45, rad = 64 + Math.sqrt((d.index + 0.7) / 13) * 190;
    const group = SKILLS.filter((s) => s.di === d.index);
    const c = group.filter((s) => confirmed.has(s.id)).length, p = group.filter((s) => pendingSet.has(s.id)).length;
    const boost = c * 4 + p * 2;
    return { di: d.index, x: 475 + Math.cos(angle) * (rad * 1.37 + boost), y: 275 + Math.sin(angle) * (rad * 0.88 + boost * 0.38), confirmed: c, pending: p };
  });

  const nodes: GalaxyNode[] = SKILLS.map((s) => {
    const h = hubs[s.di]!;
    const a = s.si * GOLDEN + s.di * 0.37, r = 24 + Math.sqrt((s.si + 1) / 8) * 52;
    const isConfirmed = confirmed.has(s.id);
    const x = h.x + Math.cos(a) * (r + (isConfirmed ? 4 : 0)), y = h.y + Math.sin(a) * r * 0.78;
    return { s, homeX: x, homeY: y, signal: signalFor(s.id, profile), confirmed: isConfirmed, pending: pendingSet.has(s.id) };
  });
  const byId = new Map(nodes.map((n) => [n.s.id, n]));
  const attested = new Set(profile.confirmed.filter((id) => byId.has(id)));
  const eligible = SKILLS.filter((s) => pathways || attested.has(s.id));
  const activeDomains = new Set(eligible.map((s) => s.di));
  const q = query.trim().toLowerCase();
  const displayed = new Set(eligible.filter((s) => (filter === 'all' || s.di === Number(filter)) && (!q || `${s.name} ${s.domain}`.toLowerCase().includes(q))).map((s) => s.id));

  const adj = new Map<string, Set<string>>();
  const edges: GalaxyEdge[] = [];
  const seen = new Set<string>();
  const link = (a: string | undefined, b: string | undefined, type: GalaxyEdge['type'] = 'local') => {
    if (!a || !b || a === b || !byId.has(a) || !byId.has(b)) return;
    const key = [a, b].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, type });
    for (const [u, v] of [[a, b], [b, a]] as const) { if (!adj.has(u)) adj.set(u, new Set()); adj.get(u)!.add(v); }
  };
  for (const d of DOMAINS) {
    const arr = SKILLS.filter((s) => s.di === d.index).sort((a, b) => a.si - b.si);
    for (let i = 0; i < arr.length - 1; i++) link(arr[i]!.id, arr[i + 1]!.id);
    for (const idx of [2, 4, 6, 7]) link(arr[0]?.id, arr[idx]?.id, 'branch');
  }
  for (const [a, b] of BRIDGES) link(a, b, 'semantic');
  if (!pathways) {
    for (const d of DOMAINS) {
      const members = SKILLS.filter((x) => x.di === d.index && attested.has(x.id)).sort((a, b) => a.si - b.si);
      for (let i = 1; i < members.length; i++) link(members[i - 1]!.id, members[i]!.id, 'confirmed');
    }
  }

  return {
    nodes, byId, hubs, edges, adj, displayed, activeDomains, pathways, attested,
    counts: {
      confirmed: nodes.filter((n) => n.confirmed).length,
      pending: nodes.filter((n) => n.pending).length,
      known: Object.keys(profile.surveys).filter((id) => attested.has(id)).length,
    },
  };
}
