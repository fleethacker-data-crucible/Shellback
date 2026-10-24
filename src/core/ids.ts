/** Collision-resistant local identifiers (no PII, no timestamps leaked to peers). */
export function randomHex(bytes = 10): string {
  const arr = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(arr);
  else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}
export const newId = (prefix: string): string => `${prefix}-${randomHex(8)}`;
export const newShareId = (): string => `sp-${randomHex(10)}`;
