/**
 * Team → Roster & sharing → Signed cards. Sign a card file you exported, check a card someone sent
 * against its detached signature, and keep a local list of keys you trust. A valid signature means the
 * card is unchanged since that key signed it; it does not say who the key belongs to. Only a label you
 * chose, after confirming the fingerprint with the person, gives it that meaning.
 */
import { useRef, useState, type ChangeEvent } from 'react';
import { addTrusted, createSigningKey, formatKeyId, isCardSignature, removeTrusted, signCard, verifyCard, type TrustedKey, type VerifyResult } from '../../core/signing';
import { loadSigningKey, loadTrustList, saveSigningKey, saveTrustList } from '../../storage/trust';
import { useStore } from '../state/store';
import { useDialogs } from '../components/ui/dialogs';
import { Button, Empty, Panel, PanelHeading, Pill } from '../components/ui/primitives';
import { downloadJson, readJsonFile } from '../lib/files';

const STATUS_TEXT: Record<VerifyResult['status'], string> = {
  trusted: 'Signed by a key you trust, and the card is unchanged.',
  'untrusted-key': 'The card is unchanged since it was signed, but you have not trusted this key yet.',
  invalid: 'Do not rely on this card: the signature check failed.',
};

export function SignedCardsPanel() {
  const { flash } = useStore();
  const dialogs = useDialogs();
  const [key, setKey] = useState(loadSigningKey);
  const [trust, setTrust] = useState<TrustedKey[]>(loadTrustList);
  const [result, setResult] = useState<{ v: VerifyResult; publicKey: TrustedKey['publicKey']; cardName: string } | null>(null);
  const signRef = useRef<HTMLInputElement | null>(null);
  const verifyRef = useRef<HTMLInputElement | null>(null);

  const updateTrust = (next: TrustedKey[]) => { setTrust(next); saveTrustList(next); };

  async function makeKey() {
    const label = await dialogs.prompt('A label for your signing key, usually your name. Teammates see it next to your fingerprint.', { title: 'Create signing key', label: 'Key label', confirmLabel: 'Next' });
    if (!label) return;
    const pass = await dialogs.prompt(<>Choose a <b>passphrase</b> (8+ characters) that protects the private key on this computer. You type it each time you sign; it cannot be recovered.</>, { title: 'Protect the signing key', label: 'Passphrase', password: true, minLength: 8, confirmLabel: 'Create key' });
    if (!pass) return;
    try { const k = await createSigningKey(label, pass); saveSigningKey(k); setKey(k); flash('Signing key created. Share your fingerprint with teammates over a channel they trust.'); }
    catch (err) { flash(err instanceof Error ? err.message : String(err)); }
  }
  async function dropKey() {
    if (!key) return;
    const ok = await dialogs.confirm('Delete your signing key from this browser? Cards you signed stay valid for anyone who trusts the key, but you cannot sign new ones with it.', { title: 'Delete signing key', confirmLabel: 'Delete key', danger: true });
    if (!ok) return;
    saveSigningKey(null); setKey(null);
  }

  async function sign(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !key) return;
    try {
      const card = await readJsonFile(f, 256_000);
      const pass = await dialogs.prompt('Passphrase for your signing key.', { title: 'Sign card', label: 'Passphrase', password: true, confirmLabel: 'Sign' });
      if (!pass) return;
      const sig = await signCard(card, key, pass);
      downloadJson(sig, `${f.name.replace(/\.json$/i, '')}.sig.json`);
      flash('Signature created. Send it next to the card file; it does not contain the card.');
    } catch (err) { flash(`Could not sign: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function verify(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    try {
      const parsed = await Promise.all(files.slice(0, 2).map((f) => readJsonFile(f, 256_000)));
      const sig = parsed.find(isCardSignature);
      const card = parsed.find((p) => !isCardSignature(p));
      if (!sig || !card) { flash('Choose two files together: the peer card and its .sig.json signature.'); return; }
      const v = await verifyCard(card, sig, trust);
      const pk = (sig as { publicKey: TrustedKey['publicKey'] }).publicKey;
      setResult({ v, publicKey: pk, cardName: String((card as { name?: unknown }).name ?? 'this card').slice(0, 70) });
    } catch (err) { flash(`Could not check: ${err instanceof Error ? err.message : String(err)}`); }
  }

  async function trustKey() {
    if (!result) return;
    const label = await dialogs.prompt(<>Only trust this key after you have confirmed the fingerprint <code>{formatKeyId(result.v.keyId)}</code> with the person (in person or by phone). Label it with their name.</>, { title: 'Trust this key', label: 'Label', confirmLabel: 'Trust key' });
    if (!label) return;
    try {
      const next = await addTrusted(trust, result.publicKey, label);
      updateTrust(next);
      setResult({ ...result, v: { ...result.v, status: 'trusted', label: label.trim() } });
      flash(`Key trusted as "${label.trim()}".`);
    } catch (err) { flash(err instanceof Error ? err.message : String(err)); }
  }

  return (
    <Panel id="signedCards">
      <PanelHeading eyebrow="SIGNED CARDS" title="Check a card hasn't been changed">
        A detached signature lets a teammate prove a card file is unchanged since you signed it. It does not prove who you are: each reader decides which keys to trust, on this computer only.
      </PanelHeading>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-[14px]">Your signing key</h4>
          {key ? (
            <>
              <p className="mt-1 text-[13px]">{key.label} · fingerprint <code id="signKeyId">{formatKeyId(key.keyId)}</code></p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button id="signCardBtn" size="sm" variant="primary" onClick={() => signRef.current?.click()}>Sign a card file…</Button>
                <input ref={signRef} hidden type="file" id="signCardFile" accept=".json,application/json" aria-label="Choose the peer card to sign" onChange={sign} />
                <Button id="dropKeyBtn" size="sm" variant="ghost" onClick={dropKey}>Delete key</Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-[13px] text-muted">No signing key yet. Signing is optional; unsigned cards still import exactly as before.</p>
              <Button id="makeKeyBtn" size="sm" variant="primary" className="mt-2" onClick={makeKey}>Create signing key</Button>
            </>
          )}
        </div>
        <div>
          <h4 className="text-[14px]">Check a card you received</h4>
          <p className="mt-1 text-[13px] text-muted">Choose the card and its signature file together.</p>
          <Button id="verifyBtn" size="sm" className="mt-2" onClick={() => verifyRef.current?.click()}>Check card + signature…</Button>
          <input ref={verifyRef} hidden multiple type="file" id="verifyFiles" accept=".json,application/json" aria-label="Choose a peer card and its signature" onChange={verify} />
          {result && (
            <div id="verifyResult" role="status" data-status={result.v.status} className="mt-3 rounded-md border border-stroke bg-panel2/40 p-3 text-[13px]">
              <Pill tone={result.v.status === 'trusted' ? 'mint' : result.v.status === 'invalid' ? 'danger' : 'amber'}>{result.v.status === 'trusted' ? 'trusted' : result.v.status === 'invalid' ? 'invalid' : 'unknown key'}</Pill>
              <p className="mt-2">{STATUS_TEXT[result.v.status]}{result.v.reason ? ` ${result.v.reason}` : ''}</p>
              {result.v.status !== 'invalid' && <p className="mt-1 text-quiet">Card: {result.cardName} · key {formatKeyId(result.v.keyId)}{result.v.signer ? ` (self-described as "${result.v.signer}")` : ''}{result.v.label ? ` · you call it "${result.v.label}"` : ''}</p>}
              {result.v.status === 'untrusted-key' && <Button id="trustKeyBtn" size="sm" className="mt-2" onClick={trustKey}>Trust this key…</Button>}
            </div>
          )}
        </div>
      </div>
      <h4 className="mt-4 text-[14px]">Keys you trust</h4>
      {trust.length ? (
        <ul id="trustList" className="mt-1 space-y-1 text-[13px]">
          {trust.map((t) => (
            <li key={t.keyId} data-key-id={t.keyId} className="flex flex-wrap items-center justify-between gap-2 border-t border-stroke py-1">
              <span><b>{t.label}</b> · <code>{formatKeyId(t.keyId)}</code> · added {t.added}</span>
              <Button size="sm" variant="ghost" aria-label={`Stop trusting ${t.label}`} onClick={() => updateTrust(removeTrusted(trust, t.keyId))}>Remove</Button>
            </li>
          ))}
        </ul>
      ) : <Empty>No trusted keys yet. Trusting a key only affects what this panel reports.</Empty>}
    </Panel>
  );
}
