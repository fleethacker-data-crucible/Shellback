/** Print one element only. The element must carry data-print-sheet; everything else is hidden by print CSS. */
export function printSheet(id: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  document.body.classList.add('print-sheet-mode');
  el.setAttribute('data-print-active', 'true');
  const done = () => { document.body.classList.remove('print-sheet-mode'); el.removeAttribute('data-print-active'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  try { window.print(); } finally { setTimeout(done, 1500); }
}
