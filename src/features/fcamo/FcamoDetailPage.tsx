import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CloudUpload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fadeUp, stagger } from '@/lib/motion';
import { useAppData, useFcamoItem } from '@/lib/queries';
import { usePermissions } from '@/lib/session';
import type { FcamoItem } from '@/lib/types';
import { fcamoAllItems, fcamoFleet, fcamoReasonLabel, fcamoSections, fcamoState, fcamoTypes } from '@/domain/fcamo';
import { useConfirm } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Checkbox, Progress } from '@/components/ui/controls';
import { Badge, Card, Code, Skeleton } from '@/components/ui/primitives';
import { LoadError, Page, PageHeader } from '@/components/layout/Page';

export default function FcamoDetailPage() {
  const id = Number(useParams().id);
  const q = useFcamoItem(Number.isInteger(id) ? id : null);
  return (
    <Page width="narrow">
      {q.error ? <><PageHeader back={{ to: '/fcamo', label: 'Todos los F-CAMO-IBE-14' }} title="F-CAMO-IBE-14" /><LoadError error={q.error} onRetry={() => q.refetch()} /></>
        : !q.data ? <div className="space-y-4"><Skeleton className="h-4 w-40" /><Skeleton className="h-12 w-96" /><Skeleton className="h-96 rounded-2xl" /></div>
          : <Checklist key={q.data.id} item={q.data} />}
    </Page>
  );
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function Checklist({ item }: { item: FcamoItem }) {
  const { stationByCode } = useAppData();
  const { canWrite, isAdmin } = usePermissions();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const st = stationByCode.get(item.station_code);
  const types = useMemo(() => fcamoTypes(item), [item]);
  const fleet = fcamoFleet(item);
  const sections = fcamoSections(types);
  const all = fcamoAllItems(types);

  const [state, setState] = useState<Record<string, boolean>>(() => fcamoState(item));
  const [save, setSave] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const done = all.filter(it => state[it.id]).length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const status = done === all.length ? 'completed' : 'pending';

  useEffect(() => () => clearTimeout(timer.current), []);

  function toggle(itemId: string, v: boolean) {
    const next = { ...state, [itemId]: v };
    setState(next);
    const nextStatus = all.every(it => next[it.id]) ? 'completed' : 'pending';
    clearTimeout(timer.current);
    setSave('saving');
    // se agrupan los cambios rapidos en un solo guardado
    timer.current = setTimeout(async () => {
      try {
        const { item: updated } = await api<{ item: FcamoItem }>(`/api/fcamo/${item.id}`, { method: 'PATCH', body: { items_state: next, status: nextStatus } });
        qc.setQueryData(['fcamo', 'item', item.id], updated);
        qc.invalidateQueries({ queryKey: ['fcamo'], exact: true });
        if (nextStatus !== item.status) qc.invalidateQueries({ queryKey: ['activity'] });
        setSave('saved');
        if (nextStatus === 'completed' && item.status !== 'completed') toast.success('Checklist completado', { description: `${item.station_code}: todos los puntos están hechos.` });
      } catch (err) {
        setSave('error');
        toast.error('No se ha podido guardar', { description: `${(err as Error).message}. Se reintentará en el siguiente cambio.` });
      }
    }, 500);
  }

  async function remove() {
    if (!(await confirm({ title: '¿Eliminar este F-CAMO-IBE-14?', description: 'Irá a la papelera; un administrador puede restaurarlo.', confirmLabel: 'Eliminar', danger: true }))) return;
    try {
      await api(`/api/fcamo/${item.id}`, { method: 'DELETE' });
      qc.invalidateQueries({ queryKey: ['fcamo'] });
      toast.success('F-CAMO-IBE-14 eliminado');
      navigate('/fcamo');
    } catch (err) {
      toast.error('No se ha podido eliminar', { description: (err as Error).message });
    }
  }

  const meta = [fcamoReasonLabel(item.reason), `abierto por ${item.created_by}`, types.join(', ') || 'sin tipo de estación indicado', item.company_name, fleet.join(', ')].filter(Boolean);

  return (
    <>
      <PageHeader
        back={{ to: '/fcamo', label: 'Todos los F-CAMO-IBE-14' }}
        eyebrow="F-CAMO-IBE-14"
        title={<span className="flex items-center gap-3"><Code size="xl">{item.station_code}</Code>{st ? `${st.city}, ${st.country}` : ''}</span>}
        description={meta.join(' · ')}
        actions={isAdmin ? <Button variant="danger" icon={<Trash2 />} onClick={remove}>Eliminar</Button> : undefined}
      />

      <Card className="sticky top-3 z-10 mb-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={status === 'completed' ? 'success' : 'warning'} dot data-testid="fcamo-status">{status === 'completed' ? 'Completado' : 'Pendiente'}</Badge>
          <span className="text-sm text-ink-600"><b className="font-semibold text-ink-900 tabular-nums" data-testid="fcamo-progress">{done}/{all.length}</b> completados</span>
          <SaveIndicator state={save} />
          <span className="ml-auto text-2xl font-semibold tabular-nums text-ink-900">{pct}%</span>
        </div>
        <Progress className="mt-3 h-2" value={pct} tone={pct === 100 ? 'success' : 'brand'} />
      </Card>

      {!canWrite && <div className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 ring-1 ring-inset ring-amber-200">Solo consulta: no puedes modificar este checklist.</div>}

      <motion.div variants={stagger(0.05)} initial="hidden" animate="show" className="space-y-3">
        {sections.map(sec => {
          const secDone = sec.items.filter(it => state[it.id]).length;
          return (
            <motion.div key={sec.key} variants={fadeUp}>
              <Card className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-ink-900">{sec.label}</h3>
                  <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', secDone === sec.items.length ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500')}>{secDone}/{sec.items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {sec.items.map(it => (
                    <Checkbox key={it.id} id={'chk-' + it.id} checked={!!state[it.id]} disabled={!canWrite} onCheckedChange={v => toggle(it.id, v)}
                      label={<span className={cn('transition-colors', state[it.id] && 'text-ink-400 line-through decoration-ink-300')}>{it.label}</span>} />
                  ))}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <AnimatePresence mode="wait">
      {state !== 'idle' && (
        <motion.span key={state} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="save-state"
          className={cn('flex items-center gap-1 text-xs font-medium', state === 'error' ? 'text-brand-600' : state === 'saved' ? 'text-emerald-600' : 'text-ink-400')}>
          {state === 'saving' && <><CloudUpload className="size-3.5 animate-pulse" /> Guardando…</>}
          {state === 'saved' && <><Check className="size-3.5" /> Guardado</>}
          {state === 'error' && 'Sin guardar'}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
