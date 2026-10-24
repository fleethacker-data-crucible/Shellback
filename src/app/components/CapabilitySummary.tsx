/**
 * Printable one-page capability summary for the employee (a conversation aid for a 1:1 or IDP).
 * Rendered hidden; printSheet('capabilitySheet') shows only this. Self-reported throughout.
 */
import { DOMAINS, SKILL_BY_ID } from '../../core/taxonomy';
import { STAGE_DEFS, ENERGY_LABEL } from '../../core/contribution';
import { orgLevelName } from '../../core/org';
import { useStore } from '../state/store';
import { Button } from './ui/primitives';
import { printSheet } from '../lib/print';
import { credentialStatus } from '../views/CredentialsView';
import { modeLabel } from '../lib/options';

export function PrintSummaryButton() {
  const { ws } = useStore();
  if (!ws.profile.confirmed.length) return null;
  return <Button id="printSummary" size="sm" onClick={() => printSheet('capabilitySheet')}>Print summary</Button>;
}

export function CapabilitySheet() {
  const { ws } = useStore();
  const p = ws.profile;
  const byDomain = DOMAINS.map((d) => ({ d, skills: p.confirmed.map((id) => SKILL_BY_ID.get(id)!).filter((s) => s && s.di === d.index) })).filter((x) => x.skills.length);
  const stages = STAGE_DEFS.filter((s) => p.contribution.stages[s.id]);
  return (
    <section id="capabilitySheet" data-print-sheet aria-hidden="true">
      <h1>{p.displayName || 'My'} capability summary</h1>
      <p className="sheet-mute">Printed from Synapse on {new Date().toISOString().slice(0, 10)}. Everything here is self-reported by the employee; nothing is a score, a qualification or an assessment.{p.orgCode ? ` ${orgLevelName(p.orgCode)} ${p.orgCode}${p.orgTitle ? ` · ${p.orgTitle}` : ''}.` : ''}</p>
      <h2>Confirmed skills ({p.confirmed.length})</h2>
      <table>
        <thead><tr><th>Domain</th><th>Skill</th><th>Confidence (0–4)</th><th>How I usually do it</th></tr></thead>
        <tbody>{byDomain.flatMap(({ d, skills }) => skills.map((s, i) => { const a = p.surveys[s.id]; return <tr key={s.id}>{i === 0 && <td rowSpan={skills.length}><b>{d.name}</b></td>}<td>{s.name}</td><td>{a ? `${a.confidence}/4` : 'not rated'}</td><td>{a ? modeLabel(a.method) : '—'}</td></tr>; }))}</tbody>
      </table>
      {p.credentials.length > 0 && (
        <>
          <h2>Credentials ({p.credentials.length})</h2>
          <table>
            <thead><tr><th>Credential</th><th>Authority</th><th>Issued</th><th>Expires</th><th>Status</th></tr></thead>
            <tbody>{p.credentials.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.authority || '—'}</td><td>{c.issued || '—'}</td><td>{c.expiry || '—'}</td><td>{credentialStatus(c).label}</td></tr>)}</tbody>
          </table>
        </>
      )}
      {stages.length > 0 && (
        <>
          <h2>How I like to contribute</h2>
          <ul>{stages.map((s) => <li key={s.id}><b>{s.label}</b>: {ENERGY_LABEL[p.contribution.stages[s.id]!].toLowerCase()}</li>)}</ul>
          {p.contribution.source && <p className="sheet-mute">Based on: {p.contribution.source}</p>}
        </>
      )}
      <h2>Where I want to grow</h2>
      <div className="sheet-box" />
      <h2>Notes from the conversation</h2>
      <div className="sheet-box" />
      <p className="sheet-mute">Suggested use: bring to a 1:1 or development discussion. The employee owns this page and the data behind it.</p>
    </section>
  );
}
