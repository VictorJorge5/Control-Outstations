import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fadeUp, stagger } from '@/lib/motion';

export function Page({ children, className, width = 'default' }: { children: ReactNode; className?: string; width?: 'default' | 'narrow' | 'wide' }) {
  const w = { default: 'max-w-6xl', narrow: 'max-w-4xl', wide: 'max-w-7xl' }[width];
  return <div className={cn('mx-auto w-full px-4 pb-16 pt-7 sm:px-8 sm:pt-9', w, className)}>{children}</div>;
}

export function PageHeader({ title, description, eyebrow, back, actions, children }: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <motion.header variants={stagger(0.06)} initial="hidden" animate="show" className="mb-7">
      {back && (
        <motion.div variants={fadeUp}>
          <Link to={back.to} className="group mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:text-ink-900">
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" /> {back.label}
          </Link>
        </motion.div>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <motion.div variants={fadeUp} className="mb-1.5 text-[12.5px] font-medium text-brand-600">{eyebrow}</motion.div>}
          <motion.h1 variants={fadeUp} className="text-[26px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[28px]">{title}</motion.h1>
          {description && <motion.p variants={fadeUp} className="mt-1.5 max-w-2xl text-[14.5px] leading-relaxed text-ink-500">{description}</motion.p>}
        </div>
        {actions && <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-2">{actions}</motion.div>}
      </div>
      {children && <motion.div variants={fadeUp} className="mt-5">{children}</motion.div>}
    </motion.header>
  );
}

/** Mensaje de error de carga con reintento */
export function LoadError({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl bg-brand-50/60 px-5 py-4 text-sm text-brand-800 ring-1 ring-inset ring-brand-100">
      No se ha podido cargar ({error.message}).
      {onRetry && <button onClick={onRetry} className="ml-2 font-semibold underline underline-offset-2">Reintentar</button>}
    </div>
  );
}
