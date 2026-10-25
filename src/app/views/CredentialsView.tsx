import { useState } from 'react';
import { renewalLabel, renewalState } from '../../core/analytics';
import type { Credential, CredentialProvenance } from '../../core/schema';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import { addCredential, deleteCredential, dismissCredentialCandidate, pendingCredentialCandidates, updateCredential, type CredentialInput } from '../state/actions';
import { Button, Empty, Field, Input, Panel, PanelHeading, Pill, SectionIntro, Select, Textarea } from '../components/ui/primitives';
import { TrustChip } from '../components/TrustChip';

const EMPTY: Required<CredentialInput> = { name: '', authority: '', expiry: '', issued: '', verifier: '', provenance: 'claimed', note: '' };
const PROVENANCE: Array<{ value: CredentialProvenance; label: string; hint: string }> = [
  { value: 'claimed', label: 'Claimed — I hold this', hint: 'Your own statement. The default.' },
  { value: 'reviewed', label: 'Reviewed — from my résumé, checked by me', hint: 'A résumé suggestion you confirmed is accurate.' },
  { value: 'verified', label: 'Verified — an authority confirmed it to me', hint: 'Name who verified it. Shellback records your statement; it does not check with the authority.' },
];

/** Lifecycle status derived from dates + provenance. Never a judgement of the person. */
export function credentialStatus(c: Credential, now = new Date()): { key: 'expired' | 'renew-soon' | CredentialProvenance; label: string; tone: 'danger' | 'amber' | 'mint' | 'neutral' } {
  const r = renewalState(c, now);
  if (r.state === 'past') return { key: 'expired', label: 'Expired', tone: 'danger' };
  if (r.state === 'soon') return { key: 'renew-soon', label: 'Renew soon', tone: 'amber' };
  if (c.provenance === 'verified') return { key: 'verified', label: 'Verified (by ' + (c.verifier || 'unnamed') + ')', tone: 'mint' };
  if (c.provenance === 'reviewed') return { key: 'reviewed', label: 'Reviewed by me', tone: 'neutral' };
  return { key: 'claimed', label: 'Claimed', tone: 'neutral' };
}

export function CredentialsView({ embedded = false }: { embedded?: boolean }) {
  const { ws, navigate, flash } = useStore();
  const act = useAction();
  const [form, setForm] = useState<Required<CredentialInput>>(EMPTY);
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const records = pendingCredentialCandidates(ws);
  const held = [...ws.profile.credentials].sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));

  const clear = () => { setForm(EMPTY); setReviewKey(null); setEditingId(null); };
  const save = () => {
    const ok = editingId ? act((d) => updateCredential(d, editingId, form)) : act((d) => addCredential(d, form, reviewKey));
    if (ok !== undefined) clear();
  };
  const startEdit = (c: Credential) => {
    setEditingId(c.id); setReviewKey(null);
    setForm({ name: c.name, authority: c.authority, expiry: c.expiry, issued: c.issued, verifier: c.verifier, provenance: c.provenance, note: c.note });
    document.getElementById('credName')?.focus();
  };

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
                <Button size="sm" variant="primary" data-review-credential={c.key} onClick={() => { setEditingId(null); setReviewKey(c.key); setForm({ ...EMPTY, name: c.name, authority: c.authority, provenance: 'reviewed' }); document.getElementById('credName')?.focus(); flash('Review the credential, issuer and dates. Nothing is saved until you approve.'); }}>Review &amp; edit</Button>
                <Button size="sm" data-dismiss-credential={c.key} onClick={() => { if (reviewKey === c.key) clear(); act((d) => dismissCredentialCandidate(d, c.key)); }}>Dismiss</Button>
              </div>
            </article>
          )) : <Empty>No pending credential suggestions. Paste or upload a résumé in My capability profile, or add a credential manually below.</Empty>}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel id="credentialForm" aria-label={editingId ? 'Edit credential' : 'Add credential'}>
          <PanelHeading title={editingId ? 'Edit credential' : 'Step 2 / Confirm a credential in my inventory'}>{editingId ? <Pill tone="mint">Editing in place</Pill> : reviewKey ? <Pill tone="mint">Reviewing a résumé suggestion</Pill> : 'Enter only credentials you actually hold.'}</PanelHeading>
          <Field label="Credential name" htmlFor="credName"><Input id="credName" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. AWS Solutions Architect – Professional" maxLength={160} /></Field>
          <Field label="Issuing authority" htmlFor="credAuthority"><Input id="credAuthority" value={form.authority} onChange={(v) => setForm({ ...form, authority: v })} placeholder="e.g. AWS, internal authority" maxLength={160} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Issued (optional)" htmlFor="credIssued"><Input id="credIssued" type="date" value={form.issued} onChange={(v) => setForm({ ...form, issued: v })} /></Field>
            <Field label="Expires / renews (optional)" htmlFor="credExpiry"><Input id="credExpiry" type="date" value={form.expiry} onChange={(v) => setForm({ ...form, expiry: v })} /></Field>
          </div>
          <Field label="How you know" htmlFor="credProvenance" hint={PROVENANCE.find((p) => p.value === form.provenance)?.hint}>
            <Select id="credProvenance" value={form.provenance} onChange={(v) => setForm({ ...form, provenance: v as CredentialProvenance })} options={PROVENANCE.map((p) => ({ value: p.value, label: p.label }))} />
          </Field>
          {form.provenance === 'verified' && <Field label="Verified by" htmlFor="credVerifier"><Input id="credVerifier" value={form.verifier} onChange={(v) => setForm({ ...form, verifier: v })} placeholder="e.g. training registrar, certifying body portal, supervisor name" maxLength={160} /></Field>}
          <Field label="Note (optional)" htmlFor="credNote"><Textarea id="credNote" rows={2} value={form.note} onChange={(v) => setForm({ ...form, note: v })} maxLength={300} placeholder="e.g. renewal requires 40 CPE hours" /></Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button id="addCredential" variant="primary" onClick={save}>{editingId ? 'Save changes' : 'Save credential'}</Button>
            <Button id="credClearForm" onClick={clear}>{editingId ? 'Cancel' : 'Clear form'}</Button>
          </div>
          <p className="note mt-3">Do not enter credential numbers, personal IDs, classified work details, or restricted records. <TrustChip kind="self-reported" extra="A verified credential here still means you told Shellback it was verified; an authoritative feed (see docs) would be needed to confirm it independently." /></p>
        </Panel>
        <Panel>
          <PanelHeading title="My credentials">Sorted by renewal date. Status comes from the dates and how you said you know; it is never a judgement of you.</PanelHeading>
          <div id="credentialList" className="space-y-2">
            {held.length ? held.map((c) => {
              const r = renewalState(c);
              const st = credentialStatus(c);
              return (
                <div key={c.id} className="cred-card row-card items-start" data-credential-status={st.key}>
                  <div className="min-w-0">
                    <b className="block text-[13px]">{c.name}</b>
                    <small className="block text-quiet">{c.authority || 'Authority unspecified'}{c.issued ? ` · issued ${c.issued}` : ''}{c.expiry ? ` · ${r.state === 'past' ? 'expired' : 'expires'} ${c.expiry}` : ' · no expiry recorded'}</small>
                    <span className={`cred-status mt-1 inline-flex flex-wrap items-center gap-1.5 text-[12px] ${r.state === 'past' ? 'text-danger' : r.state === 'soon' ? 'text-amber' : 'text-muted'}`}><Pill tone={st.tone}>{st.label}</Pill>{c.expiry && <span>{renewalLabel(r)}</span>}{c.source === 'resume-reviewed' && <span>· from résumé review</span>}</span>
                    {c.note && <p className="note mt-1">{c.note}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" data-edit-cred={c.id} aria-label={`Edit credential ${c.name}`} onClick={() => startEdit(c)}>Edit</Button>
                    <Button size="icon" variant="danger" data-delete-cred={c.id} aria-label={`Delete credential ${c.name}`} onClick={() => { if (editingId === c.id) clear(); act((d) => deleteCredential(d, c.id)); }}>✕</Button>
                  </div>
                </div>
              );
            }) : <Empty>No employee-reviewed credentials recorded. Suggested résumé matches are listed above and require your explicit approval.</Empty>}
          </div>
        </Panel>
      </div>
    </section>
  );
}
