import { Navigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useAppData, useFcamoTrash } from '@/lib/queries';
import { usePermissions } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Code, EmptyState, Skeleton } from '@/components/ui/primitives';
import { LoadError, Page, PageHeader } from '@/components/layout/Page';

export default function FcamoTrashPage() {
  const { isAdmin } = usePermissions();
  const trash = useFcamoTrash(isAdmin);
  const { stationByCode } = useAppData();
  const qc = useQueryClient();
  if (!isAdmin) return <Navigate to="/fcamo" replace />;

  async function restore(id: number) {
    try {
      await api(`/api/fcamo/${id}/restore`, { method: 'POST' });
      qc.invalidateQueries({ queryKey: ['fcamo'] });
      toast.success('F-CAMO-IBE-14 restaurado');
    } catch (err) {
      toast.error('No se ha podido restaurar', { description: (err as Error).message });
    }
  }

  return (
    <Page width="narrow">
      <PageHeader back={{ to: '/fcamo', label: 'Todos los F-CAMO-IBE-14' }} eyebrow="F-CAMO-IBE-14" title="Papelera" description="Checklists eliminados. Al restaurarlos vuelven a la lista con su progreso." />
      {trash.error ? <LoadError error={trash.error} onRetry={() => trash.refetch()} />
        : trash.isPending ? <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
          : !trash.data!.length ? <EmptyState icon={<Trash2 />} title="La papelera está vacía">No hay F-CAMO-IBE-14 eliminados.</EmptyState>
            : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {trash.data!.map(it => {
                    const st = stationByCode.get(it.station_code);
                    return (
                      <motion.div key={it.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-ink-150 shadow-card">
                        <Code>{it.station_code}</Code>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-semibold text-ink-900">{st ? `${st.city}, ${st.country}` : it.station_code}</div>
                          <div className="text-[12.5px] text-ink-500">eliminado por {it.deleted_by}, {timeAgo(it.deleted_at)}</div>
                        </div>
                        <Button size="sm" icon={<RotateCcw />} onClick={() => restore(it.id)}>Restaurar</Button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
    </Page>
  );
}
