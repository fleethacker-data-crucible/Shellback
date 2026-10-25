/**
 * Team → Roster: build a teammate's card from a résumé you hold.
 * The result is a DRAFT: clearly marked as not attested, left out of coverage unless the team opts in,
 * and downloadable so the real person can import it as suggestions and confirm it themselves.
 */
import { useRef, useState, type ChangeEvent } from 'react';
import { SKILL_BY_ID, skillName } from '../../core/taxonomy';
import { normalizeOrgCode } from '../../core/org';
import { draftToMember, parseDraftCard, type DraftCard } from '../../core/schema';
import { newShareId } from '../../core/ids';
import { today } from '../../core/schema';
import { useStore } from '../state/store';
import { useAction } from '../state/hooks';
import { importMember } from '../state/actions';
import { activeProvider } from '../../storage/intel-settings';
import { scanResume } from '../../storage/scan-client';
import { extractDocumentText } from '../lib/document-text';
import { downloadJson } from '../lib/files';
import { Button, Checkbox, Empty, Field, Input, Panel, PanelHeading, Pill, Textarea } from '../components/ui/primitives';

interface Preview { skills: Array<{ id: string; on: boolean }>; credentials: Array<{ name: string; on: boolean }>; chars: number }

export function DraftTeammatePanel({ teamId, onAdded }: { teamId: string | undefined; onAdded: (id: string) => void }) {
  const { ws, flash } = useStore();
  const act = useAction();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [orgTitle, setOrgTitle] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const provider = activeProvider().describe();

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const r = await extractDocumentText(f);
      setText(r.text);
      if (!name) { const first = r.text.split('\n').map((l) => l.trim()).find((l) => l.length > 2 && l.length < 60 && !/@|\d{3}/.test(l)); if (first) setName(first); }
      if (r.note) { flash(r.note); return; }
      await scan(r.text);
    } catch (err) { flash(err instanceof Error ? err.message : 'Could not read that file.'); }
  }
  async function scan(t = text) {
    if (!t.trim()) { flash('Upload a résumé or paste its text first.'); return; }
    setBusy(true);
    try {
      let result;
      if (provider.offline) result = await scanResume({ text: t, confirmed: [] });
      else { try { result = await activeProvider().scanResume({ text: t, confirmed: [] }); } catch (err) { flash(`${provider.label} failed (${err instanceof Error ? err.message : String(err)}). Used local rules.`); result = await scanResume({ text: t, confirmed: [] }); } }
      setPreview({ skills: result.skills.filter((id) => SKILL_BY_ID.has(id)).map((id) => ({ id, on: true })), credentials: result.credentials.map((c) => ({ name: c.name, on: true })), chars: result.chars });
    } finally { setBusy(false); }
  }
  function buildCard(): DraftCard | null {
    const n = name.trim();
    if (!n) { flash('Give the teammate a display name.'); return null; }
    if (!preview) { flash('Scan a résumé first.'); return null; }
    const skills = preview.skills.filter((s) => s.on).map((s) => s.id);
    if (!skills.length) { flash('Tick at least one skill.'); return null; }
    return parseDraftCard({
      format: 'synapse-draft-card', version: 1, id: newShareId(), name: n, attested: false, issued: today(), draftedBy: ws.profile.displayName || '',
      skills, credentialNames: preview.credentials.filter((c) => c.on).map((c) => c.name), orgCode: normalizeOrgCode(orgCode), orgTitle: orgTitle.trim(),
      note: `Drafted from a résumé on ${today()}${ws.profile.displayName ? ` by ${ws.profile.displayName}` : ''}; not confirmed by ${n}.`,
    });
  }
  function addDraft() {
    const card = buildCard();
    if (!card || !teamId) { if (!teamId) flash('Create or select a team first.'); return; }
    const member = draftToMember(card);
    const r = act((d) => importMember(d, teamId, member));
    if (r === undefined) return;
    flash(`${member.name} added as a DRAFT. It stays out of coverage until you include drafts, and ${member.name} can confirm it from the downloadable card.`);
    onAdded(member.id);
    reset();
  }
  function download() { const card = buildCard(); if (card) downloadJson(card, `synapse-draft-${card.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`); }
  const reset = () => { setName(''); setOrgCode(''); setOrgTitle(''); setText(''); setPreview(null); };

  return (
    <Panel id="draftTeammate">
      <PanelHeading eyebrow="BUILD A TEAM FASTER" title="Add a teammate from a résumé (draft)">
        For when you hold the résumés and the people have not used Synapse yet. What you add here is a <b>draft</b>: badged as not attested, excluded from coverage unless you include drafts, and meant to be handed to the person to confirm. Nothing here becomes a skill of theirs until they say so.
      </PanelHeading>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Display name" htmlFor="draftName"><Input id="draftName" value={name} onChange={setName} maxLength={70} placeholder="e.g. Jordan Reyes" /></Field>
        <Field label="Org code (optional)" htmlFor="draftOrg"><Input id="draftOrg" value={orgCode} onChange={setOrgCode} maxLength={20} placeholder="e.g. 1513.2" /></Field>
        <Field label="Title (optional)" htmlFor="draftTitle"><Input id="draftTitle" value={orgTitle} onChange={setOrgTitle} maxLength={80} placeholder="e.g. Data Analyst" /></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input ref={fileRef} id="draftFile" type="file" className="sr-only" accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="Upload a résumé for the draft" onChange={onFile} />
        <Button id="draftUpload" variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>Upload résumé (.pdf / .docx / .txt)</Button>
        <Button id="draftScan" onClick={() => scan()} disabled={busy || !text.trim()}>{busy ? 'Scanning…' : 'Scan pasted text'}</Button>
        <span className="note">Scanned by <b>{provider.label}</b>{provider.offline ? ' · nothing leaves this workstation' : ` · text is sent to ${provider.origin}`}. Résumé text is not stored.</span>
      </div>
      <details className="mt-2 text-[12px]"><summary className="cursor-pointer text-quiet">Or paste text</summary><Textarea id="draftText" rows={4} value={text} onChange={setText} placeholder="Paste the résumé text" /></details>
      {preview && (
        <div id="draftPreview" className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-[13px]">Suggested skills <Pill tone="amber">{preview.skills.filter((s) => s.on).length} ticked</Pill></h4>
            <div className="mt-2 grid gap-1">{preview.skills.length ? preview.skills.map((s, i) => <Checkbox key={s.id} checked={s.on} onChange={(v) => setPreview({ ...preview, skills: preview.skills.map((x, j) => (j === i ? { ...x, on: v } : x)) })}><span data-draft-skill={s.id}>{skillName(s.id)}</span> <small className="text-quiet">· {SKILL_BY_ID.get(s.id)?.domain}</small></Checkbox>) : <Empty>No taxonomy skills found in that text.</Empty>}</div>
          </div>
          <div>
            <h4 className="text-[13px]">Credential names mentioned <Pill>{preview.credentials.filter((c) => c.on).length} ticked</Pill></h4>
            <div className="mt-2 grid gap-1">{preview.credentials.length ? preview.credentials.map((c, i) => <Checkbox key={c.name} checked={c.on} onChange={(v) => setPreview({ ...preview, credentials: preview.credentials.map((x, j) => (j === i ? { ...x, on: v } : x)) })}>{c.name}</Checkbox>) : <Empty>No credential names found.</Empty>}</div>
            <p className="note mt-2">Names only, unverified; the person adds dates and provenance when they confirm.</p>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button id="draftAdd" variant="primary" onClick={addDraft}>Add to team as draft</Button>
            <Button id="draftDownload" onClick={download}>Download draft card for {name.trim() || 'them'} ↧</Button>
            <Button variant="ghost" onClick={reset}>Clear</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
