import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Clock, Copy, Mail, Phone, Star } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { fadeUp } from '@/lib/motion';
import type { AltProvider, Contact } from '@/lib/types';
import { fleetGroups, type FleetCol } from '@/domain/fleet';
import { Badge, Card } from '@/components/ui/primitives';
import { Tip } from '@/components/ui/controls';

// ---- Tabla de cobertura de flota ----
export function FleetTable({ cols, fleet }: { cols: FleetCol[]; fleet: Record<string, boolean> }) {
  const groups = fleetGroups(cols);
  return (
    <div className="scroll-thin overflow-x-auto rounded-xl ring-1 ring-ink-150">
      <table className="w-full min-w-[440px] border-collapse text-center text-xs">
        <thead>
          <tr className="bg-ink-900 text-white">
            {groups.map((g, i) => <th key={i} colSpan={g.span} className="border-l border-white/10 px-2 py-1.5 font-semibold first:border-l-0">{g.grp}</th>)}
          </tr>
          <tr className="bg-ink-800 text-white/80">
            {cols.map(c => <th key={c.key} className="border-l border-white/10 px-2 py-1.5 text-[11px] font-medium first:border-l-0">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cols.map((c, i) => (
              <td key={c.key} className={cn('border-l border-ink-100 py-2.5 first:border-l-0', fleet?.[c.key] ? 'bg-emerald-50/70' : 'bg-white')}>
                {fleet?.[c.key]
                  ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15 + i * 0.04, type: 'spring', stiffness: 500, damping: 22 }} className="inline-grid size-5 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-3" strokeWidth={3} /><span className="sr-only">Sí</span></motion.span>
                  : <span className="text-ink-300">—</span>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---- Copiar al portapapeles ----
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tip content={done ? 'Copiado' : `Copiar ${label}`}>
      <button
        onClick={e => {
          e.preventDefault(); e.stopPropagation();
          navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); }, () => toast.error('No se ha podido copiar'));
        }}
        className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-ink-100 hover:text-ink-800 focus-visible:opacity-100"
        aria-label={`Copiar ${label}`}
      >
        {done ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      </button>
    </Tip>
  );
}

// ---- Tarjeta de contacto (telefono o correo) ----
export function ContactCard({ contact }: { contact: Contact }) {
  const isEmail = contact.number.includes('@');
  const href = isEmail ? `mailto:${contact.number}` : `tel:${contact.number.replace(/[^\d+]/g, '')}`;
  return (
    <motion.a
      variants={fadeUp}
      href={href}
      className={cn('group flex items-center gap-3 rounded-xl p-3 ring-1 ring-inset transition-all hover:shadow-card', contact.main ? 'bg-brand-50/50 ring-brand-200/70 hover:bg-brand-50' : 'bg-white ring-ink-150 hover:ring-ink-200')}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', contact.main ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500')}>
        {isEmail ? <Mail className="size-4" /> : <Phone className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-mono text-[13px] font-medium text-ink-900">{contact.number}</span>
          {contact.main && <Badge tone="brand"><Star className="size-2.5 fill-current" /> Principal</Badge>}
        </span>
        <span className="block truncate text-xs text-ink-500">{contact.description}</span>
      </span>
      <CopyButton value={contact.number} label={isEmail ? 'correo' : 'teléfono'} />
    </motion.a>
  );
}

// ---- Tarjeta de proveedor alternativo / no contratado ----
export function ProviderCard({ provider: p, cols }: { provider: AltProvider; cols: FleetCol[] }) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[15px] font-semibold text-ink-900">{p.supplier}</div>
          {p.easa && <Badge>EASA {p.easa}</Badge>}
        </div>
        <div className="mt-3"><FleetTable cols={cols} fleet={p.fleet} /></div>
        {(p.email || p.phone || p.hours) && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-600">
            {p.email && <a href={`mailto:${p.email}`} className="group flex items-center gap-1.5 hover:text-ink-900"><Mail className="size-3.5 text-ink-400" /> {p.email}</a>}
            {p.phone && <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 hover:text-ink-900"><Phone className="size-3.5 text-ink-400" /> {p.phone}</a>}
            {p.hours && <span className="flex items-center gap-1.5"><Clock className="size-3.5 text-ink-400" /> {p.hours}</span>}
          </div>
        )}
        {p.comments && <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-[13px] leading-relaxed text-ink-600">{p.comments}</p>}
      </Card>
    </motion.div>
  );
}
