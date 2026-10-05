import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight, ClipboardCheck, Plus, Trash2 } from 'lucide-react';
import { useAppData, useFcamoList } from '@/lib/queries';
import { usePermissions } from '@/lib/session';
import type { FcamoItem } from '@/lib/types';
import { fcamoProgress, fcamoReasonLabel, fcamoStatus } from '@/domain/fcamo';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/controls';
import { Badge, Code, EmptyState, Skeleton } from '@/components/ui/primitives';
import { LoadError, Page, PageHeader } from '@/components/layout/Page';

export function FcamoStatusBadge({ item }: { item: FcamoItem }) {
  const done = fcamoStatus(item) === 'completed';
  return <Badge tone={done ? 'success' : 'warning'} dot data-testid="fcamo-status">{done ? 'Completado' : 'Pendiente'}</Badge>;
}

export default function FcamoListPage() {
  const list = useFcamoList();
  const { canWrite, isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [showCompleted, setShowCompleted] = useState(false);
  const items = list.data || [];
  const completed = items.filter(i => fcamoStatus(i) === 'completed').length;
  const visible = showCompleted ? items : items.filter(i => fcamoStatus(i) !== 'completed');

  return (
    <Page>
      <PageHeader
        eyebrow="F-CAMO-IBE-14"
        title="Checklists de estación"
        description="Apertura y actualización de estaciones, compartidas por todo el equipo."
        actions={<>
          {isAdmin && <Button icon={<Trash2 />} onClick={() => navigate('/fcamo/papelera')}>Papelera</Button>}
          {canWrite && <Button variant="primary" icon={<Plus />} onClick={() => navigate('/fcamo/nuevo')}>Nuevo F-CAMO</Button>}
        </>}
      />

      {list.error && !list.data ? <LoadError error={list.error} onRetry={() => list.refetch()} />
        : list.isPending ? <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          : !items.length ? (
            <EmptyState icon={<ClipboardCheck />} title="Todavía no hay ningún F-CAMO-IBE-14" action={canWrite ? <Button variant="primary" icon={<Plus />} onClick={() => navigate('/fcamo/nuevo')}>Nuevo F-CAMO</Button> : undefined}>
              Crea uno para empezar el checklist de apertura o actualización de una estación.
            </EmptyState>
          ) : (
            <>
              {completed > 0 && (
                <button onClick={() => setShowCompleted(s => !s)} className="mb-3 text-[13px] font-medium text-ink-500 hover:text-ink-900">
                  {showCompleted ? 'Ocultar completados' : `Ver completados (${completed})`}
                </button>
              )}
              {!visible.length ? <EmptyState icon={<ClipboardCheck />} title="Todo al día">No hay F-CAMO-IBE-14 pendientes ahora mismo.</EmptyState> : (
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {visible.map((it, i) => <FcamoRow key={it.id} item={it} index={i} />)}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
    </Page>
  );
}

function FcamoRow({ item, index }: { item: FcamoItem; index: number }) {
  const { stationByCode } = useAppData();
  const st = stationByCode.get(item.station_code);
  const { done, total, pct } = fcamoProgress(item);
  const firstFlight = st ? (st.schedule?.length ? st.schedule[0][0] : st.first_flight || null) : null;
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.04, 0.3) } }} exit={{ opacity: 0 }}>
      <Link to={`/fcamo/${item.id}`} data-testid="fcamo-row" className="group flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink-150 shadow-card transition-shadow hover:shadow-lift sm:px-5">
        <Code>{item.station_code}</Code>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-ink-900">{fcamoReasonLabel(item.reason)}</div>
          <div className="truncate text-[12.5px] text-ink-500">
            {st ? `${st.city}, ${st.country} · ` : ''}abierto por {item.created_by}{firstFlight ? ` · primer vuelo ${firstFlight}` : ''}
          </div>
        </div>
        <FcamoStatusBadge item={item} />
        <div className="hidden w-36 sm:block">
          <Progress value={pct} tone={pct === 100 ? 'success' : 'brand'} />
          <div className="mt-1 text-right text-[11.5px] tabular-nums text-ink-500">{done}/{total}</div>
        </div>
        <ChevronRight className="size-4 text-ink-300 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}
