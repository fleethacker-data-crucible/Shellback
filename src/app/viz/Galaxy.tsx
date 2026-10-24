/**
 * Interactive skills galaxy (SVG).
 *   wheel / pinch = zoom · drag empty space = pan · hover = inspect · click or Enter = select
 *   hold + drag a star = rearrange it and nudge its linked neighbours · arrow keys = move between stars
 * Nothing moves on its own: positions come from a one-time deterministic layout.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { quadtree } from 'd3-quadtree';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { DOMAINS } from '../../core/taxonomy';
import { GALAXY_H, GALAXY_W, type GalaxyModel } from './galaxy-model';

interface Props { model: GalaxyModel; selected: string | null; onSelect: (id: string) => void; fitSignal?: number; reducedMotion?: boolean }
interface Pos { x: number; y: number }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Galaxy({ model, selected, onSelect, fitSignal = 0 }: Props) {
  const { nodes, byId, hubs, edges, adj, displayed, ghosts, activeDomains, pathways } = model;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sceneRef = useRef<SVGGElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const positions = useRef<Map<string, Pos>>(new Map());
  const [, bump] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState<string | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const drag = useRef<{ id: string; pointerId: number; start: Pos; prev: Pos; started: boolean } | null>(null);
  const suppressClick = useRef(false);

  const visible = useMemo(() => new Set([...displayed, ...ghosts]), [displayed, ghosts]);
  const pos = (id: string): Pos => positions.current.get(id) ?? { x: byId.get(id)?.homeX ?? 0, y: byId.get(id)?.homeY ?? 0 };

  // Reset positions when the layout inputs change (new attestations / scope).
  const layoutKey = useMemo(() => nodes.map((n) => `${n.s.id}:${n.homeX},${n.homeY}`).join(';'), [nodes]);
  useEffect(() => { positions.current = new Map(nodes.map((n) => [n.s.id, { x: n.homeX, y: n.homeY }])); bump((t) => t + 1); }, [layoutKey, nodes]);

  // d3-zoom for wheel zoom and background pan; star drags are handled by our own pointer code.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 6])
      .filter((e: Event) => {
        const t = e.target as Element | null;
        if (t?.closest?.('.sky-skill-node, .sky-ghost-node')) return false; // star drag, not pan
        return !(e as MouseEvent).button;
      })
      .on('zoom', (e: { transform: ZoomTransform }) => setTransform(e.transform));
    select(svg).call(z).on('dblclick.zoom', null);
    zoomRef.current = z;
    return () => { select(svg).on('.zoom', null); };
  }, []);

  // Fit the camera to what is visible (initial render, scope/filter change, or the Fit button).
  const fitKey = `${pathways}|${[...visible].sort().join(',')}`;
  useEffect(() => {
    const svg = svgRef.current, z = zoomRef.current;
    if (!svg || !z) return;
    const pts: Pos[] = [...visible].map((id) => ({ x: byId.get(id)!.homeX, y: byId.get(id)!.homeY }));
    for (const h of hubs) if (activeDomains.has(h.di)) { const w = (DOMAINS[h.di]!.name.length * 6.6 + 16) / 2; pts.push({ x: Math.min(h.x - w, h.x - h.r - 8), y: h.y - h.r - 32 }, { x: Math.max(h.x + w, h.x + h.r + 8), y: h.y + h.r + 8 }); }
    if (!pts.length) { select(svg).call(z.transform, zoomIdentity); return; }
    const minX = Math.min(...pts.map((p) => p.x)) - 30, maxX = Math.max(...pts.map((p) => p.x)) + 30;
    const minY = Math.min(...pts.map((p) => p.y)) - 24, maxY = Math.max(...pts.map((p) => p.y)) + 30;
    const k = clamp(Math.min(GALAXY_W / (maxX - minX), GALAXY_H / (maxY - minY)), 0.5, 2);
    const t = zoomIdentity.translate(GALAXY_W / 2 - k * (minX + maxX) / 2, GALAXY_H / 2 - k * (minY + maxY) / 2).scale(k);
    select(svg).call(z.transform, t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, fitSignal]);

  // Hit testing in scene coordinates.
  const tree = useMemo(() => { void layoutKey; return quadtree<{ id: string; x: number; y: number }>().x((d) => d.x).y((d) => d.y); }, [layoutKey]);
  useEffect(() => { tree.removeAll(tree.data()); tree.addAll([...visible].map((id) => ({ id, ...pos(id) }))); });

  const sceneCoords = (e: { clientX: number; clientY: number }): Pos => {
    const m = sceneRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const near = (p: Pos): string | null => tree.find(p.x, p.y, 16 / transform.k + 4)?.id ?? null;

  const onPointerMove = (e: { clientX: number; clientY: number; pointerId: number }) => {
    const p = sceneCoords(e);
    const d = drag.current;
    if (d && d.pointerId === e.pointerId) {
      if (Math.hypot(p.x - d.start.x, p.y - d.start.y) > 3) { d.started = true; suppressClick.current = true; }
      if (d.started) {
        const c = pos(d.id), dx = p.x - d.prev.x, dy = p.y - d.prev.y;
        positions.current.set(d.id, { x: c.x + dx, y: c.y + dy });
        for (const k of adj.get(d.id) ?? []) { if (!visible.has(k)) continue; const q = pos(k); positions.current.set(k, { x: q.x + dx * 0.13, y: q.y + dy * 0.13 }); }
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
    const target = (e.target as Element).closest?.('.sky-skill-node, .sky-ghost-node') as SVGGElement | null;
    const id = target?.dataset.skill;
    if (!id) return;
    drag.current = { id, pointerId: e.pointerId, start: sceneCoords(e), prev: sceneCoords(e), started: false };
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

  // Arrow keys: move focus to the nearest visible star roughly in that direction.
  const onKey = (id: string, e: { key: string; preventDefault(): void }) => {
    const dirs: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); return; }
    const dir = dirs[e.key];
    if (!dir) return;
    e.preventDefault();
    const from = pos(id);
    let best: string | null = null, bestScore = Infinity;
    for (const other of visible) {
      if (other === id) continue;
      const p = pos(other), dx = p.x - from.x, dy = p.y - from.y;
      const along = dx * dir[0] + dy * dir[1];
      if (along <= 0) continue;
      const across = Math.abs(dx * dir[1] - dy * dir[0]);
      const score = along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = other; }
    }
    if (best) (svgRef.current?.querySelector(`[data-skill="${best}"]`) as SVGGElement | null)?.focus();
  };

  const focus = drag.current?.id ?? keyboard ?? hover ?? selected;
  const tipId = hover ?? keyboard;
  const tip = tipId && visible.has(tipId) ? byId.get(tipId) : undefined;
  let tipStyle: CSSProperties | undefined;
  const ctm = sceneRef.current?.getScreenCTM();
  if (tip && ctm && surfaceRef.current) {
    const box = surfaceRef.current.getBoundingClientRect();
    const p = pos(tip.s.id);
    const scr = new DOMPoint(p.x, p.y).matrixTransform(ctm);
    tipStyle = { left: clamp(scr.x - box.left + 18, 8, Math.max(8, box.width - 240)), top: clamp(scr.y - box.top - 96, 8, Math.max(8, box.height - 100)) };
  }
  const tipLinked = tip ? [...(adj.get(tip.s.id) ?? [])].filter((x) => visible.has(x)).slice(0, 3).map((x) => byId.get(x)!.s.name) : [];
  const labelZoom = transform.k >= 2.2;
  const ls = 1 / Math.sqrt(transform.k); // labels grow slower than the map so zooming in separates them
  const perDomain = useMemo(() => { const m = new Map<number, number>(); for (const id of displayed) { const di = byId.get(id)!.s.di; m.set(di, (m.get(di) ?? 0) + 1); } return m; }, [displayed, byId]);

  return (
    <div ref={surfaceRef} className="relative" data-galaxy-view={pathways ? 'pathways' : 'confirmed'} data-zoom={transform.k.toFixed(2)}
      onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={release} onPointerCancel={release}
      onPointerLeave={() => { if (!drag.current) setHover(null); }}>
      <svg ref={svgRef} id="graphSvg" className="galaxy-svg" viewBox={`0 0 ${GALAXY_W} ${GALAXY_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Interactive skill galaxy showing confirmed capabilities or possible pathways">
        <defs>
          <radialGradient id="galaxy-nebula" cx="50%" cy="50%" r="55%"><stop offset="0%" stopColor="#4feacf" stopOpacity=".12" /><stop offset="50%" stopColor="#537bc2" stopOpacity=".07" /><stop offset="100%" stopColor="#0b1230" stopOpacity="0" /></radialGradient>
          <filter id="galaxy-glow" x="-160%" y="-160%" width="420%" height="420%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width={GALAXY_W} height={GALAXY_H} fill="url(#galaxy-nebula)" />
        <g aria-hidden="true">
          {Array.from({ length: 140 }, (_, i) => { const theta = i * 2.399963, rr = 20 + Math.sqrt(i / 140) * 300; return <circle key={i} cx={(GALAXY_W / 2 + Math.cos(theta) * rr * 1.6).toFixed(1)} cy={(GALAXY_H / 2 + Math.sin(theta) * rr).toFixed(1)} r={i % 17 === 0 ? 1.2 : 0.55} fill={i % 9 === 0 ? '#aeafe9' : '#a9e5f3'} opacity={i % 9 === 0 ? 0.25 : 0.1} />; })}
        </g>
        <g ref={sceneRef} transform={transform.toString()}>
          <g aria-hidden="true">
            {hubs.filter((h) => activeDomains.has(h.di)).map((h) => {
              const d = DOMAINS[h.di]!;
              const label = d.name.toUpperCase();
              const count = [h.confirmed ? `${h.confirmed} confirmed` : '', h.pending ? `${h.pending} suggested` : ''].filter(Boolean).join(' · ');
              const w = label.length * 6.6 + 16;
              return (
                <g key={h.di} className="galaxy-domain-hub" data-domain={h.di}>
                  <circle cx={h.x} cy={h.y} r={h.r + 8} fill={d.color} opacity={0.035 + h.confirmed * 0.012} />
                  <circle cx={h.x} cy={h.y} r={h.r + 8} fill="none" stroke={d.color} strokeWidth={h.confirmed ? 1.2 : 0.7} strokeOpacity={h.confirmed ? 0.4 : 0.16} strokeDasharray="3 6" />
                  <g transform={`translate(${h.x} ${h.y - h.r - 30 * ls}) scale(${ls}) translate(${-w / 2} 0)`}>
                    <rect width={w} height={count ? 30 : 18} rx={6} fill="#0a1527" fillOpacity={0.88} stroke={d.color} strokeOpacity={0.35} />
                    <text className="galaxy-domain-label" x={8} y={12.5} fill={d.color}>{label}</text>
                    {count && <text className="galaxy-domain-count" x={8} y={25}>{count}</text>}
                  </g>
                </g>
              );
            })}
          </g>
          <g aria-hidden="true">
            {edges.filter((e) => visible.has(e.a) && visible.has(e.b) && (displayed.has(e.a) || displayed.has(e.b))).map((e) => {
              const a = pos(e.a), b = pos(e.b);
              const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
              const bow = e.type === 'semantic' ? Math.min(40, len * 0.16) : e.type === 'branch' ? 8 : 0;
              const mx = (a.x + b.x) / 2 - (dy / len) * bow, my = (a.y + b.y) / 2 + (dx / len) * bow;
              const on = !!focus && (e.a === focus || e.b === focus);
              const ghost = ghosts.has(e.a) || ghosts.has(e.b);
              return <path key={`${e.a}|${e.b}`} className={`sky-link sky-${e.type}${ghost ? ' sky-ghost-link' : ''}`} data-relation-type={e.type} data-relation-a={e.a} data-relation-b={e.b} fill="none"
                d={bow ? `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}` : `M${a.x} ${a.y} L${b.x} ${b.y}`}
                style={{ strokeOpacity: on ? 0.95 : ghost ? 0.3 : e.type === 'semantic' ? (pathways ? 0.28 : 0.5) : e.type === 'confirmed' || !pathways ? 0.6 : 0.3, strokeWidth: on ? 2.6 / Math.sqrt(transform.k) : undefined } as CSSProperties} />;
            })}
          </g>
          <g>
            {[...ghosts].map((id) => {
              const n = byId.get(id)!, p = pos(id), color = DOMAINS[n.s.di]!.color;
              const on = id === focus;
              return (
                <g key={id} className="sky-ghost-node" data-skill={id} tabIndex={0} role="button" aria-label={`${n.s.name} (not in your profile)`} transform={`translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`}
                  onClick={(e: { preventDefault(): void }) => { if (suppressClick.current) { suppressClick.current = false; e.preventDefault(); return; } onSelect(id); }}
                  onKeyDown={(e: { key: string; preventDefault(): void }) => onKey(id, e)} onFocus={() => setKeyboard(id)} onBlur={() => setKeyboard(null)}>
                  <circle r={on ? 9 : 7} fill="none" stroke={color} strokeOpacity={on ? 0.9 : 0.5} strokeWidth={1.1} strokeDasharray="2 3" />
                  <circle r={2.6} fill={color} opacity={0.6} />
                  <circle r={14} fill="transparent" pointerEvents="all" />
                  {(on || labelZoom) && <text className="sky-star-label is-ghost" y={16} transform={`scale(${ls})`}>{n.s.name}</text>}
                  <title>{n.s.name} · not in your profile</title>
                </g>
              );
            })}
            {nodes.filter((n) => displayed.has(n.s.id)).map((n) => {
              const p = pos(n.s.id), color = DOMAINS[n.s.di]!.color;
              const on = n.s.id === focus, related = !!focus && (adj.get(focus)?.has(n.s.id) ?? false);
              const dim = !!focus && !on && !related;
              const star = n.confirmed ? 5.2 + (n.signal.rated ? (n.signal.value ?? 0) * 0.5 : 0) : 3.1;
              const dense = perDomain.get(n.s.di) ?? 0;
              const showLabel = on || related || transform.k >= 2.2 || (n.confirmed && (dense <= 3 || (dense <= 5 && transform.k >= 1.1) || transform.k >= 1.8));
              return (
                <g key={n.s.id} className={`sky-skill-node${n.confirmed ? ' is-confirmed' : ''}${n.pending ? ' is-pending' : ''}${n.signal.rated ? ' is-rated' : ''}`} data-skill={n.s.id} tabIndex={0} role="button" aria-label={n.s.name}
                  transform={`translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`} style={{ opacity: dim ? 0.4 : 1 } as CSSProperties}
                  onClick={(e: { preventDefault(): void }) => { if (suppressClick.current) { suppressClick.current = false; e.preventDefault(); return; } onSelect(n.s.id); }}
                  onKeyDown={(e: { key: string; preventDefault(): void }) => onKey(n.s.id, e)} onFocus={() => setKeyboard(n.s.id)} onBlur={() => setKeyboard(null)}>
                  {n.confirmed && <circle r={star * 2.1} fill={color} opacity={on ? 0.4 : n.signal.rated ? 0.1 + (n.signal.value ?? 0) * 0.045 : 0.12} filter="url(#galaxy-glow)" />}
                  <circle className="sky-ring" r={on ? star + 7 : n.confirmed ? star + 5 : n.pending ? 9 : 6.5} fill="none" stroke={n.pending ? '#ffca8a' : color} strokeWidth={n.pending ? 2 : n.confirmed ? 1.8 : 0.9} strokeOpacity={n.pending ? 0.96 : n.confirmed ? 0.85 : 0.18} strokeDasharray={n.pending ? '2 3' : undefined} />
                  <circle r={on ? star + 1.6 : star} fill={n.pending ? '#f4b874' : n.confirmed ? color : '#8ea2bd'} opacity={n.pending ? 0.9 : n.confirmed ? 1 : 0.55} />
                  {n.signal.rated && <circle r={1.8} fill="#ffffff" opacity={0.9} />}
                  <circle r={16} fill="transparent" pointerEvents="all" className="sky-hit-target" />
                  {showLabel && <text className={`sky-star-label${n.confirmed ? ' is-confirmed' : ''}`} y={(star + 15) / ls} transform={`scale(${ls})`}>{n.s.name}</text>}
                  <title>{n.s.name}</title>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <div id="graphHoverTip" className="sky-hover-tip" role="tooltip" hidden={!tip} style={tipStyle}>
        {tip && (
          <>
            <strong>{tip.s.name}</strong><span>{tip.s.domain}</span>
            <small>{ghosts.has(tip.s.id) ? 'Nearby pathway · not in your profile' : tip.signal.rated ? `Self-reported confidence ${tip.signal.value}/4` : tip.confirmed ? 'Employee-confirmed experience; confidence unanswered' : tip.pending ? 'Résumé keyword suggestion · not confirmed' : 'Possible pathway · not attested'}</small>
            {tipLinked.length > 0 && <small className="sky-tip-related">Linked: {tipLinked.join(' · ')}</small>}
          </>
        )}
      </div>
    </div>
  );
}
