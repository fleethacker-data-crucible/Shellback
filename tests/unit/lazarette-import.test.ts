import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lazaretteSynapseImport } from '../../src/core/lazarette-import';

test('Synapse credentials for Lazarette keep name, issuer, and a real expiry only', () => {
  const file = lazaretteSynapseImport([
    { name: '  Security+ ', authority: ' CompTIA ', expiry: '2027-04-01' },
    { name: '   ', authority: 'Nobody', expiry: '2027-01-01' },
    { name: 'PMP', authority: 'PMI', expiry: 'next year' },
  ]);
  assert.deepEqual(file, {
    credentials: [
      { name: 'Security+', authority: 'CompTIA', expiry: '2027-04-01' },
      { name: 'PMP', authority: 'PMI', expiry: '' },
    ],
  });
  assert.deepEqual(Object.keys(file.credentials[0]!), ['name', 'authority', 'expiry']);
});

test('the Lazarette import stops at 150 credentials', () => {
  const rows = Array.from({ length: 180 }, (_, i) => ({ name: `Cred ${i}`, authority: 'Body', expiry: '2028-01-01' }));
  assert.equal(lazaretteSynapseImport(rows).credentials.length, 150);
  assert.equal(lazaretteSynapseImport(rows).credentials[149]!.name, 'Cred 149');
});
