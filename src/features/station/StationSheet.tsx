import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Building2, CalendarX, Download, Moon, PlaneTakeoff, UsersRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { easeOut, stagger } from '@/lib/motion';
import { fmtNumber, monthLabel } from '@/lib/format';
import { useAppData, useStationDetails } from '@/lib/queries';
import { useStationNav } from '@/lib/nav';
import type { Station } from '@/lib/types';
import { ALT_FLEET_COLS, FLEET_COLS } from '@/domain/fleet';
import { STATUS_META, stationStatus } from '@/domain/status';
import { flightInfo, flightText } from '@/domain/tracking';
import { Sheet, SheetClose } from '@/components/ui/overlay';
import { Tabs } from '@/components/ui/controls';
import { Badge, Code, EmptyState, SectionTitle, Skeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ContactCard, FleetTable, ProviderCard } from './parts';
import { ScheduleTable } from './ScheduleTable';
import { PernoctaCalendar, PernoctaMatrix } from '@/features/pernocta/PernoctaViews';

type Tab = 'overview' | 'sched' | 'contacts' | 'altprov' | 'pernocta';
const TABS: Tab[] = ['overview', 'sched', 'contacts', 'altprov', 'pernocta'];

export function StationSheet() {
  const { stationCode, close } = useStationNav();
  const { stationByCode } = useAppData();
  const station = stationCode ? stationByCode.get(stationCode) : undefined;
  return (
    <Sheet open={!!station} onOpenChange={o => { if (!o) close(); }} label={station ? `Ficha de ${station.code}` : 'Ficha de estación'}>
      {station && <StationSheetBody key={station.code} station={station} />}
    </Sheet>
  );
}

function StationSheetBody({ station: s }: { station: Station }) {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'overview';
  const setTab = (t: string) => setParams(p => { const n = new URLSearchParams(p); if (t === 'overview') n.delete('tab'); else n.set('tab', t); return n; }, { replace: true });

  const details = useStationDetails(s);
  const [exporting, setExporting] = useState(false);
  const status = stationStatus(s);
  const contacts = (s.easa || []).flatMap(p => p.contacts);
  const alts = s.alt_providers || [];
  const scheduleLen = details.data?.schedule.length ?? s.flights;
  const f = flightInfo(details.data ? { ...s, schedule: details.data.schedule } : s);
  const pernoctaTotal = Object.values(s.pernocta_by_month || {}).reduce((a, b) => a + b, 0);

  async function exportExcel() {
    if (!details.data) return;
    setExporting(true);
    try {
      const { downloadSchedule } = await import('@/domain/excel');
      await downloadSchedule(s.code, details.data.schedule);
      toast.success('Excel generado', { description: `Horario de ${s.code} con calendarios mensuales.` });
    } catch (err) {
      toast.error('No se ha podido generar el Excel', { description: (err as Error).message });
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* cabecera */}
      <div className="relative shrink-0 overflow-hidden border-b border-ink-100 bg-gradient-to-b from-ink-50 to-white px-6 pb-0 pt-6">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-brand-500/[0.07] blur-3xl" />
        <div className="relative flex items-start gap-4">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4, ease: easeOut, delay: 0.1 }}>
            <Code size="xl" data-testid="sheet-code">{s.code}</Code>
          </motion.div>
          <div className="min-w-0 flex-1">
            <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="text-xl font-semibold tracking-tight text-ink-900">{s.city}, {s.country}</motion.h2>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }} className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={status === 'assigned' ? 'success' : status === 'pending' ? 'warning' : 'neutral'} dot>{STATUS_META[status].label}</Badge>
              {s.easa && s.easa.length > 0 && <Badge data-testid="easa-badge">EASA {s.easa.map(p => p.approval_number).join(' / ')}</Badge>}
              {s.pernocta && <Badge tone="violet"><Moon className="size-3" /> Pernocta</Badge>}
            </motion.div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="dark" size="sm" icon={<Download />} onClick={exportExcel} loading={exporting} disabled={!details.data || !details.data.schedule.length} data-testid="download-xlsx">
              <span className="hidden sm:inline">Descargar Excel</span>
            </Button>
            <SheetClose asChild><Button variant="ghost" size="icon-sm" aria-label="Cerrar ficha"><X /></Button></SheetClose>
          </div>
        </div>

        <motion.div variants={stagger(0.05, 0.2)} initial="hidden" animate="show" className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={<PlaneTakeoff />} label="Movimientos IB 26/27" value={fmtNumber(scheduleLen)} />
          <Stat icon={<Building2 />} label="Proveedor" value={s.pending ? 'Sin contratar' : s.providers.join(' · ')} warn={s.pending} />
          <Stat icon={<CalendarX />} label="Primer vuelo" value={f.first ? f.first.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'} hint={f.first ? flightText(f) : undefined} />
          <Stat icon={<Moon />} label="Pernoctas" value={pernoctaTotal ? fmtNumber(pernoctaTotal) : 'No'} />
        </motion.div>

        <Tabs
          className="relative mt-5 border-b-0"
          layoutId="sheet-tab"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'overview', label: 'Resumen' },
            { value: 'sched', label: 'Programación', count: scheduleLen },
            { value: 'contacts', label: 'Contactos', count: contacts.length },
            { value: 'altprov', label: 'Otros proveedores', count: alts.length },
            { value: 'pernocta', label: 'Pernocta' },
          ]}
        />
      </div>

      {/* contenido */}
      <div className={cn('min-h-0 flex-1 px-6 py-5', tab === 'sched' ? 'flex flex-col overflow-hidden' : 'scroll-thin overflow-y-auto')}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOut } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className={cn(tab === 'sched' && 'flex min-h-0 flex-1 flex-col')}
          >
            {tab === 'overview' && <Overview station={s} onTab={setTab} />}
            {tab === 'sched' && (
              details.isPending ? <TableSkeleton />
                : details.error ? <DetailsError message={details.error.message} onRetry={() => details.refetch()} />
                  : <ScheduleTable schedule={details.data!.schedule} />
            )}
            {tab === 'contacts' && <Contacts station={s} />}
            {tab === 'altprov' && (
              alts.length ? (
                <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-3">
                  <p className="text-sm text-ink-500">Proveedores de respaldo para usar si el proveedor contratado no puede dar cobertura en esta estación.</p>
                  {alts.map(p => <ProviderCard key={p.supplier} provider={p} cols={ALT_FLEET_COLS} />)}
                </motion.div>
              ) : <EmptyState icon={<UsersRound />} title="Sin proveedores alternativos">No hay proveedores alternativos registrados para esta estación en el listado de backup.</EmptyState>
            )}
            {tab === 'pernocta' && <PernoctaTab station={s} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

function Stat({ icon, label, value, hint, warn }: { icon: ReactNode; label: string; value: ReactNode; hint?: string; warn?: boolean }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="rounded-xl bg-white p-3 ring-1 ring-ink-150" title={hint}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-500 [&_svg]:size-3.5">{icon}{label}</div>
      <div className={cn('mt-1 truncate text-[15px] font-semibold', warn ? 'text-amber-700' : 'text-ink-900')}>{value}</div>
    </motion.div>
  );
}

function Overview({ station: s, onTab }: { station: Station; onTab: (t: Tab) => void }) {
  const all = (s.easa || []).flatMap(p => p.contacts);
  const main = all.filter(c => c.main);
  const preview = main.length ? main : all.slice(0, 3);
  return (
    <motion.div variants={stagger(0.07)} initial="hidden" animate="show" className="grid gap-6 md:grid-cols-2 [&>section]:min-w-0">
      <section>
        <SectionTitle>Proveedor</SectionTitle>
        <div className="space-y-2">
          {s.easa && s.easa.length ? s.easa.map(p => (
            <div key={p.approval_number} className="rounded-xl bg-ink-50 p-4 ring-1 ring-inset ring-ink-150">
              <div className="text-[15px] font-semibold text-ink-900">{s.providers.join(' · ')}</div>
              <div className="mt-0.5 font-mono text-xs text-ink-500">EASA {p.approval_number}</div>
            </div>
          )) : s.pending ? (
            <div className="rounded-xl bg-amber-50 p-4 text-[14px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">Aún no hay proveedor contratado</div>
          ) : (
            <div className="rounded-xl bg-ink-50 p-4 ring-1 ring-inset ring-ink-150">
              <div className="text-[15px] font-semibold text-ink-900">{s.providers.join(' · ')}</div>
              <div className="mt-0.5 text-xs text-ink-500">Sin datos EASA en el listado de aprobaciones</div>
            </div>
          )}
        </div>
      </section>
      <section>
        <SectionTitle>Cobertura de flota</SectionTitle>
        {s.easa && s.easa.length
          ? <div className="space-y-2">{s.easa.map(p => <FleetTable key={p.approval_number} cols={FLEET_COLS} fleet={p.fleet} />)}</div>
          : <p className="text-sm text-ink-500">Sin datos de cobertura de flota (proveedor sin aprobación EASA registrada).</p>}
      </section>
      <section>
        <SectionTitle>Estado operativo</SectionTitle>
        <div className="divide-y divide-ink-100 rounded-xl ring-1 ring-ink-150">
          <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-ink-600">Vuelo esta temporada</span><Badge tone={s.in_schedule ? 'success' : 'warning'}>{s.in_schedule ? 'Sí' : 'No'}</Badge></div>
          <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-ink-600">Pernocta</span><Badge tone={s.pernocta ? 'violet' : 'neutral'}>{s.pernocta ? 'Sí' : 'No'}</Badge></div>
        </div>
      </section>
      <section>
        <SectionTitle action={all.length > preview.length ? (
          <button onClick={() => onTab('contacts')} className="flex items-center gap-1 text-[13px] font-medium text-brand-600 hover:text-brand-700">Ver los {all.length} <ArrowRight className="size-3.5" /></button>
        ) : undefined}>Contactos principales</SectionTitle>
        {preview.length
          ? <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-2">{preview.map((c, i) => <ContactCard key={i} contact={c} />)}</motion.div>
          : <p className="text-sm text-ink-500">Sin contactos registrados.</p>}
      </section>
    </motion.div>
  );
}

function Contacts({ station: s }: { station: Station }) {
  if (!s.easa || !s.easa.length) return <EmptyState icon={<UsersRound />} title="Sin contactos">Sin contactos registrados para esta estación.</EmptyState>;
  return (
    <div className="space-y-6">
      {s.easa.map(p => (
        <section key={p.approval_number}>
          {s.easa!.length > 1 && <SectionTitle count={p.contacts.length}>{p.vendor.replace('_', '-')}</SectionTitle>}
          {p.contacts.length
            ? <motion.div variants={stagger(0.04)} initial="hidden" animate="show" className="grid gap-2 sm:grid-cols-2">{p.contacts.map((c, i) => <ContactCard key={i} contact={c} />)}</motion.div>
            : <p className="text-sm text-ink-500">Sin contactos registrados.</p>}
        </section>
      ))}
    </div>
  );
}

function PernoctaTab({ station: s }: { station: Station }) {
  const { months } = useAppData();
  const details = useStationDetails(s);
  const [month, setMonth] = useState<string | null>(null);
  if (!s.pernocta_by_month || !Object.keys(s.pernocta_by_month).length) {
    return <EmptyState icon={<Moon />} title="Sin pernocta">Esta estación no tiene pernocta detectada en el horario IB 26/27.</EmptyState>;
  }
  if (month) {
    if (details.isPending) return <TableSkeleton />;
    if (details.error) return <DetailsError message={details.error.message} onRetry={() => details.refetch()} />;
    return <PernoctaCalendar station={s} month={month} byDate={details.data!.pernocta_by_date} onBack={() => setMonth(null)} backLabel="Volver al resumen mensual" months={months.filter(m => s.pernocta_by_month?.[m])} onMonth={setMonth} />;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">Pernoctas por mes en el horario IB 26/27. Pulsa un mes para ver los vuelos de cada noche{months.length ? ` (${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])})` : ''}.</p>
      <PernoctaMatrix stations={[s]} months={months} onCell={(_, m) => setMonth(m)} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true" data-testid="details-loading">
      <Skeleton className="h-10 w-64" />
      {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-9" />)}
    </div>
  );
}

function DetailsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState icon={<CalendarX />} title="No se ha podido cargar el horario" action={<Button onClick={onRetry}>Reintentar</Button>}>
      <span data-testid="details-error">{message}</span>
    </EmptyState>
  );
}
