/**
 * Attested-capability spider web.
 *   shape  = how many skills the employee confirmed per spoke (breadth)
 *   shine  = optional self-reported confidence (0–4) on each node
 * Unrated confirmed skills stay visible and neutral; missing confidence is unknown, not low.
 */
import { useMemo } from 'react';
import { lineRadial, curveLinearClosed, scaleLinear } from 'd3';

export interface WebItem {
  name: string;
  short?: string;
  id?: string;
  /** Mean (domain view) or single (skill view) confidence, or null when unrated. */
  value: number | null;
  claimed: number;
  pending: number;
  capacity: number;
}

interface Props { items: WebItem[]; small?: boolean; uid: string; onSelect?: (index: number) => void; ariaLabel?: string }

export function SpiderWeb({ items, small = false, uid, onSelect, ariaLabel }: Props) {
  const w = 700, h = small ? 346 : 515, cx = 350, cy = small ? 158 : 242, r = small ? 109 : 175, n = Math.max(1, items.length);
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, f: number): [number, number] => [cx + Math.cos(angle(i)) * r * f, cy + Math.sin(angle(i)) * r * f];

  const radii = useMemo(() => {
    const breadthScale = scaleLinear().domain([0, 1]).range([0.23, 0.8]);
    return items.map((it) => {
      if (!(it.claimed > 0)) return 0;
      const breadth = it.capacity ? Math.min(1, it.claimed / it.capacity) : 1;
      const conf = it.value == null ? 0 : Math.min(4, Math.max(0, it.value)) / 4;
      return Math.min(0.99, breadthScale(breadth) + 0.17 * conf);
    });
  }, [items]);

  const active = items.filter((x) => x.claimed > 0).length;
  const pending = items.reduce((s, x) => s + x.pending, 0);
  const webPath = useMemo(() => {
    const gen = lineRadial<number>().angle((_, i) => (i * 2 * Math.PI) / n).radius((v) => v * r).curve(curveLinearClosed);
    return gen(radii) ?? '';
  }, [radii, n, r]);

  const ringPath = (f: number) => lineRadial<number>().angle((_, i) => (i * 2 * Math.PI) / n).radius(() => f * r).curve(curveLinearClosed)(items.map(() => 0)) ?? '';

  return (
    <svg className="radar-svg" viewBox={`${small ? -130 : -150} 0 ${w + (small ? 260 : 300)} ${h}`} role="img" aria-label={ariaLabel ?? 'Spider web built from confirmed capabilities. Confidence only adjusts glow and node prominence.'}>
      <defs>
        <radialGradient id={`radar-deep-${uid}`}><stop stopColor="#143a57" stopOpacity=".68" /><stop offset=".7" stopColor="#0a263e" stopOpacity=".2" /><stop offset="1" stopColor="#071324" stopOpacity="0" /></radialGradient>
        <linearGradient id={`radar-fill-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#6bf3dd" stopOpacity=".45" /><stop offset=".6" stopColor="#4b9dd0" stopOpacity=".27" /><stop offset="1" stopColor="#4b82bc" stopOpacity=".12" /></linearGradient>
        <filter id={`radar-glow-${uid}`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4.5" /></filter>
      </defs>
      <circle cx={cx} cy={cy} r={r + 33} fill={`url(#radar-deep-${uid})`} />
      <g transform={`translate(${cx} ${cy})`}>
        {[4, 3, 2, 1].map((ring) => <path key={ring} className={`radar-ring radar-ring-${ring}`} d={ringPath(ring / 4)} fill="none" strokeWidth={ring === 4 ? 1.8 : 0.9} />)}
      </g>
      {items.map((item, i) => {
        const [x, y] = pt(i, 1), [tx, ty] = pt(i, 1 + (small ? 0.27 : 0.28)), a = angle(i);
        const anchor = Math.cos(a) > 0.2 ? 'start' : Math.cos(a) < -0.2 ? 'end' : 'middle';
        const label = (item.short ?? item.name).slice(0, small ? 18 : 30);
        const [hx, hy] = pt(i, 1.08);
        const confidence = item.value == null ? 'Confidence not rated' : `Self-reported confidence ${item.value.toFixed(1)}/4`;
        return (
          <g key={item.id ?? item.name}>
            <line className="radar-axis" x1={cx} y1={cy} x2={x} y2={y} />
            {(item.claimed > 0 || item.pending > 0) && (
              <circle className={`radar-evidence-halo ${item.claimed ? 'is-confirmed' : 'is-pending'}`} cx={hx} cy={hy} r={Math.min(11, 4 + (item.claimed + item.pending) * 1.55)} fill="none"
                stroke={item.claimed ? '#66f0d5' : '#fac58e'} strokeWidth={item.claimed ? 2.5 : 2} strokeDasharray={item.claimed ? undefined : '2 3'}>
                <title>{`${item.claimed} confirmed capability mentions; ${item.pending} awaiting review`}</title>
              </circle>
            )}
            <text className="radar-label" tabIndex={0} role="button" data-radar-index={i} textAnchor={anchor} dominantBaseline="middle" x={tx.toFixed(2)} y={ty.toFixed(2)}
              onClick={() => onSelect?.(i)} onKeyDown={(e: { key: string; preventDefault(): void }) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(i); } }}>
              <title>{`${item.name} · ${item.claimed} confirmed · ${item.pending} suggested · ${confidence}`}</title>{label}
            </text>
          </g>
        );
      })}
      {active ? (
        <g transform={`translate(${cx} ${cy})`}>
          <path className="radar-web" data-web-active={active} d={webPath} fill={`url(#radar-fill-${uid})`} stroke="#68c6c5" strokeWidth={2.5} strokeLinejoin="round" />
        </g>
      ) : (
        <>
          <text className="radar-center" x={cx} y={cy - 9} textAnchor="middle">No skills attested</text>
          <text className="radar-subtitle" x={cx} y={cy + 14} textAnchor="middle">{pending ? `${pending} pending résumé suggestions` : 'Confirm capabilities to build the web'}</text>
        </>
      )}
      {active > 0 && items.map((item, i) => {
        if (!(item.claimed > 0)) return null;
        const [x, y] = pt(i, radii[i] ?? 0);
        const conf = item.value == null ? null : Math.max(0, Math.min(4, item.value));
        const rated = conf !== null;
        const bright = rated ? 0.12 + conf * 0.2 : 0.22;
        const rr = rated ? 4 + conf * 2.1 : 5.1;
        return (
          <g key={`node-${item.id ?? item.name}`}>
            <line className={`radar-branch ${rated ? 'is-rated' : 'is-unrated'}`} x1={cx} y1={cy} x2={x} y2={y} stroke="#68c6c5" strokeOpacity={rated ? (0.3 + conf * 0.145).toFixed(2) : '.36'} strokeWidth={rated ? (2 + conf * 0.65).toFixed(1) : '2'} />
            <circle className="radar-aura" cx={x} cy={y} r={rr * 2.7} fill={rated ? '#6af4d8' : '#79a6bc'} opacity={Math.min(0.48, bright * 0.4).toFixed(2)} filter={`url(#radar-glow-${uid})`} />
            <circle className={`radar-node ${rated ? 'is-rated' : 'is-unrated'}`} cx={x} cy={y} r={rr} fill={rated ? '#bcffef' : '#8fb3c4'} stroke={rated ? '#61f2da' : '#50778e'} strokeWidth={2} data-radar-index={i} onClick={() => onSelect?.(i)}>
              <title>{`${item.name} — ${item.claimed} confirmed · ${rated ? `${conf}/4 self-rated confidence` : 'confidence unrated'}`}</title>
            </circle>
          </g>
        );
      })}
      <text className="radar-footnote" x={cx} y={h - 10} textAnchor="middle">WEB = ATTESTED SKILLS · SHINE = VOLUNTARY CONFIDENCE (0–4)</text>
    </svg>
  );
}
