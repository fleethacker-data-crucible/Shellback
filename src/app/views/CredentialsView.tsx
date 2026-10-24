import { useState } from 'react';
import { renewalLabel, renewalState } from '../../core/analytics';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import { addCredential, deleteCredential, dismissCredentialCandidate, pendingCredentialCandidates } from '../state/actions';
import { Button, Empty, Field, Input, Panel, PanelHeading, Pill, SectionIntro } from '../components/ui/primitives';

export function CredentialsView({ embedded = false }: { embedded?: boolean }) {
  const { ws, navigate, flash } = useStore();
  const act = useAction();
  const [form, setForm] = useState({ name: '', authority: '', expiry: '' });
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const records = pendingCredentialCandidates(ws);
  const held = [...ws.profile.credentials].sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));

  const clear = () => { setForm({ name: '', authority: '', expiry: '' }); setReviewKey(null); };
  const save = () => { if (act((d) => addCredential(d, form, reviewKey)) !== undefined) clear(); };

  return (
    <section id="credentials" className="space-y-5">
      {!embedded && <SectionIntro eyebrow="PLAN / CREDENTIAL READINESS" title="Credential desk.">Résumé intake can suggest recognizable certifications and qualifications for your review. Suggestions are not automatically added, verified, or assigned expiry dates. Save only credentials you actually hold.</SectionIntro>}

      <Panel className="credential-review-panel">
        <PanelHeading eyebrow="STEP 1 / REVIEW RÉSUMÉ MENTIONS" title={<>Credential suggestions <Pill tone={records.length ? 'amber' : 'neutral'}><span id="credentialSuggestionCount">{records.length}</span></Pill></>}
          action={<Button id="scanCredentialsFromDesk" size="sm" onClick={() => { navigate({ view: 'profile', tab: 'intake' }); flash('Credential names are checked during the same résumé scan as skills.'); }}>Scan résumé text ↻</Button>}>
          Local keyword matching finds possible credential names. Review the exact matched phrase, then approve, correct, or dismiss each one. Plans to pursue a credential should not be recorded as credentials held.
        </PanelHeading>
        <div id="credentialCandidateList" aria-live="polite" className="space-y-2">
          {records.length ? records.map((c) => (
            <article key={c.key} className="row-card flex-wrap">
              <div><strong className="block text-[13px]">{c.name}</strong><small className="block text-quiet">{c.authority} · Matched "{c.matched}"</small><Pill tone="amber" className="mt-1">Unreviewed / unverified</Pill></div>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" data-review-credential={c.key} onClick={() => { setReviewKey(c.key); setForm({ name: c.name, authority: c.authority, expiry: '' }); document.getElementById('credName')?.focus(); flash('Review the credential, issuer and optional renewal date. Nothing is saved until you approve.'); }}>Review &amp; edit</Button>
                <Button size="sm" data-dismiss-credential={c.key} onClick={() => { if (reviewKey === c.key) clear(); act((d) => dismissCredentialCandidate(d, c.key)); }}>Dismiss</Button>
              </div>
            </article>
          )) : <Empty>No pending credential suggestions. Paste or upload a plain-text résumé in My capability profile, or add a credential manually below.</Empty>}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeading title="Step 2 / Confirm a credential in my inventory">{reviewKey ? <Pill tone="mint">Reviewing a résumé suggestion</Pill> : 'Enter only credentials you actually hold.'}</PanelHeading>
          <Field label="Credential name" htmlFor="credName"><Input id="credName" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. AWS Solutions Architect – Professional" maxLength={160} /></Field>
          <Field label="Issuing authority" htmlFor="credAuthority"><Input id="credAuthority" value={form.authority} onChange={(v) => setForm({ ...form, authority: v })} placeholder="e.g. AWS, internal authority" maxLength={160} /></Field>
          <Field label="Expiration or renewal date (optional)" htmlFor="credExpiry"><Input id="credExpiry" type="date" value={form.expiry} onChange={(v) => setForm({ ...form, expiry: v })} /></Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button id="addCredential" variant="primary" onClick={save}>Save self-reported credential</Button>
            <Button id="credClearForm" onClick={clear}>Clear form</Button>
          </div>
          <p className="note mt-3">Do not enter credential numbers, personal IDs, classified work details, or restricted records.</p>
        </Panel>
        <Panel>
          <PanelHeading title="My renewal horizon">Sorted by self-entered renewal date.</PanelHeading>
          <div id="credentialList" className="space-y-2">
            {held.length ? held.map((c) => {
              const r = renewalState(c);
              return (
                <div key={c.id} className="cred-card row-card">
                  <div><b className="block text-[13px]">{c.name}</b><small className="block text-quiet">{c.authority || 'Authority unspecified'} · {c.expiry || 'No date'}</small><span className={`cred-status text-[11px] ${r.state === 'past' ? 'text-danger' : r.state === 'soon' ? 'text-amber' : 'text-muted'}`}>{renewalLabel(r)} · Self-reported / unverified{c.source === 'resume-reviewed' ? ' · from résumé review' : ''}</span></div>
                  <Button size="icon" variant="danger" data-delete-cred={c.id} aria-label={`Delete credential ${c.name}`} onClick={() => act((d) => deleteCredential(d, c.id))}>✕</Button>
                </div>
              );
            }) : <Empty>No employee-reviewed credentials recorded. Suggested résumé matches are listed above and require your explicit approval.</Empty>}
          </div>
        </Panel>
      </div>
    </section>
  );
}
