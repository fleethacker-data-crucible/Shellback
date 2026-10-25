/**
 * Shellback brand mark: a small constellation whose five stars trace an "S", joined the way skills
 * are joined in the galaxy. Pure SVG so it scales from a 16px favicon to a hero illustration.
 */
import type { CSSProperties } from 'react';

const STARS: Array<[number, number, number]> = [[42, 9, 4.2], [14, 18, 3.2], [32, 32, 5.6], [50, 46, 3.2], [22, 55, 4.2]];
const LINKS: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 2], [2, 4]];

export function ShellbackMark({ size = 36, className, glow = true, style }: { size?: number; className?: string; glow?: boolean; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} style={style} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="shellback-mark-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8ff5df" /><stop offset="100%" stopColor="#4fb8ff" /></linearGradient>
        <filter id="shellback-mark-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g stroke="url(#shellback-mark-g)" strokeWidth="2" strokeLinecap="round" opacity="0.85">
        {LINKS.map(([a, b]) => <line key={`${a}${b}`} x1={STARS[a]![0]} y1={STARS[a]![1]} x2={STARS[b]![0]} y2={STARS[b]![1]} strokeDasharray={a === 0 && b === 2 || a === 2 && b === 4 ? '2 3.5' : undefined} strokeOpacity={a === 0 && b === 2 || a === 2 && b === 4 ? 0.55 : 1} />)}
      </g>
      <g fill="url(#shellback-mark-g)" filter={glow ? 'url(#shellback-mark-glow)' : undefined}>
        {STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
      </g>
      <circle cx={32} cy={32} r={2} fill="#06111f" />
    </svg>
  );
}

