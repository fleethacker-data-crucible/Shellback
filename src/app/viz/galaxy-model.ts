/**
 * Pure layout + relationship model for the skills galaxy.
 *   confirmed  — exact projection of the employee's attestations (no adjacent/suggested nodes)
 *   pathways   — the complete taxonomy with conceptual learning links; nothing implies capability
 *
 * Layout: the 13 domain clusters sit on an ellipse; inside each cluster the eight skills are
 * settled once by a d3-force simulation (link + collision + a pull toward the cluster centre).
 * The simulation is deterministic (seeded start positions, fixed tick count) and runs once per
 * session, so every profile sees the same map and nothing ever moves on its own.
 */
import { forceSimulation, forceLink, forceCollide, forceX, forceY, forceManyBody } from 'd3-force';
import { BRIDGES, DOMAINS, SKILLS, type Skill } from '../../core/taxonomy';
import type { Profile } from '../../core/schema';

export const GALAXY_W = 1000;
export const GALAXY_H = 680;

export interface NodeSignal { rated: boolean; value: number | null; claimed: boolean; glow: number }
export interface GalaxyNode { s: Skill; homeX: number; homeY: number; signal: NodeSignal; confirmed: boolean; pending: boolean }
export interface GalaxyEdge { a: string; b: string; type: 'local' | 'branch' | 'semantic' | 'confirmed' }
export interface Hub { di: number; x: number; y: number; r: number; confirmed: number; pending: number }

export interface GalaxyModel {
  nodes: GalaxyNode[];
  byId: Map<string, GalaxyNode>;
  hubs: Hub[];
  edges: GalaxyEdge[];
  adj: Map<string, Set<string>>;
  displayed: Set<string>;
  /** Confirmed mode only: nearby pathway skills shown faintly when the user opts in. */
  ghosts: Set<string>;
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

// ----------------------------------------------------------------------------- relationships (static)
interface Rel { edges: GalaxyEdge[]; adj: Map<string, Set<string>> }
let relCache: Rel | null = null;
function relationships(): Rel {
  if (relCache) return relCache;
  const byId = new Set(SKILLS.map((s) => s.id));
  const adj = new Map<string, Set<string>>();
  const edges: GalaxyEdge[] = [];
  const seen = new Set<string>();
  const link = (a: string | undefined, b: string | undefined, type: GalaxyEdge['type']) => {
    if (!a || !b || a === b || !byId.has(a) || !byId.has(b)) return;
    const key = [a, b].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, type });
    for (const [u, v] of [[a, b], [b, a]] as const) { if (!adj.has(u)) adj.set(u, new Set()); adj.get(u)!.add(v); }
  };
  for (const d of DOMAINS) {
    const arr = SKILLS.filter((s) => s.di === d.index).sort((a, b) => a.si - b.si);
    for (let i = 0; i < arr.length - 1; i++) link(arr[i]!.id, arr[i + 1]!.id, 'local');
    for (const idx of [2, 4, 6, 7]) link(arr[0]?.id, arr[idx]?.id, 'branch');
  }
  for (const [a, b] of BRIDGES) link(a, b, 'semantic');
  relCache = { edges, adj };
  return relCache;
}

// ----------------------------------------------------------------------------- base layout (static, deterministic)
interface BaseLayout { pos: Map<string, { x: number; y: number }>; hubs: Array<{ di: number; x: number; y: number; r: number }> }
let layoutCache: BaseLayout | null = null;

export function baseLayout(): BaseLayout {
  if (layoutCache) return layoutCache;
  const cx = GALAXY_W / 2, cy = GALAXY_H / 2;
  // Cluster centres on an ellipse, starting at the top and going clockwise.
  const centres = DOMAINS.map((d) => {
    const a = -Math.PI / 2 + (d.index / DOMAINS.length) * Math.PI * 2;
    return { di: d.index, x: cx + Math.cos(a) * 400, y: cy + Math.sin(a) * 245 };
  });
  type SimNode = { id: string; di: number; si: number; x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null };
  const nodes: SimNode[] = SKILLS.map((s) => {
    const c = centres[s.di]!;
    const a = (s.si / 8) * Math.PI * 2 - Math.PI / 2;
    return { id: s.id, di: s.di, si: s.si, x: c.x + Math.cos(a) * 44, y: c.y + Math.sin(a) * 36 };
  });
  const index = new Map(nodes.map((n) => [n.id, n]));
  const { edges } = relationships();
  const links = edges.filter((e) => e.type !== 'semantic').map((e) => ({ source: index.get(e.a)!, target: index.get(e.b)!, type: e.type }));
  const sim = forceSimulation<SimNode>(nodes)
    .force('link', forceLink<SimNode, { source: SimNode; target: SimNode; type: string }>(links).distance((l) => (l.type === 'branch' ? 50 : 40)).strength(0.6))
    .force('charge', forceManyBody<SimNode>().strength(-40).distanceMax(110))
    .force('collide', forceCollide<SimNode>(21).iterations(3))
    .force('x', forceX<SimNode>((n) => centres[n.di]!.x).strength(0.22))
    .force('y', forceY<SimNode>((n) => centres[n.di]!.y).strength(0.3))
    .stop();
  for (let i = 0; i < 320; i++) sim.tick();
  const pos = new Map(nodes.map((n) => [n.id, { x: Math.round(n.x * 10) / 10, y: Math.round(n.y * 10) / 10 }]));
  const hubs = centres.map((c) => {
    const members = nodes.filter((n) => n.di === c.di);
    const mx = members.reduce((s, n) => s + n.x, 0) / members.length, my = members.reduce((s, n) => s + n.y, 0) / members.length;
    const r = Math.max(...members.map((n) => Math.hypot(n.x - mx, n.y - my))) + 16;
    return { di: c.di, x: mx, y: my, r };
  });
  layoutCache = { pos, hubs };
  return layoutCache;
}

// ----------------------------------------------------------------------------- per-profile model
export function buildGalaxyModel(opts: { profile: Pick<Profile, 'confirmed' | 'surveys'>; pending: readonly string[]; scope: 'confirmed' | 'pathways'; filter: string; query: string; showGhosts?: boolean }): GalaxyModel {
  const { profile, pending, scope, filter, query, showGhosts = false } = opts;
  const pendingSet = new Set(pending);
  const confirmed = new Set(profile.confirmed);
  const pathways = scope === 'pathways';
  const { pos, hubs: baseHubs } = baseLayout();
  const { edges: allEdges, adj: baseAdj } = relationships();

  const nodes: GalaxyNode[] = SKILLS.map((s) => {
    const p = pos.get(s.id)!;
    return { s, homeX: p.x, homeY: p.y, signal: signalFor(s.id, profile), confirmed: confirmed.has(s.id), pending: pendingSet.has(s.id) };
  });
  const byId = new Map(nodes.map((n) => [n.s.id, n]));
  const attested = new Set(profile.confirmed.filter((id) => byId.has(id)));
  const eligible = SKILLS.filter((s) => pathways || attested.has(s.id));
  const q = query.trim().toLowerCase();
  const passes = (s: Skill) => (filter === 'all' || s.di === Number(filter)) && (!q || `${s.name} ${s.domain}`.toLowerCase().includes(q));
  const displayed = new Set(eligible.filter(passes).map((s) => s.id));

  // Ghosts: one hop out from displayed confirmed skills, never themselves confirmed/displayed.
  const ghosts = new Set<string>();
  if (!pathways && showGhosts) {
    for (const id of displayed) for (const n of baseAdj.get(id) ?? []) if (!displayed.has(n) && !attested.has(n)) { const s = byId.get(n)!.s; if (passes(s)) ghosts.add(n); }
  }
  const activeDomains = new Set([...displayed, ...ghosts].map((id) => byId.get(id)!.s.di));
  if (pathways) for (const s of SKILLS) activeDomains.add(s.di);

  // Edges: in confirmed mode add direct links between attested skills of the same domain even when
  // the taxonomy neighbours between them are hidden.
  const edges = [...allEdges];
  const adj = new Map<string, Set<string>>([...baseAdj].map(([k, v]) => [k, new Set(v)]));
  if (!pathways) {
    const seen = new Set(edges.map((e) => [e.a, e.b].sort().join('|')));
    for (const d of DOMAINS) {
      const members = SKILLS.filter((x) => x.di === d.index && attested.has(x.id)).sort((a, b) => a.si - b.si);
      for (let i = 1; i < members.length; i++) {
        const a = members[i - 1]!.id, b = members[i]!.id, key = [a, b].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ a, b, type: 'confirmed' });
        adj.get(a)!.add(b); adj.get(b)!.add(a);
      }
    }
  }

  const hubs: Hub[] = baseHubs.map((h) => {
    const group = SKILLS.filter((s) => s.di === h.di);
    return { ...h, confirmed: group.filter((s) => confirmed.has(s.id)).length, pending: group.filter((s) => pendingSet.has(s.id)).length };
  });

  return {
    nodes, byId, hubs, edges, adj, displayed, ghosts, activeDomains, pathways, attested,
    counts: {
      confirmed: nodes.filter((n) => n.confirmed).length,
      pending: nodes.filter((n) => n.pending).length,
      known: Object.keys(profile.surveys).filter((id) => attested.has(id)).length,
    },
  };
}
