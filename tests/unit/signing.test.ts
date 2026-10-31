import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addTrusted, canonicalJson, cardDigest, createSigningKey, formatKeyId, isCardSignature, keyIdOf, parseTrustList, removeTrusted, signCard, verifyCard } from '../../src/core/signing';
import { parsePeerCard } from '../../src/core/schema';

const card = JSON.parse(readFileSync(new URL('../../examples/employees/casey-rivera-peer-card.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const PASS = 'correct horse battery';

test('canonical JSON is key-order independent', async () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: 1, c: 2 }] }), canonicalJson({ a: [{ c: 2, d: 1 }], b: 1 }));
  assert.equal(await cardDigest({ a: 1, b: 2 }), await cardDigest({ b: 2, a: 1 }));
  assert.notEqual(await cardDigest({ a: 1 }), await cardDigest({ a: 2 }));
});

test('sign and verify: untrusted until the reader adds the key, then trusted', async () => {
  const key = await createSigningKey('Casey (example)', PASS);
  assert.match(key.keyId, /^[0-9a-f]{16}$/);
  assert.equal(key.keyId, await keyIdOf(key.publicKey));
  assert.match(formatKeyId(key.keyId), /^(?:[0-9a-f]{4} ){3}[0-9a-f]{4}$/);
  assert.ok(!JSON.stringify(key).includes('"d"'), 'the private scalar is never stored in the clear');
  const sig = await signCard(card, key, PASS);
  assert.ok(isCardSignature(sig));
  assert.equal(sig.cardId, card.id);
  assert.equal((await verifyCard(card, sig, [])).status, 'untrusted-key');
  const trust = await addTrusted([], sig.publicKey, 'Casey, confirmed in person');
  const ok = await verifyCard(card, sig, trust);
  assert.equal(ok.status, 'trusted');
  assert.equal(ok.label, 'Casey, confirmed in person');
  parsePeerCard(card); // the card itself is still an ordinary peer card
});

test('verification survives a JSON round trip and key reordering of the card file', async () => {
  const key = await createSigningKey('Casey', PASS);
  const sig = await signCard(card, key, PASS);
  const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(card).reverse())));
  const wire = JSON.parse(JSON.stringify(sig));
  assert.equal((await verifyCard(reordered, wire, [])).status, 'untrusted-key');
});

test('tampering is detected: changed card, swapped signature, forged key id, edited digest', async () => {
  const key = await createSigningKey('Casey', PASS);
  const other = await createSigningKey('Mallory (example)', PASS);
  const sig = await signCard(card, key, PASS);
  const trust = await addTrusted([], key.publicKey, 'Casey');

  const edited = { ...card, skills: [...(card.skills as string[]), 'threat-modeling'] };
  const r1 = await verifyCard(edited, sig, trust);
  assert.equal(r1.status, 'invalid');
  assert.match(r1.reason ?? '', /changed since it was signed/);

  assert.equal((await verifyCard({ ...card, id: 'someone-else-0001' }, sig, trust)).status, 'invalid', 'a signature does not move to another card');

  // Attacker re-signs with their own key but claims the trusted key id.
  const forged = { ...(await signCard(card, other, PASS)), keyId: key.keyId };
  const r2 = await verifyCard(card, forged, trust);
  assert.equal(r2.status, 'invalid');
  assert.match(r2.reason ?? '', /key id does not match/);

  // Attacker keeps the trusted id and key but supplies a signature made by another key.
  const swapped = { ...sig, signature: (await signCard(card, other, PASS)).signature };
  assert.equal((await verifyCard(card, swapped, trust)).status, 'invalid');

  // Digest edited to match a modified card without a valid signature over it.
  const digest = await cardDigest(edited);
  assert.equal((await verifyCard(edited, { ...sig, cardDigest: digest }, trust)).status, 'invalid');
});

test('malformed signature files report invalid instead of throwing', async () => {
  for (const bad of [null, 'x', {}, { format: 'shellback-card-signature' }, { ...(await signCard(card, await createSigningKey('A', PASS), PASS)), signature: '***' }]) {
    assert.equal((await verifyCard(card, bad, [])).status, 'invalid');
  }
  assert.equal((await verifyCard(null, await signCard(card, await createSigningKey('A', PASS), PASS), [])).status, 'invalid');
});

test('wrong passphrase cannot sign; keys need a label; cards need an id', async () => {
  const key = await createSigningKey('Casey', PASS);
  await assert.rejects(() => signCard(card, key, 'not the passphrase'), /wrong passphrase|Could not decrypt/);
  await assert.rejects(() => createSigningKey('  ', PASS), /label/);
  await assert.rejects(() => createSigningKey('Casey', 'short'), /passphrase/);
  await assert.rejects(() => signCard({ name: 'no id' }, key, PASS), /no id/);
});

test('trust list: add, relabel, remove, tolerant parse', async () => {
  const a = await createSigningKey('A', PASS);
  const b = await createSigningKey('B', PASS);
  let list = await addTrusted([], a.publicKey, 'Alpha');
  list = await addTrusted(list, b.publicKey, 'Bravo');
  list = await addTrusted(list, a.publicKey, 'Alpha (renamed)');
  assert.deepEqual(list.map((t) => t.label).sort(), ['Alpha (renamed)', 'Bravo']);
  await assert.rejects(() => addTrusted(list, a.publicKey, ' '), /label/);
  assert.equal(removeTrusted(list, a.keyId).length, 1);
  const parsed = parseTrustList([...list, { keyId: 'zz' }, 'junk', list[0]]);
  assert.equal(parsed.length, 2, 'bad and duplicate entries are dropped');
  assert.deepEqual(parseTrustList('nope'), []);
});
