/**
 * Interactive skills galaxy (SVG). Hover = inspect, click = select, hold + drag = rearrange a
 * node and nudge its linked neighbours. No idle motion, no simulation: positions only change
 * under a pointer. Nearest-node hit testing uses a d3 quadtree.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { quadtree } from 'd3';
import { DOMAINS } from '../../core/taxonomy';
import { GALAXY_H, GALAXY_W, type GalaxyModel } from './galaxy-model';

interface Props { model: GalaxyModel; selected: string | null; onSelect: (id: string) => void; reducedMotion?: boolean }
interface Pos { x: number; y: number }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Galaxy({ model, selected, onSelect }: Props) {
  const { nodes, byId, hubs, edges, adj, displayed, activeDomains, pathways } = model;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const positions = useRef<Map<string, Pos>>(new Map());
  const [, bump] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState<string | null>(null);
  const drag = useRef<{ id: string; pointerId: number; start: Pos; prev: Pos; started: boolean } | null>(null);
  const suppressClick = useRef(false);

  // Reset positions whenever the layout inputs change (attestations / suggestions / scope).
  const layoutKey = useMemo(() => nodes.map((n) => `${n.s.id}:${n.homeX.toFixed(1)},${n.homeY.toFixed(1)}`).join(';'), [nodes]);
  useEffect(() => {
    positions.current = new Map(nodes.map((n) => [n.s.id, { x: n.homeX, y: n.homeY }]));
    bump((t) => t + 1);
  }, [layoutKey, nodes]);

  // Fit the camera to what is displayed (computed from home positions so it stays still while dragging).
  const viewBox = useMemo(() => {
    const pts: Pos[] = [];
    for (const n of nodes) if (displayed.has(n.s.id)) pts.push({ x: n.homeX, y: n.homeY });
    for (const h of hubs) if (activeDomains.has(h.di)) pts.push({ x: h.x, y: h.y }, { x: h.x + 190, y: h.y - 24 });
    if (pathways || pts.length === 0) return { x: 0, y: 0, w: GALAXY_W, h: GALAXY_H };
    const pad = 70;
    let minX = Math.min(...pts.map((p) => p.x)) - pad, maxX = Math.max(...pts.map((p) => p.x)) + pad;
    let minY = Math.min(...pts.map((p) => p.y)) - pad, maxY = Math.max(...pts.map((p) => p.y)) + pad;
    // keep the 950:550 aspect and a minimum zoom-out so a single node isn't blown up
    let w = Math.max(maxX - minX, 520), h = Math.max(maxY - minY, 300);
    if (w / h > GALAXY_W / GALAXY_H) h = (w * GALAXY_H) / GALAXY_W; else w = (h * GALAXY_W) / GALAXY_H;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }, [nodes, hubs, displayed, activeDomains, pathways]);

  const pos = (id: string): Pos => positions.current.get(id) ?? { x: byId.get(id)?.homeX ?? 0, y: byId.get(id)?.homeY ?? 0 };

  const tree = useMemo(() => {
    void layoutKey;
    return quadtree<{ id: string; x: number; y: number }>().x((d) => d.x).y((d) => d.y);
  }, [layoutKey]);
  const rebuildTree = () => {
    tree.removeAll(tree.data());
    tree.addAll([...displayed].map((id) => ({ id, ...pos(id) })));
  };
  useEffect(rebuildTree); // positions change on every render during a drag

  // Screen ↔ SVG user space via the live transform (correct for any viewBox, zoom or layout).
  const coords = (e: { clientX: number; clientY: number }): Pos => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const near = (p: Pos): string | null => tree.find(p.x, p.y, 17 * (viewBox.w / GALAXY_W))?.id ?? null;

  const onPointerMove = (e: { clientX: number; clientY: number; pointerId: number }) => {
    const p = coords(e);
    const d = drag.current;
    if (d && d.pointerId === e.pointerId) {
      if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > 3) { d.started = true; suppressClick.current = true; }
      if (d.started) {
        const c = pos(d.id), dx = p.x - d.prev.x, dy = p.y - d.prev.y;
        positions.current.set(d.id, { x: clamp(c.x + dx, viewBox.x + 15, viewBox.x + viewBox.w - 15), y: clamp(c.y + dy, viewBox.y + 15, viewBox.y + viewBox.h - 15) });
        for (const k of adj.get(d.id) ?? []) {
          if (!displayed.has(k)) continue;
          const q = pos(k);
          positions.current.set(k, { x: clamp(q.x + dx * 0.13, viewBox.x + 15, viewBox.x + viewBox.w - 15), y: clamp(q.y + dy * 0.13, viewBox.y + 15, viewBox.y + viewBox.h - 15) });
        }
        bump((t) => t + 1);
      }
      d.prev = p;
      return;
    }
    const id = near(p);
    if (id !== hover) setHover(id);
  };
  const onPointerDown = (e: { button: number; clientX: number; clientY: number; pointerId: number; target: EventTarget }) => {
    if (e.button !== 0) return;
    const p = coords(e);
    const target = (e.target as Element).closest?.('.sky-skill-node') as HTMLElement | null;
    const id = target?.dataset.skill || near(p);
    if (!id) return;
    drag.current = { id, pointerId: e.pointerId, start: p, prev: p, started: false };
    suppressClick.current = false;
    setHover(id);
    try { surfaceRef.current?.setPointerCapture(e.pointerId); } catch { /* optional */ }
  };
  const release = (e: { pointerId: number }) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    try { surfaceRef.current?.releasePointerCapture(e.pointerId); } catch { /* optional */ }
    if (!d.started) { suppressClick.current = true; onSelect(d.id); }
    bump((t) => t + 1);
  };

  const focus = drag.current?.id ?? keyboard ?? hover ?? selected;
  const tipId = hover ?? keyboard;
  const tip = tipId && displayed.has(tipId) ? byId.get(tipId) : undefined;

  // Tooltip placement in surface pixels.
  let tipStyle: CSSProperties | undefined;
  const ctm = svgRef.current?.getScreenCTM();
  if (tip && ctm && surfaceRef.current) {
    const box = surfaceRef.current.getBoundingClientRect();
    const p = pos(tip.s.id);
    const scr = new DOMPoint(p.x, p.y).matrixTransform(ctm);
    const x = scr.x - box.left, y = scr.y - box.top;
    tipStyle = { left: clamp(x + 19, 8, Math.max(8, box.width - 240)), top: clamp(y - 94, 8, Math.max(8, box.height - 96)) };
  }
  const tipLinked = tip ? [...(adj.get(tip.s.id) ?? [])].filter((x) => displayed.has(x)).slice(0, 3).map((x) => byId.get(x)!.s.name) : [];

  return (
    <div ref={surfaceRef} className="relative" data-galaxy-view={pathways ? 'pathways' : 'confirmed'}
      onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={release} onPointerCancel={release}
      onPointerLeave={() => { if (!drag.current) setHover(null); }}>
      <svg ref={svgRef} id="graphSvg" className="galaxy-svg" viewBox={`${viewBox.x.toFixed(1)} ${viewBox.y.toFixed(1)} ${viewBox.w.toFixed(1)} ${viewBox.h.toFixed(1)}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Interactive skill galaxy showing confirmed capabilities or possible pathways">
        <defs>
          <radialGradient id="galaxy-nebula" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#4feacf" stopOpacity=".16" /><stop offset="45%" stopColor="#537bc2" stopOpacity=".08" /><stop offset="100%" stopColor="#0b1230" stopOpacity="0" /></radialGradient>
          <filter id="galaxy-glow" x="-160%" y="-160%" width="420%" height="420%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g aria-hidden="true">
          <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="transparent" />
          <ellipse cx={475} cy={275} rx={470} ry={277} fill="url(#galaxy-nebula)" />
          {Array.from({ length: pathways ? 260 : 36 }, (_, i) => {
            const theta = i * 2.399963229728653, rr = 10 + Math.sqrt(i / 260) * 273;
            return <circle key={i} cx={(475 + Math.cos(theta) * rr * 1.58).toFixed(1)} cy={(275 + Math.sin(theta) * rr * 0.96).toFixed(1)} r={i % 17 === 0 ? 1.2 : 0.55} fill={i % 9 === 0 ? '#aeafe9' : '#a9e5f3'} opacity={i % 9 === 0 ? 0.27 : 0.11} />;
          })}
        </g>
        <g aria-hidden="true">
          {hubs.filter((h) => activeDomains.has(h.di)).map((h) => {
            const d = DOMAINS[h.di]!;
            return (
              <g key={h.di} className="galaxy-domain-hub" data-domain={h.di}>
                <circle cx={h.x} cy={h.y} r={66 + h.confirmed * 2 + h.pending} fill={d.color} opacity={0.016 + h.confirmed * 0.011 + h.pending * 0.004} />
                <circle cx={h.x} cy={h.y} r={37 + h.confirmed * 1.5} fill="none" stroke={d.color} strokeWidth={h.confirmed ? 1.35 : 0.75} strokeOpacity={h.confirmed ? 0.45 : 0.18} strokeDasharray={h.confirmed ? '2 5' : '2 8'} />
                <circle cx={h.x} cy={h.y} r={5 + h.confirmed * 1.5} fill={d.color} opacity={h.confirmed ? 0.42 : 0.12} filter="url(#galaxy-glow)" />
                <text className="galaxy-domain-label" x={h.x + 12} y={h.y - 18}>{d.name}</text>
                {(h.confirmed || h.pending) ? <text className="galaxy-domain-count" x={h.x + 12} y={h.y - 5}>{[h.confirmed ? `${h.confirmed} confirmed` : '', h.pending ? `${h.pending} suggested` : ''].filter(Boolean).join(' · ')}</text> : null}
              </g>
            );
          })}
        </g>
        <g aria-hidden="true">
          {edges.filter((e) => displayed.has(e.a) && displayed.has(e.b)).map((e) => {
            const a = pos(e.a), b = pos(e.b);
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
            const bow = e.type === 'semantic' ? Math.min(32, len * 0.13) : e.type === 'branch' ? 9 : 0;
            const mx = (a.x + b.x) / 2 - (dy / len) * bow, my = (a.y + b.y) / 2 + (dx / len) * bow;
            const on = focus && (e.a === focus || e.b === focus);
            return <path key={`${e.a}|${e.b}`} className={`sky-link sky-${e.type}`} data-relation-type={e.type} data-relation-a={e.a} data-relation-b={e.b} fill="none"
              d={bow ? `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}` : `M${a.x} ${a.y} L${b.x} ${b.y}`}
              style={{ strokeOpacity: on ? 0.95 : e.type === 'semantic' ? 0.49 : e.type === 'branch' ? 0.4 : 0.23, strokeWidth: on ? 2.4 : undefined } as CSSProperties} />;
          })}
        </g>
        <g>
          {nodes.filter((n) => displayed.has(n.s.id)).map((n) => {
            const p = pos(n.s.id), color = DOMAINS[n.s.di]!.color;
            const on = n.s.id === focus, related = !!focus && (adj.get(focus)?.has(n.s.id) ?? false);
            return (
              <g key={n.s.id} className={`sky-skill-node${n.confirmed ? ' is-confirmed' : ''}${n.pending ? ' is-pending' : ''}`} data-skill={n.s.id} tabIndex={0} role="button" aria-label={n.s.name}
                transform={`translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`} style={{ opacity: focus && !on && !related ? 0.48 : 1 } as CSSProperties}
                onClick={(e: { preventDefault(): void }) => { if (suppressClick.current) { suppressClick.current = false; e.preventDefault(); return; } onSelect(n.s.id); }}
                onKeyDown={(e: { key: string; preventDefault(): void }) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.s.id); } }}
                onFocus={() => setKeyboard(n.s.id)} onBlur={() => setKeyboard(null)}>
                <circle r={n.confirmed ? 16 : 14} fill={color} opacity={on ? 0.48 : n.confirmed ? 0.15 : 0.04} filter="url(#galaxy-glow)" />
                <circle r={on ? 13 : n.confirmed ? 11 : n.pending ? 10 : 7} fill="none" stroke={n.pending ? '#ffca8a' : color} strokeWidth={n.pending ? 2 : n.confirmed ? 1.8 : 1} strokeOpacity={n.pending ? 0.96 : n.confirmed ? 0.8 : 0.14} strokeDasharray={n.pending ? '2 3' : undefined} />
                <circle r={on ? 6.8 : n.signal.rated ? 4.6 : n.confirmed ? 4.3 : 3.3} fill={n.pending ? '#f4b874' : n.confirmed || n.signal.rated ? color : '#8195b2'} opacity={n.pending ? 0.88 : n.confirmed ? 0.96 : n.signal.glow} />
                <circle r={16} fill="transparent" pointerEvents="all" className="sky-hit-target" />
                <title>{n.s.name}</title>
              </g>
            );
          })}
        </g>
      </svg>
      <div id="graphHoverTip" className="sky-hover-tip" role="tooltip" hidden={!tip} style={tipStyle}>
        {tip && (
          <>
            <strong>{tip.s.name}</strong><span>{tip.s.domain}</span>
            <small>{tip.signal.rated ? `Self-reported confidence ${tip.signal.value}/4` : tip.confirmed ? 'Employee-confirmed experience; confidence unanswered' : tip.pending ? 'Résumé keyword suggestion · not confirmed' : 'No confidence or experience response'}</small>
            {tipLinked.length > 0 && <small className="sky-tip-related">Linked: {tipLinked.join(' · ')}</small>}
          </>
        )}
      </div>
    </div>
  );
}
