import { forwardRef, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';

// ---- Tarjeta ----
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl bg-white ring-1 ring-ink-150 shadow-card', className)} {...props} />;
}

// ---- Etiqueta de estado ----
type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'info' | 'violet' | 'dark';
const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200/60',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200/70',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  info: 'bg-sky-50 text-sky-700 ring-sky-200/70',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/70',
  dark: 'bg-ink-900 text-white ring-ink-900',
};
export function Badge({ tone = 'neutral', dot, className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset whitespace-nowrap', tones[tone], className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

// ---- Codigo IATA ----
export function Code({ children, size = 'md', className, ...props }: HTMLAttributes<HTMLSpanElement> & { size?: 'sm' | 'md' | 'lg' | 'xl'; 'data-testid'?: string }) {
  const s = { sm: 'text-[11px] px-1.5 py-0.5 rounded-md', md: 'text-xs px-2 py-1 rounded-lg', lg: 'text-sm px-2.5 py-1 rounded-lg', xl: 'text-2xl px-3 py-1.5 rounded-xl' }[size];
  return <span className={cn('inline-flex items-center justify-center font-mono font-semibold tracking-wide bg-ink-900 text-white tabular-nums', s, className)} {...props}>{children}</span>;
}

// ---- Formularios ----
const field = 'w-full rounded-[10px] bg-white text-sm text-ink-900 ring-1 ring-inset ring-ink-200 placeholder:text-ink-400 shadow-xs transition-shadow outline-none focus:ring-2 focus:ring-brand-500 focus:shadow-ring-brand disabled:bg-ink-50 disabled:text-ink-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(field, 'h-10 px-3.5', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(field, 'min-h-28 px-3.5 py-3 leading-relaxed resize-y', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(field, 'h-10 appearance-none pl-3.5 pr-9 truncate')} {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
    </div>
  );
});

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SearchInput({ className, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
      <Input ref={ref} type="text" autoComplete="off" className="pl-10" {...props} />
    </div>
  );
});

export function Label({ className, ...props }: HTMLAttributes<HTMLLabelElement> & { htmlFor?: string }) {
  return <label className={cn('mb-1.5 block text-[12.5px] font-medium text-ink-600', className)} {...props} />;
}

export function Field({ label, htmlFor, hint, children, className }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

// ---- Teclas ----
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white px-1.5 font-sans text-[11px] font-medium text-ink-500 ring-1 ring-inset ring-ink-200 shadow-xs', className)}>{children}</kbd>;
}

// ---- Esqueleto ----
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

// ---- Estado vacio ----
export function EmptyState({ icon, title, children, action, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-ink-100 text-ink-400 [&_svg]:size-6">{icon}</div>}
      <div className="text-[15px] font-semibold text-ink-800">{title}</div>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-500">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---- Seccion con titulo ----
export function SectionTitle({ children, count, className, action }: { children: ReactNode; count?: number; className?: string; action?: ReactNode }) {
  return (
    <div className={cn('mb-3 flex items-center gap-2', className)}>
      <h3 className="text-[13px] font-semibold tracking-tight text-ink-800">{children}</h3>
      {count !== undefined && <span className="rounded-full bg-ink-100 px-1.5 text-[11px] font-semibold text-ink-500 tabular-nums">{count}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
