/**
 * Organization codes. Shipyard units are identified by hierarchical codes where a child's code
 * starts with its parent's: 9900 (department) → 9910 (division) → 9911 (branch) → 9911.1 (section).
 * The tree is derived from the codes people enter, so no fixed org chart has to be shipped and
 * every yard's numbering works. Titles (Department Head, Branch Head, …) are free text.
 */

/** Canonical form: digits and dots only, no spaces, uppercase letters kept for mixed schemes. */
export function normalizeOrgCode(raw: unknown): string {
  return String(raw ?? '').toUpperCase().replace(/^\s*(?:CODE|C)\s*/, '').replace(/[^A-Z0-9.]/g, '').replace(/\.+/g, '.').replace(/^\.|\.$/g, '').slice(0, 24);
}

/** Every ancestor of a code, nearest first: 9911.2 → 9911, 9910, 9900. */
export function orgAncestors(code: string): string[] {
  const c = normalizeOrgCode(code);
  if (!c) return [];
  const out: string[] = [];
  // Dotted suffixes: strip one segment at a time.
  let base = c;
  while (base.includes('.')) { base = base.slice(0, base.lastIndexOf('.')); out.push(base); }
  // Numeric prefix nesting: zero out trailing digits one at a time, keeping at least the two
  // leading digits, so 9911 → 9910 → 9900 and 246 → 240 → 200 (a code's top level is X00 / XX00).
  const m = /^(\d+)$/.exec(base);
  if (m) {
    const digits = m[1]!;
    // 3-digit codes nest to X00 (246 → 240 → 200); longer codes to XX00 (9911 → 9910 → 9900); 2-digit codes are roots.
    const minKeep = digits.length <= 2 ? digits.length : digits.length === 3 ? 1 : digits.length - 2;
    for (let keep = digits.length - 1; keep >= minKeep; keep--) {
      const parent = digits.slice(0, keep) + '0'.repeat(digits.length - keep);
      if (parent !== digits && parent !== out[out.length - 1] && !/^0+$/.test(parent)) out.push(parent);
    }
  }
  return [...new Set(out)].filter((a) => a !== c);
}

export const orgParent = (code: string): string | null => orgAncestors(code)[0] ?? null;
export const isWithin = (code: string, unit: string): boolean => { const c = normalizeOrgCode(code), u = normalizeOrgCode(unit); return !!c && !!u && (c === u || orgAncestors(c).includes(u)); };

/** Level name by depth of the code, for display only. Yards can rename these in the future. */
export function orgLevelName(code: string): string {
  const c = normalizeOrgCode(code);
  if (!c) return 'Unit';
  const depth = orgAncestors(c).length;
  return ['Department', 'Division', 'Branch', 'Section', 'Unit'][Math.min(depth, 4)] ?? 'Unit';
}

export interface OrgNode<P> {
  code: string;
  level: string;
  /** People whose own code is exactly this unit. */
  direct: P[];
  /** People in this unit or any unit beneath it. */
  all: P[];
  children: OrgNode<P>[];
}

/** Build the tree from whatever codes the people carry. Units with no people of their own still appear as connectors. */
export function buildOrgTree<P extends { orgCode?: string | undefined }>(people: readonly P[]): OrgNode<P>[] {
  const nodes = new Map<string, OrgNode<P>>();
  const ensure = (code: string): OrgNode<P> => {
    let n = nodes.get(code);
    if (!n) { n = { code, level: orgLevelName(code), direct: [], all: [], children: [] }; nodes.set(code, n); }
    return n;
  };
  for (const p of people) {
    const code = normalizeOrgCode(p.orgCode);
    if (!code) continue;
    ensure(code).direct.push(p);
    for (const a of orgAncestors(code)) ensure(a);
  }
  const roots: OrgNode<P>[] = [];
  for (const n of nodes.values()) {
    const parent = orgAncestors(n.code).find((a) => nodes.has(a));
    if (parent) nodes.get(parent)!.children.push(n); else roots.push(n);
  }
  const fill = (n: OrgNode<P>): P[] => { n.children.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })); n.all = [...n.direct, ...n.children.flatMap(fill)]; return n.all; };
  roots.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  roots.forEach(fill);
  return roots;
}

export const flattenOrg = <P>(roots: OrgNode<P>[]): OrgNode<P>[] => roots.flatMap((r) => [r, ...flattenOrg(r.children)]);
