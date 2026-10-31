/**
 * Signed peer cards: a detached ECDSA P-256 signature over a card file plus a local trust list.
 *
 * What a valid signature proves: the card has not changed since the holder of that key signed it.
 * What it does not prove: who the holder is. Shellback has no directory, so a key becomes meaningful
 * only when the reader adds it to their own trust list under a label they chose (for example after
 * confirming the fingerprint with the colleague in person). Nothing here phones home; keys, signatures
 * and the trust list are local files and browser storage.
 */
import { z } from 'zod';
import { decryptJson, encryptJson, isEncryptedEnvelope, type EncryptedEnvelope } from './crypto';

export const SIGNATURE_FORMAT = 'shellback-card-signature' as const;
export const SIGNING_ALG = 'ES256' as const;

export interface PublicKeyJwk { kty: 'EC'; crv: 'P-256'; x: string; y: string }
export interface SigningKey { keyId: string; label: string; publicKey: PublicKeyJwk; sealedPrivate: EncryptedEnvelope; created: string }

export const publicKeySchema = z.object({ kty: z.literal('EC'), crv: z.literal('P-256'), x: z.string().regex(/^[A-Za-z0-9_-]{40,50}$/), y: z.string().regex(/^[A-Za-z0-9_-]{40,50}$/) });

export const signatureSchema = z.object({
  format: z.literal(SIGNATURE_FORMAT),
  version: z.literal(1),
  alg: z.literal(SIGNING_ALG),
  keyId: z.string().regex(/^[0-9a-f]{16}$/),
  publicKey: publicKeySchema,
  signer: z.string().max(70).default(''),
  cardId: z.string().regex(/^[a-zA-Z0-9-]{8,70}$/),
  cardDigest: z.string().regex(/^[0-9a-f]{64}$/),
  signedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  signature: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(200),
});
export type CardSignature = z.infer<typeof signatureSchema>;
export const isCardSignature = (v: unknown): boolean => !!v && typeof v === 'object' && (v as { format?: unknown }).format === SIGNATURE_FORMAT;

export interface TrustedKey { keyId: string; label: string; publicKey: PublicKeyJwk; added: string }

export type VerifyStatus = 'trusted' | 'untrusted-key' | 'invalid';
export interface VerifyResult { status: VerifyStatus; keyId: string; signer: string; label?: string; reason?: string }

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const toB64 = (buf: ArrayBuffer) => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const todayIso = () => new Date().toISOString().slice(0, 10);

/** JSON with object keys sorted at every level, so the same card always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export const cardDigest = async (card: unknown): Promise<string> => hex(await crypto.subtle.digest('SHA-256', enc.encode(canonicalJson(card))));

/** A short, stable fingerprint of a public key: first 16 hex characters of SHA-256 over its canonical JWK. */
export async function keyIdOf(pub: PublicKeyJwk): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(canonicalJson({ crv: pub.crv, kty: pub.kty, x: pub.x, y: pub.y })))).slice(0, 16);
}
export const formatKeyId = (id: string): string => id.replace(/(.{4})(?=.)/g, '$1 ');

/** Create a signing key. The private half is sealed with a passphrase (AES-GCM) and never leaves this object in the clear. */
export async function createSigningKey(label: string, passphrase: string): Promise<SigningKey> {
  const name = label.trim().slice(0, 70);
  if (!name) throw new Error('Give the key a label, for example your name.');
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = publicKeySchema.parse(await crypto.subtle.exportKey('jwk', pair.publicKey));
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKey: PublicKeyJwk = { kty: 'EC', crv: 'P-256', x: pub.x, y: pub.y };
  return { keyId: await keyIdOf(publicKey), label: name, publicKey, sealedPrivate: await encryptJson(priv, passphrase, 'shellback-signing-key'), created: todayIso() };
}

/** Sign a card (any JSON object with an `id`) with a stored key. Throws on a wrong passphrase. */
export async function signCard(card: unknown, key: SigningKey, passphrase: string): Promise<CardSignature> {
  const id = card && typeof card === 'object' ? (card as { id?: unknown }).id : undefined;
  if (typeof id !== 'string') throw new Error('This file is not a Shellback peer card (no id).');
  if (!isEncryptedEnvelope(key.sealedPrivate)) throw new Error('The stored signing key is damaged.');
  const jwk = await decryptJson(key.sealedPrivate, passphrase) as JsonWebKey;
  const priv = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const digest = await cardDigest(card);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc.encode(digest));
  return { format: SIGNATURE_FORMAT, version: 1, alg: SIGNING_ALG, keyId: key.keyId, publicKey: key.publicKey, signer: key.label, cardId: id, cardDigest: digest, signedAt: todayIso(), signature: toB64(sig) };
}

/** Check a card against a detached signature and the reader's trust list. Never throws on bad input; reports `invalid` with a reason. */
export async function verifyCard(card: unknown, signature: unknown, trust: readonly TrustedKey[]): Promise<VerifyResult> {
  const parsed = signatureSchema.safeParse(signature);
  if (!parsed.success) return { status: 'invalid', keyId: '', signer: '', reason: 'The signature file is not a Shellback card signature.' };
  const s = parsed.data;
  const base = { keyId: s.keyId, signer: s.signer };
  const bad = (reason: string): VerifyResult => ({ status: 'invalid', ...base, reason });
  try {
    const id = card && typeof card === 'object' ? (card as { id?: unknown }).id : undefined;
    if (id !== s.cardId) return bad('This signature was made for a different card.');
    if ((await keyIdOf(s.publicKey)) !== s.keyId) return bad('The key id does not match the public key in the signature.');
    if ((await cardDigest(card)) !== s.cardDigest) return bad('The card has changed since it was signed.');
    const pub = await crypto.subtle.importKey('jwk', s.publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, fromB64(s.signature), enc.encode(s.cardDigest));
    if (!ok) return bad('The signature does not match the card.');
  } catch { return bad('The signature could not be checked.'); }
  const known = trust.find((t) => t.keyId === s.keyId);
  return known ? { status: 'trusted', ...base, label: known.label } : { status: 'untrusted-key', ...base };
}

// ----------------------------------------------------------------------------- trust list
export const trustedKeySchema = z.object({ keyId: z.string().regex(/^[0-9a-f]{16}$/), label: z.string().trim().min(1).max(70), publicKey: publicKeySchema, added: z.string().max(10) });

/** Tolerant read of a stored trust list: bad entries are dropped, duplicates collapse to the first. */
export function parseTrustList(raw: unknown): TrustedKey[] {
  if (!Array.isArray(raw)) return [];
  const out: TrustedKey[] = [];
  for (const item of raw.slice(0, 500)) {
    const r = trustedKeySchema.safeParse(item);
    if (r.success && !out.some((t) => t.keyId === r.data.keyId)) out.push(r.data);
  }
  return out;
}

/** Add (or relabel) a key. The key id is re-derived from the public key, never taken on trust. */
export async function addTrusted(list: readonly TrustedKey[], publicKey: PublicKeyJwk, label: string): Promise<TrustedKey[]> {
  const name = label.trim().slice(0, 70);
  if (!name) throw new Error('Give this key a label you will recognise.');
  const pk = publicKeySchema.parse(publicKey);
  const keyId = await keyIdOf(pk);
  const entry: TrustedKey = { keyId, label: name, publicKey: pk, added: todayIso() };
  return [...list.filter((t) => t.keyId !== keyId), entry];
}
export const removeTrusted = (list: readonly TrustedKey[], keyId: string): TrustedKey[] => list.filter((t) => t.keyId !== keyId);
