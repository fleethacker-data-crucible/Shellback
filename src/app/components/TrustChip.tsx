/**
 * One chip replaces the disclaimers that used to repeat under every panel.
 * Click/Enter opens a short "what this means" explanation; nothing else moves.
 */
import type { ReactNode } from 'react';
import { cn } from './ui/primitives';

export type TrustKind = 'self-reported' | 'aggregate' | 'local-only' | 'suggestion';

const COPY: Record<TrustKind, { label: string; title: string; body: ReactNode }> = {
  'self-reported': {
    label: 'Self-reported',
    title: 'What self-reported means',
    body: <>Everything in Synapse starts with the employee's own attestation. It is not independently verified and does not establish a qualification, clearance or readiness. Treat it as a conversation starter, not a record of truth.</>,
  },
  aggregate: {
    label: 'Aggregate only',
    title: 'Why you see groups, not people',
    body: <>Team views count people who opted in, and only show numbers once a group is large enough that no single person can be picked out. Nothing here ranks or scores an individual.</>,
  },
  'local-only': {
    label: 'Stays on this workstation',
    title: 'Where your data lives',
    body: <>Your workspace is stored in this browser only. Nothing is sent anywhere unless you export a file yourself, and the Program → Trust & data page lists exactly what an export contains.</>,
  },
  suggestion: {
    label: 'Suggestion',
    title: 'What a suggestion is',
    body: <>Suggestions come from keyword matching (or an intelligence provider you chose). They are proposals for you to confirm or dismiss; a dismissed suggestion never comes back and an unconfirmed one is never shown as a skill.</>,
  },
};

export function TrustChip({ kind, className, extra }: { kind: TrustKind; className?: string; extra?: ReactNode }) {
  const c = COPY[kind];
  return (
    <details className={cn('trust-chip relative inline-block align-middle', className)} data-trust-chip={kind}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-stroke bg-panel2/70 px-2 py-0.5 text-[11px] font-bold text-muted hover:border-mint/50 hover:text-text [&::-webkit-details-marker]:hidden">
        <i aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-mint/70" />{c.label}<span aria-hidden="true" className="text-quiet">ⓘ</span>
      </summary>
      <div role="note" className="absolute left-0 top-full z-20 mt-1 w-[300px] max-w-[80vw] rounded-md border border-stroke bg-panel p-3 text-[12px] leading-relaxed shadow-xl">
        <strong className="block text-[12px] text-text">{c.title}</strong>
        <p className="mt-1 text-muted">{c.body}</p>
        {extra && <p className="mt-1 text-muted">{extra}</p>}
      </div>
    </details>
  );
}

export function TrustChips({ kinds, className }: { kinds: TrustKind[]; className?: string }) {
  return <span className={cn('inline-flex flex-wrap gap-1.5', className)}>{kinds.map((k) => <TrustChip key={k} kind={k} />)}</span>;
}
