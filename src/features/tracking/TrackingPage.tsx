import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, ChevronRight, SearchX } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';
import { useAppData } from '@/lib/queries';
import { flightText, stageCounts, trackingItems, uncoveredCodes, urgency, visibleItems, type StageFilter, type TrackingItem } from '@/domain/tracking';
import { Code, EmptyState, SearchInput, Skeleton } from '@/components/ui/primitives';
import { LoadError, Page, PageHeader } from '@/components/layout/Page';
import { StagePill, useTracking } from './shared';

const FILTERS: { v: StageFilter; label: string }[] = [
  { v: 'all', label: 'Todas' },
  { v: 'none', label: 'Sin gestionar' },
  { v: 'searching', label: 'En búsqueda' },
  { v: 'selected', label: 'Proveedor elegido' },
  { v: 'interim', label: 'Provisional' },
  { v: 'covered', label: 'Cubiertas' },
];

export default function TrackingPage() {
  const { stations } = useAppData();
  const t = useTracking();
  const [filter, setFilter] = useState<StageFilter>('all');
  const [q, setQ] = useState('');

  const items = useMemo(() => (t.data ? trackingItems(t.data, stations) : []), [t.data, stations]);
  const counts = useMemo(() => stageCounts(items), [items]);
  const visible = useMemo(() => visibleItems(items, filter, q), [items, filter, q]);

  return (
    <Page>
      <PageHeader
        eyebrow="Seguimiento"
        title="Estaciones sin proveedor"
        description="Con vuelo y sin proveedor contratado: a quién hemos contactado, a quién hemos elegido y cómo está cada estación."
        back={{ to: '/', label: 'Inicio' }}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filtrar por estado">
          {FILTERS.map(f => {
            const on = filter === f.v;
            return (
              <button
                key={f.v}
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(on && f.v !== 'all' ? 'all' : f.v)}
                className={cn('relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors', on ? 'text-white' : 'bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:ring-ink-300')}
              >
                {on && <motion.span layoutId="trk-filter" transition={spring} className="absolute inset-0 rounded-full bg-ink-900" />}
                <span className="relative">{f.label}</span>
                <span className={cn('relative rounded-full px-1.5 text-[11px] font-semibold tabular-nums', on ? 'bg-white/15' : 'bg-ink-100 text-ink-500')}>{t.data ? counts[f.v] : '·'}</span>
              </button>
            );
          })}
        </div>
        <SearchInput className="ml-auto w-full sm:w-72" placeholder="Buscar estación o proveedor…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar en el seguimiento" />
      </div>

      {t.error && !t.data ? <LoadError error={t.error} onRetry={() => t.raw.refetch()} />
        : t.isPending ? <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)}</div>
          : !uncoveredCodes(stations).length ? <EmptyState icon={<CheckCircle2 />} title="Todo cubierto">No hay estaciones con vuelo y sin proveedor ahora mismo.</EmptyState>
            : !visible.length ? <EmptyState icon={<SearchX />} title="Sin coincidencias">Ninguna estación coincide con el filtro.</EmptyState>
              : (
                <div className="space-y-2" data-testid="tracking-list">
                  <AnimatePresence initial={false} mode="popLayout">
                    {visible.map((it, i) => <Row key={it.code} item={it} index={i} />)}
                  </AnimatePresence>
                </div>
              )}
    </Page>
  );
}

function Row({ item: it, index }: { item: TrackingItem; index: number }) {
  const navigate = useNavigate();
  const urg = urgency(it.flight, it.stage);
  const contacted = it.sum.contacted.length;
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.03, 0.3) } }}
      exit={{ opacity: 0, scale: 0.98 }}
      onClick={() => navigate(`/seguimiento/${it.code}`)}
      data-testid="tracking-row"
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-white p-4 text-left ring-1 ring-ink-150 shadow-card transition-shadow hover:shadow-lift sm:px-5"
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', urg === 'crit' ? 'bg-brand-600' : urg === 'high' ? 'bg-amber-500' : 'bg-transparent')} />
      <Code size="md">{it.code}</Code>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-semibold text-ink-900">{it.flight.city}{it.flight.country ? `, ${it.flight.country}` : ''}</div>
        <div className={cn('text-[13px]', urg === 'crit' ? 'font-medium text-brand-600' : urg === 'high' ? 'font-medium text-amber-700' : 'text-ink-500')}>{flightText(it.flight)}</div>
      </div>
      <div className="hidden w-56 space-y-0.5 text-[12.5px] md:block">
        <div><span className="inline-block w-20 text-ink-400">Contactados</span>{contacted ? <b className="font-semibold text-ink-800">{contacted}</b> : <i className="text-ink-400">ninguno</i>}</div>
        <div className="truncate"><span className="inline-block w-20 text-ink-400">Elegido</span>{it.sum.chosen ? <b className="font-semibold text-ink-800">{it.sum.chosen.name}</b> : <i className="text-ink-400">sin elegir</i>}</div>
      </div>
      <StagePill stage={it.stage} />
      <ChevronRight className="size-4 text-ink-300 transition-transform group-hover:translate-x-0.5" />
    </motion.button>
  );
}
