import { Navigate } from 'react-router';
import { motion } from 'motion/react';
import { History } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import { useAudit } from '@/lib/queries';
import { usePermissions } from '@/lib/session';
import { Card, EmptyState, Skeleton } from '@/components/ui/primitives';
import { LoadError, Page, PageHeader } from '@/components/layout/Page';
import { AuditText } from '@/features/activity/activityText';

export default function AuditPage() {
  const { isAdmin } = usePermissions();
  const q = useAudit();
  if (!isAdmin) return <Navigate to="/" replace />;
  return (
    <Page width="narrow">
      <PageHeader back={{ to: '/usuarios', label: 'Todos los usuarios' }} eyebrow="Administración" title="Historial de usuarios" description="Altas, bajas, cambios de rol y de contraseña." />
      {q.error ? <LoadError error={q.error} onRetry={() => q.refetch()} />
        : q.isPending ? <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          : !q.data!.length ? <EmptyState icon={<History />} title="Sin cambios">Todavía no hay cambios registrados.</EmptyState>
            : (
              <Card className="divide-y divide-ink-100">
                {q.data!.map((a, i) => (
                  <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: Math.min(i * 0.03, 0.4) } }} className="flex items-baseline gap-4 px-5 py-3.5">
                    <div className="flex-1 text-[13.5px] leading-snug text-ink-600"><AuditText entry={a} /></div>
                    <div className="shrink-0 text-xs text-ink-400">{timeAgo(a.changed_at)}</div>
                  </motion.div>
                ))}
              </Card>
            )}
    </Page>
  );
}
