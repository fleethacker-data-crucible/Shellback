/**
 * shadcn-style primitives: class-variance-authority variants merged with tailwind-merge.
 * No Radix here (not available in the offline build); interactive patterns use native
 * elements (<button>, <dialog>, <input type=checkbox>) with explicit ARIA.
 */
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ReactNode, CSSProperties, ChangeEvent } from 'react';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// ---------------------------------------------------------------------------- Button
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-mint text-[#062219] hover:bg-[#7bf5d6] shadow-glow',
        secondary: 'border border-stroke bg-panel2 text-text hover:border-mint/50 hover:bg-[#1a2d47]',
        danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
        ghost: 'text-muted hover:text-text hover:bg-white/5',
        text: 'text-mint underline-offset-4 hover:underline px-0',
      },
      size: { sm: 'h-7 px-2.5 text-[12px]', md: 'h-9 px-3.5 text-[13px]', lg: 'h-11 px-5 text-[14px]', icon: 'h-8 w-8 p-0 text-[13px]' },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'secondary', size: 'md', full: false },
  },
);

export interface ButtonProps extends VariantProps<typeof buttonVariants> {
  children?: ReactNode;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  id?: string;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  'data-testid'?: string;
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
}
export function Button({ variant, size, full, className, type = 'button', children, ...rest }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size, full }), className)} {...rest}>{children}</button>;
}

// ---------------------------------------------------------------------------- Panel
export function Panel({ children, className, id, as: Tag = 'section', 'aria-label': ariaLabel }: { children?: ReactNode; className?: string; id?: string; as?: 'section' | 'article' | 'div'; 'aria-label'?: string }) {
  return <Tag id={id} aria-label={ariaLabel} className={cn('min-w-0 rounded-lg border border-stroke bg-panel p-5 shadow-panel', className)}>{children}</Tag>;
}

export function PanelHeading({ eyebrow, title, children, action }: { eyebrow?: string; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 max-w-[62ch]">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h3 className="text-[17px]">{title}</h3>
        {children && <p className="mt-1 text-[13px] text-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionIntro({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 max-w-[78ch]">
      <div className="eyebrow mb-2">{eyebrow}</div>
      <h2 className="text-[26px] leading-[1.15] md:text-[30px]">{title}</h2>
      {children && <p className="mt-2 text-[14px] text-muted">{children}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------- Form controls
export function Field({ label, htmlFor, hint, children }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label className="field-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="note mt-1">{hint}</p>}
    </div>
  );
}

interface InputProps {
  id?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: 'text' | 'date' | 'number' | 'search';
  maxLength?: number; min?: number; max?: number; step?: string | number; disabled?: boolean; className?: string; 'aria-label'?: string; inputMode?: 'numeric' | 'text';
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
}
export function Input({ onChange, className, type = 'text', ...rest }: InputProps) {
  return <input type={type} className={cn('control', className)} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} {...rest} />;
}

export function Textarea({ onChange, className, rows = 3, ...rest }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; maxLength?: number; disabled?: boolean; readOnly?: boolean; className?: string; 'aria-label'?: string }) {
  return <textarea rows={rows} className={cn('control resize-y', className)} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)} {...rest} />;
}

export interface Option { value: string; label: string }
export function Select({ onChange, options, className, placeholder, ...rest }: { id?: string; value: string; onChange: (v: string) => void; options: readonly Option[]; placeholder?: string; disabled?: boolean; className?: string; 'aria-label'?: string }) {
  return (
    <select className={cn('control', className)} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Checkbox({ id, checked, onChange, children, className }: { id?: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2 text-[13px] text-muted', className)}>
      <input id={id} type="checkbox" className="mt-[3px] h-4 w-4 accent-mint" checked={checked} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Switch({ id, checked, onChange, label, onText = 'On', offText = 'Off' }: { id?: string; checked: boolean; onChange: (v: boolean) => void; label: string; onText?: string; offText?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 select-none" data-testid="switch">
      <input id={id} type="checkbox" className="peer sr-only" role="switch" aria-checked={checked} aria-label={label} checked={checked} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)} />
      <span className="relative h-6 w-11 rounded-full border border-stroke bg-bg transition-colors peer-checked:border-mint/60 peer-checked:bg-mint/30 peer-focus-visible:outline-2 peer-focus-visible:outline-[#a0eeea]">
        <span className={cn('absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-muted transition-transform', checked && 'translate-x-5 bg-mint')} />
      </span>
      <b className="text-[13px]">{checked ? onText : offText}</b>
    </label>
  );
}

// ---------------------------------------------------------------------------- Display
export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'mint' | 'amber' | 'danger'; className?: string }) {
  const tones = { neutral: '', mint: 'border-mint/40 text-mint bg-mint/10', amber: 'border-amber/50 text-amber bg-amber/10', danger: 'border-danger/40 text-danger bg-danger/10' };
  return <span className={cn('tiny-pill', tones[tone], className)}>{children}</span>;
}

export function Notice({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'warn' | 'danger'; className?: string }) {
  const tones = { info: 'border-blue/30 bg-blue/10 text-[#d7e6ff]', warn: 'border-amber/40 bg-amber/10 text-[#ffe7c7]', danger: 'border-danger/40 bg-danger/10 text-[#ffd9de]' };
  return <div role="note" className={cn('rounded-md border px-4 py-3 text-[13px] leading-relaxed', tones[tone], className)}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-stroke px-4 py-5 text-center text-[13px] text-quiet">{children}</div>;
}

export function Stat({ label, value, hint, id }: { label: string; value: ReactNode; hint?: ReactNode; id?: string }) {
  return (
    <article className="rounded-md border border-stroke bg-panel2/60 px-4 py-3">
      <span className="eyebrow block">{label}</span>
      <strong id={id} className="mt-1 block text-[26px] leading-none">{value}</strong>
      {hint && <small className="mt-1 block text-[11px] text-quiet">{hint}</small>}
    </article>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label, className }: { value: T; onChange: (v: T) => void; items: ReadonlyArray<{ id: T; label: string; testId?: string }>; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {items.map((it) => (
        <Button key={it.id} size="sm" variant={value === it.id ? 'primary' : 'secondary'} aria-pressed={value === it.id} onClick={() => onChange(it.id)} data-tab={it.id} data-testid={it.testId}>
          {it.label}
        </Button>
      ))}
    </div>
  );
}

export function BarRow({ label, value, max, caption }: { label: ReactNode; value: number; max: number; caption?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1 text-[12px]">
      <span className="w-[42%] truncate text-muted">{label}</span>
      <div className="bar-track"><i style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` } as CSSProperties} /></div>
      <small className="w-16 text-right text-quiet">{caption ?? `${value} / ${max}`}</small>
    </div>
  );
}
