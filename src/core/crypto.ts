/**
 * Optional passphrase protection for exported files (Web Crypto, AES-256-GCM,
 * PBKDF2-SHA-256). Protects a backup or peer card *at rest* while it travels on an
 * approved medium. It is not a substitute for server-side access control.
 */
export interface EncryptedEnvelope {
  /** Former-name format id, kept for compatibility with existing encrypted exports. */
  format: 'synapse-encrypted';
  version: 1;
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  /** Hint for the importer about what is inside — never trusted before decryption. */
  payload: string;
}

export const PBKDF2_ITERATIONS = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isEncryptedEnvelope(v: unknown): v is EncryptedEnvelope {
  return !!v && typeof v === 'object' && (v as EncryptedEnvelope).format === 'synapse-encrypted' && (v as EncryptedEnvelope).version === 1;
}

export async function encryptJson(payload: unknown, passphrase: string, payloadFormat: string): Promise<EncryptedEnvelope> {
  if (passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = enc.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource);
  return { format: 'synapse-encrypted', version: 1, kdf: 'PBKDF2-SHA-256', iterations: PBKDF2_ITERATIONS, salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(ciphertext), payload: payloadFormat };
}

export async function decryptJson(envelope: EncryptedEnvelope, passphrase: string): Promise<unknown> {
  if (envelope.kdf !== 'PBKDF2-SHA-256' || !Number.isInteger(envelope.iterations) || envelope.iterations < 100_000 || envelope.iterations > 5_000_000) {
    throw new Error('Unsupported encryption parameters.');
  }
  const key = await deriveKey(passphrase, fromB64(envelope.salt), envelope.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) as BufferSource }, key, fromB64(envelope.ciphertext) as BufferSource);
  } catch {
    throw new Error('Could not decrypt: wrong passphrase or the file was altered.');
  }
  return JSON.parse(dec.decode(plain));
}
