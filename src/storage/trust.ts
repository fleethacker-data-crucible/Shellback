/**
 * Signing key and trust list for signed peer cards. Both live in localStorage on this computer only.
 * The private half of the signing key is stored sealed with the owner's passphrase (see core/signing.ts);
 * the trust list holds public keys and the labels the reader chose. Neither is part of a workspace
 * export, so a backup never carries a signing key.
 */
import { isEncryptedEnvelope } from '../core/crypto';
import { parseTrustList, publicKeySchema, type SigningKey, type TrustedKey } from '../core/signing';

export const SIGNING_KEY_STORAGE = 'shellback-signing-key-v1';
export const TRUST_LIST_STORAGE = 'shellback-trust-list-v1';

export function loadSigningKey(): SigningKey | null {
  try {
    const v = JSON.parse(localStorage.getItem(SIGNING_KEY_STORAGE) ?? 'null') as Partial<SigningKey> | null;
    if (!v || typeof v.keyId !== 'string' || typeof v.label !== 'string' || !isEncryptedEnvelope(v.sealedPrivate)) return null;
    const pk = publicKeySchema.safeParse(v.publicKey);
    return pk.success ? { keyId: v.keyId, label: v.label, publicKey: pk.data, sealedPrivate: v.sealedPrivate, created: typeof v.created === 'string' ? v.created : '' } : null;
  } catch { return null; }
}
export function saveSigningKey(key: SigningKey | null): void {
  try { if (key) localStorage.setItem(SIGNING_KEY_STORAGE, JSON.stringify(key)); else localStorage.removeItem(SIGNING_KEY_STORAGE); } catch { /* storage blocked: the key lives for this session only */ }
}
export function loadTrustList(): TrustedKey[] {
  try { return parseTrustList(JSON.parse(localStorage.getItem(TRUST_LIST_STORAGE) ?? '[]')); } catch { return []; }
}
export function saveTrustList(list: readonly TrustedKey[]): void {
  try { localStorage.setItem(TRUST_LIST_STORAGE, JSON.stringify(list)); } catch { /* storage blocked */ }
}
