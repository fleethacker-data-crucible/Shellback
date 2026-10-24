/** Browser file helpers: download JSON, pick a local file, read text. No network. */

export function downloadJson(obj: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

export function readFileText(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) return Promise.reject(new Error(`File exceeds the ${Math.round(maxBytes / 1024)} KB limit.`));
  return file.text();
}

export async function readJsonFile(file: File, maxBytes: number): Promise<unknown> {
  const text = await readFileText(file, maxBytes);
  try { return JSON.parse(text); } catch { throw new Error('The file is not valid JSON.'); }
}
