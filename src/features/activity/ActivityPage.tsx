import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Activity, ClipboardCheck, StickyNote } from 'lucide-react';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { useActivity } from '@/lib/queries';
import type { ActivityEntry } from '@/lib/types';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { LoadError, Page, PageHeader } from '@/components/layout/Page';
import { ActivityText } from './activityText';

function dayLabel(unix: number) {
  const d = new Date(unix * 1000);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s[0]!.toUpperCase() + s.slice(1);
}

export default function ActivityPage() {
  const q = useActivity();
  const navigate = useNavigate();
  const groups = useMemo(() => {
    const out: { label: string; items: { e: ActivityEntry; n: number }[] }[] = [];
    (q.data || []).forEach((e, n) => {
      const label = dayLabel(e.changed_at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push({ e, n }); else out.push({ label, items: [{ e, n }] });
    });
    return out;
  }, [q.data]);

  const open = (e: ActivityEntry) => {
    if (e.type === 'fcamo' && e.fcamo_id && e.action !== 'deleted') navigate(`/fcamo/${e.fcamo_id}`);
    else if (e.type === 'note') navigate(`/seguimiento/${e.station_code}`);
  };

  return (
    <Page width="narrow">
      <PageHeader eyebrow="Equipo" title="Actividad reciente" description="Últimos cambios en el seguimiento de estaciones y en los checklists F-CAMO de todo el equipo." back={{ to: '/', label: 'Inicio' }} />
      {q.error ? <LoadError error={q.error} onRetry={() => q.refetch()} />
        : q.isPending ? <div className="space-y-3">{Array.from({ length: 6 }, (_, k) => <Skeleton key={k} className="h-14 rounded-xl" />)}</div>
          : !q.data!.length ? <EmptyState icon={<Activity />} title="Sin actividad">Todavía no hay actividad registrada.</EmptyState>
            : groups.map(g => (
              <section key={g.label} className="mb-8">
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-ink-400">{g.label}</h2>
                <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-px before:bg-ink-150">
                  {g.items.map(({ e, n }) => {
                    const delay = Math.min(n * 0.03, 0.4);
                    return (
                      <motion.li key={n} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0, transition: { delay } }}>
                        <button onClick={() => open(e)} className="group relative flex w-full items-start gap-4 rounded-xl p-2 text-left transition-colors hover:bg-white hover:shadow-card" data-testid="activity-item">
                          <span className={cn('relative z-10 grid size-[22px] shrink-0 translate-x-[8px] place-items-center rounded-full ring-4 ring-ink-50 group-hover:ring-white', e.type === 'note' ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600')}>
                            {e.type === 'note' ? <StickyNote className="size-3" /> : <ClipboardCheck className="size-3" />}
                          </span>
                          <span className="ml-2 min-w-0 flex-1">
                            <span className="block text-[13.5px] leading-snug text-ink-600"><ActivityText entry={e} /></span>
                            <span className="mt-0.5 block text-xs text-ink-400">{timeAgo(e.changed_at)}</span>
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </ol>
              </section>
            ))}
    </Page>
  );
}
