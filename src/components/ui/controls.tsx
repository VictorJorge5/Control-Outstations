import { useEffect, useRef, type ReactNode } from 'react';
import { Checkbox as RCheckbox, Switch as RSwitch, Tabs as RTabs, Tooltip as RTooltip } from 'radix-ui';
import { animate, motion, useInView, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { easeOut, spring } from '@/lib/motion';

// ---- Interruptor ----
export function Switch({ checked, onCheckedChange, label, id, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; label?: ReactNode; id?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-700 select-none', disabled && 'cursor-not-allowed opacity-50')}>
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="relative h-5 w-9 shrink-0 rounded-full bg-ink-200 transition-colors duration-200 data-[state=checked]:bg-brand-600"
      >
        <RSwitch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=checked]:translate-x-[18px]" />
      </RSwitch.Root>
      {label}
    </label>
  );
}

// ---- Casilla ----
export function Checkbox({ checked, onCheckedChange, label, disabled, className, id }: { checked: boolean; onCheckedChange?: (v: boolean) => void; label?: ReactNode; disabled?: boolean; className?: string; id?: string }) {
  return (
    <label className={cn('group flex cursor-pointer items-start gap-3 text-sm text-ink-700 select-none', disabled && 'cursor-default', className)}>
      <RCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={v => onCheckedChange?.(v === true)}
        disabled={disabled}
        className={cn(
          'mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-white ring-1 ring-inset ring-ink-300 transition-colors duration-150',
          'group-hover:ring-ink-400 data-[state=checked]:bg-brand-600 data-[state=checked]:ring-brand-600 disabled:opacity-60',
        )}
      >
        <RCheckbox.Indicator forceMount>
          <motion.span initial={false} animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }} transition={spring} className="block">
            <Check className="size-3.5 text-white" strokeWidth={3} />
          </motion.span>
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      {label && <span className={cn('leading-snug', checked && 'text-ink-900')}>{label}</span>}
    </label>
  );
}

// ---- Pestañas con subrayado animado ----
export function Tabs({ value, onValueChange, items, layoutId, className, children }: {
  value: string;
  onValueChange: (v: string) => void;
  items: { value: string; label: ReactNode; count?: number }[];
  layoutId: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange}>
      <RTabs.List className={cn('scroll-thin flex gap-1 overflow-x-auto border-b border-ink-100', className)}>
        {items.map(it => (
          <RTabs.Trigger
            key={it.value}
            value={it.value}
            className="relative flex shrink-0 items-center gap-1.5 px-3 pb-3 pt-1 text-[13.5px] font-medium text-ink-500 transition-colors hover:text-ink-800 data-[state=active]:text-ink-900"
          >
            {it.label}
            {it.count !== undefined && <span className="rounded-full bg-ink-100 px-1.5 text-[11px] font-semibold tabular-nums text-ink-500">{it.count}</span>}
            {value === it.value && (
              <motion.span layoutId={layoutId} transition={spring} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />
            )}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  );
}

// ---- Control segmentado (filtros) ----
export function Segmented<T extends string>({ value, onChange, options, layoutId, className }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  layoutId: string;
  className?: string;
}) {
  return (
    <div className={cn('flex rounded-xl bg-ink-100 p-1', className)} role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('relative flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors', value === o.value ? 'text-ink-900' : 'text-ink-500 hover:text-ink-700')}
        >
          {value === o.value && <motion.span layoutId={layoutId} transition={spring} className="absolute inset-0 rounded-lg bg-white shadow-card" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Tooltip ----
export function Tip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} className="z-[70] rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lift data-[state=delayed-open]:animate-[marker-in_0.15s_ease-out]">
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}
export const TooltipProvider = RTooltip.Provider;

// ---- Numero que cuenta hasta su valor ----
export function AnimatedNumber({ value, className, format = (n: number) => n.toLocaleString('es-ES') }: { value: number | null | undefined; className?: string; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const from = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || value === null || value === undefined) return;
    if (reduce || !inView) { el.textContent = format(value); from.current = value; return; }
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: easeOut,
      onUpdate: v => { el.textContent = format(Math.round(v)); },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, format]);

  return <span ref={ref} className={cn('tabular-nums', className)}>{value === null || value === undefined ? '—' : format(0)}</span>;
}

// ---- Barra de progreso ----
export function Progress({ value, className, tone = 'brand' }: { value: number; className?: string; tone?: 'brand' | 'success' }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-ink-100', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn('h-full rounded-full', tone === 'success' ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-500 to-brand-600')}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.7, ease: easeOut }}
      />
    </div>
  );
}
