/**
 * Plain-language skills summary for read-aloud and for screen readers. Counts only: it never names a
 * ranking, a score or a comparison with anyone else.
 */
import { DOMAINS, SKILL_BY_ID } from './taxonomy';
import type { Workspace } from './schema';

export function skillsSummaryText(ws: Workspace): string {
  const confirmed = [...new Set(ws.profile.confirmed)].filter((id) => SKILL_BY_ID.has(id));
  if (!confirmed.length) return 'You have not confirmed any skills yet. Start with a résumé, or add a skill you can show someone.';
  const perDomain = DOMAINS.map((d) => ({ name: d.name, n: confirmed.filter((id) => SKILL_BY_ID.get(id)?.di === d.index).length })).filter((x) => x.n > 0);
  const top = [...perDomain].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 3).map((x) => `${x.name}, ${x.n}`);
  const rated = confirmed.filter((id) => ws.profile.surveys[id]).length;
  const parts = [
    `You have confirmed ${confirmed.length} skill${confirmed.length === 1 ? '' : 's'} in ${perDomain.length} domain${perDomain.length === 1 ? '' : 's'}.`,
    top.length ? `The most covered domains are ${top.join('; ')}.` : '',
    rated ? `You recorded confidence answers for ${rated} of them.` : 'No confidence answers are recorded yet.',
    'Everything here is self-reported.',
  ];
  return parts.filter(Boolean).join(' ');
}
