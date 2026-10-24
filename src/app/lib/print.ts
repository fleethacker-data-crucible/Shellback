/**
 * Print one element only. The element must carry data-print-sheet. While printing, the sheet is moved to
 * <body> and the app root is hidden, so no blank trailing pages come from the hidden layout.
 */
export function printSheet(id: string): void {
  const el = document.getElementById(id);
  const root = document.getElementById('root');
  if (!el || !root) return;
  const placeholder = document.createComment('print-sheet');
  el.parentNode?.insertBefore(placeholder, el);
  document.body.appendChild(el);
  document.body.classList.add('print-sheet-mode');
  el.setAttribute('data-print-active', 'true');
  root.setAttribute('data-print-hidden', 'true');
  let restored = false;
  const done = () => {
    if (restored) return;
    restored = true;
    document.body.classList.remove('print-sheet-mode');
    el.removeAttribute('data-print-active');
    root.removeAttribute('data-print-hidden');
    placeholder.parentNode?.insertBefore(el, placeholder);
    placeholder.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  try { window.print(); } finally { setTimeout(done, 1500); }
}
