/**
 * Extract plain text from .txt, .docx and .pdf files entirely in the browser.
 *   .docx — a zip; we read word/document.xml and keep paragraph breaks.
 *   .pdf  — text layer only (Tj / TJ operators in FlateDecode or uncompressed content streams).
 *           Scanned PDFs have no text layer; we say so instead of guessing.
 * No library, no network. Everything is best effort and capped so a hostile file cannot stall the UI.
 */
export const MAX_DOC_BYTES = 8 * 1024 * 1024;
export const MAX_TEXT_CHARS = 100_000;

export type DocKind = 'txt' | 'docx' | 'pdf';
export function docKind(name: string, type = ''): DocKind | null {
  if (/\.docx$/i.test(name) || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (/\.pdf$/i.test(name) || type === 'application/pdf') return 'pdf';
  if (/\.(txt|md|text)$/i.test(name) || type.startsWith('text/')) return 'txt';
  return null;
}

export async function extractDocumentText(file: File): Promise<{ text: string; kind: DocKind; note?: string }> {
  if (file.size > MAX_DOC_BYTES) throw new Error('File is larger than 8 MB.');
  const kind = docKind(file.name, file.type);
  if (!kind) throw new Error('Choose a .txt, .docx or .pdf file.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind === 'txt') return { text: new TextDecoder().decode(bytes).slice(0, MAX_TEXT_CHARS), kind };
  if (kind === 'docx') return { text: (await docxText(bytes)).slice(0, MAX_TEXT_CHARS), kind };
  const text = (await pdfText(bytes)).slice(0, MAX_TEXT_CHARS);
  return { text, kind, note: text.trim().length < 40 ? 'This PDF has little or no text layer (it may be a scan). Paste the text instead.' : undefined };
}

// ----------------------------------------------------------------------------- inflate
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress files; paste the text instead.');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ----------------------------------------------------------------------------- docx (zip)
const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

async function zipEntry(bytes: Uint8Array, wanted: string): Promise<Uint8Array | null> {
  // Find end-of-central-directory, then walk the central directory.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 70_000); i--) if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a valid .docx (zip) file.');
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const dec = new TextDecoder();
  for (let n = 0; n < count && p + 46 <= bytes.length; n++) {
    if (u32(bytes, p) !== 0x02014b50) break;
    const method = u16(bytes, p + 10), csize = u32(bytes, p + 20), nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commentLen = u16(bytes, p + 32), local = u32(bytes, p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const lnameLen = u16(bytes, local + 26), lextraLen = u16(bytes, local + 28);
      const start = local + 30 + lnameLen + lextraLen;
      const data = bytes.subarray(start, start + csize);
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data);
      throw new Error('Unsupported compression inside the .docx.');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

async function docxText(bytes: Uint8Array): Promise<string> {
  const xml = await zipEntry(bytes, 'word/document.xml');
  if (!xml) throw new Error('No document body found in the .docx.');
  const s = new TextDecoder().decode(xml);
  const out: string[] = [];
  // Paragraphs → newline, tabs/breaks → space, keep text runs. A regex pass is enough for résumés.
  for (const para of s.split(/<\/w:p>/)) {
    const runs = [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)].map((m) => (m[1] !== undefined ? decodeXml(m[1]) : ' '));
    const line = runs.join('').trim();
    if (line) out.push(line);
  }
  return out.join('\n');
}
const decodeXml = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&');

// ----------------------------------------------------------------------------- pdf (text layer)
async function pdfText(bytes: Uint8Array): Promise<string> {
  const latin = new TextDecoder('latin1').decode(bytes);
  const parts: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  let streams = 0;
  while ((m = re.exec(latin)) && streams < 2000) {
    const start = m.index + m[0].length;
    const end = latin.indexOf('endstream', start);
    if (end < 0) break;
    streams++;
    const dictStart = latin.lastIndexOf('<<', m.index);
    const dict = dictStart >= 0 ? latin.slice(dictStart, m.index) : '';
    if (/\/Subtype\s*\/Image/.test(dict) || /\/FontFile/.test(dict)) { re.lastIndex = end; continue; }
    let raw: Uint8Array = bytes.subarray(start, end);
    // Filters apply in order; we support ASCII85 (ReportLab, some print drivers) and Flate, alone or chained.
    const filters = [...dict.matchAll(/\/(ASCII85Decode|FlateDecode|ASCIIHexDecode|LZWDecode|DCTDecode|RunLengthDecode|CCITTFaxDecode|JBIG2Decode|JPXDecode)/g)].map((m) => m[1]!);
    let unsupported = false;
    for (const f of filters) {
      if (f === 'ASCII85Decode') raw = ascii85(raw);
      else if (f === 'FlateDecode') { try { raw = await inflateZlib(raw); } catch { unsupported = true; break; } }
      else { unsupported = true; break; }
    }
    if (unsupported) { re.lastIndex = end; continue; }
    const content = new TextDecoder('latin1').decode(raw);
    if (/\b(?:Tj|TJ)\b/.test(content)) parts.push(contentText(content));
    re.lastIndex = end;
  }
  return parts.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function ascii85(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let tuple = 0, count = 0;
  let i = 0;
  if (data[0] === 0x3c && data[1] === 0x7e) i = 2; // optional <~
  for (; i < data.length; i++) {
    const c = data[i]!;
    if (c === 0x7e) break; // ~>
    if (c === 0x7a && count === 0) { out.push(0, 0, 0, 0); continue; } // z
    if (c < 0x21 || c > 0x75) continue; // whitespace
    tuple = tuple * 85 + (c - 33);
    if (++count === 5) { out.push((tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255); tuple = 0; count = 0; }
  }
  if (count > 0) { for (let k = count; k < 5; k++) tuple = tuple * 85 + 84; const b = [(tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255]; out.push(...b.slice(0, count - 1)); }
  return new Uint8Array(out);
}

/** Pull strings out of Tj / TJ / ' / " operators; approximate spaces and line breaks from positioning. */
function contentText(c: string): string {
  const out: string[] = [];
  const tok = /\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]+>|\[|\]|-?\d*\.?\d+|[A-Za-z'"*]+/g;
  let inArray = false, line = '';
  const flush = () => { if (line.trim()) out.push(line.trim()); line = ''; };
  const stack: string[] = [];
  let t: RegExpExecArray | null;
  while ((t = tok.exec(c))) {
    const s = t[0];
    if (s === '[') { inArray = true; continue; }
    if (s === ']') { inArray = false; continue; }
    if (s.startsWith('(')) { stack.push(pdfString(s.slice(1, -1))); continue; }
    if (s.startsWith('<')) { stack.push(hexString(s.slice(1, -1))); continue; }
    if (/^-?\d*\.?\d+$/.test(s)) { if (inArray && Number(s) < -180) stack.push(' '); else if (!inArray) stack.push(s); continue; }
    switch (s) {
      case 'Tj': case "'": case '"': line += stack.filter((x) => !/^-?\d*\.?\d+$/.test(x)).join(''); if (s !== 'Tj') flush(); stack.length = 0; break;
      case 'TJ': line += stack.filter((x) => !/^-?\d*\.?\d+$/.test(x)).join(''); stack.length = 0; break;
      case 'T*': case 'Td': case 'TD': case 'Tm': case 'ET': { const dy = s === 'Td' || s === 'TD' ? Number(stack[stack.length - 1] ?? 0) : s === 'Tm' ? NaN : -1; if (s === 'ET' || s === 'T*' || Number.isNaN(dy) || Math.abs(dy) > 0.5) flush(); else if (!line.endsWith(' ')) line += ' '; stack.length = 0; break; }
      default: stack.length = 0;
    }
  }
  flush();
  return out.join('\n');
}
function pdfString(s: string): string {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, e: string) => ({ n: '\n', r: '', t: ' ', b: '', f: '', '(': '(', ')': ')', '\\': '\\' } as Record<string, string>)[e] ?? String.fromCharCode(parseInt(e, 8)));
}
function hexString(h: string): string {
  const clean = h.replace(/\s+/g, '');
  let out = '';
  // Treat as 1-byte codes when they look like ASCII, otherwise 2-byte (Identity-H) and keep printable ones.
  if (clean.length % 4 === 0 && /^(00[2-7][0-9A-Fa-f])+$/.test(clean)) for (let i = 0; i < clean.length; i += 4) out += String.fromCharCode(parseInt(clean.slice(i + 2, i + 4), 16));
  else for (let i = 0; i + 1 < clean.length; i += 2) { const code = parseInt(clean.slice(i, i + 2), 16); if (code >= 32 && code < 127) out += String.fromCharCode(code); }
  return out;
}
