/**
 * Promise-based confirm / prompt built on the native <dialog> element.
 * Replaces window.confirm so flows are keyboard-accessible, styled, and testable.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Input } from './primitives';

interface ConfirmOptions { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
interface PromptOptions { title?: string; cancelLabel?: string; label?: string; password?: boolean; confirmLabel?: string; placeholder?: string; minLength?: number }

interface DialogApi {
  confirm: (message: ReactNode, opts?: ConfirmOptions) => Promise<boolean>;
  prompt: (message: ReactNode, opts?: PromptOptions) => Promise<string | null>;
}
const DialogContext = createContext<DialogApi>({ confirm: async () => false, prompt: async () => null });
export const useDialogs = () => useContext(DialogContext);

type Pending =
  | { kind: 'confirm'; message: ReactNode; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; message: ReactNode; opts: PromptOptions; resolve: (v: string | null) => void };

export function DialogProvider({ children }: { children: ReactNode }) {
  // FIFO queue: a dialog requested while another is open waits its turn instead of replacing it.
  const [queue, setQueue] = useState<Pending[]>([]);
  const pending = queue[0] ?? null;
  const [value, setValue] = useState('');
  const ref = useRef<HTMLDialogElement | null>(null);

  const api = useMemo<DialogApi>(() => ({
    confirm: (message, opts = {}) => new Promise<boolean>((resolve) => setQueue((q) => [...q, { kind: 'confirm', message, opts, resolve }])),
    prompt: (message, opts = {}) => new Promise<string | null>((resolve) => setQueue((q) => [...q, { kind: 'prompt', message, opts, resolve }])),
  }), []);

  useEffect(() => { setValue(''); }, [pending]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (pending && !el.open) el.showModal();
    if (!pending && el.open) el.close();
  }, [pending]);

  const finish = useCallback((ok: boolean) => {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(ok);
    else pending.resolve(ok ? value : null);
    // Remove exactly this request (never a newer one that arrived meanwhile).
    setQueue((q) => q.filter((x) => x !== pending));
  }, [pending, value]);

  const minLength = pending?.kind === 'prompt' ? pending.opts.minLength ?? 0 : 0;
  const canConfirm = pending?.kind !== 'prompt' || value.length >= minLength;

  return (
    <DialogContext.Provider value={api}>
      {children}
      <dialog
        ref={ref}
        className="m-auto w-[min(92vw,440px)] rounded-lg border border-stroke bg-panel p-0 text-text shadow-panel backdrop:bg-black/70"
        aria-labelledby="dialog-title"
        onCancel={(e: { preventDefault(): void }) => { e.preventDefault(); finish(false); }}
      >
        {pending && (
          <form key={queue.length + String(pending.kind)} method="dialog" className="p-5" onSubmit={(e: { preventDefault(): void }) => { e.preventDefault(); if (canConfirm) finish(true); }}>
            <h3 id="dialog-title" className="text-[16px]">{pending.opts.title ?? (pending.kind === 'confirm' ? 'Please confirm' : 'Input needed')}</h3>
            <div className="mt-2 text-[13px] text-muted">{pending.message}</div>
            {pending.kind === 'prompt' && (
              <div className="mt-3">
                {pending.opts.label && <label className="field-label" htmlFor="dialog-input">{pending.opts.label}</label>}
                <Input id="dialog-input" type={pending.opts.password ? ('password' as 'text') : 'text'} value={value} onChange={setValue} placeholder={pending.opts.placeholder} data-autofocus="true" />
                {minLength > 0 && <p className="note mt-1">At least {minLength} characters.</p>}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => finish(false)} data-dialog="cancel">{pending.opts.cancelLabel ?? 'Cancel'}</Button>
              <Button type="submit" variant={pending.kind === 'confirm' && pending.opts.danger ? 'danger' : 'primary'} disabled={!canConfirm} data-dialog="confirm">
                {pending.opts.confirmLabel ?? (pending.kind === 'confirm' ? 'Confirm' : 'Continue')}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </DialogContext.Provider>
  );
}
