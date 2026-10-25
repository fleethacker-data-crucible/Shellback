import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { extractDocumentText, docKind } from '../../src/app/lib/document-text';

const root = process.env.SHELLBACK_ROOT ?? process.env.SYNAPSE_ROOT ?? process.cwd();

test('sample PDF résumés extract their text layer (ASCII85 + Flate chain)', async () => {
  const dir = path.join(root, 'examples/resumes');
  const files = readdirSync(dir).filter((f) => f.endsWith('.pdf'));
  assert.equal(files.length, 5);
  for (const f of files) {
    const r = await extractDocumentText(new File([readFileSync(path.join(dir, f))], f, { type: 'application/pdf' }));
    assert.equal(r.kind, 'pdf');
    assert.ok(r.text.length > 1000, `${f}: ${r.text.length} chars`);
    assert.match(r.text, /Summary[\s\S]*Experience[\s\S]*Skills[\s\S]*Certifications/);
    assert.equal(r.note, undefined);
  }
});

test('document kind detection and limits', async () => {
  assert.equal(docKind('a.PDF'), 'pdf'); assert.equal(docKind('a.docx'), 'docx'); assert.equal(docKind('a.md'), 'txt'); assert.equal(docKind('a.exe'), null);
  await assert.rejects(extractDocumentText(new File([new Uint8Array(9 * 1024 * 1024)], 'big.pdf')), /8 MB/);
  const scan = await extractDocumentText(new File(['%PDF-1.4\n1 0 obj << /Subtype /Image >> stream\nxxxx\nendstream\n%%EOF'], 'scan.pdf'));
  assert.match(scan.note ?? '', /little or no text layer/);
});
