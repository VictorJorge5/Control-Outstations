import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CalendarX } from 'lucide-react';
import { SCHEDULE_HEADERS, SUBFLEET_COLOR } from '@/domain/fleet';
import type { ScheduleRow } from '@/lib/types';
import { EmptyState, SearchInput } from '@/components/ui/primitives';

const GRID = 'grid grid-cols-[96px_70px_88px_62px_62px_64px_76px_62px_66px_96px]';

// Horario completo, virtualizado: miles de filas sin bloquear la pantalla.
export function ScheduleTable({ schedule }: { schedule: ScheduleRow[] }) {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return query ? schedule.filter(r => r.join(' ').toLowerCase().includes(query)) : schedule;
  }, [schedule, q]);
  const fleetCounts = useMemo(() => {
    const m = new Map<string, number>();
    schedule.forEach(r => m.set(r[9], (m.get(r[9]) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [schedule]);

  const parent = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count: rows.length, getScrollElement: () => parent.current, estimateSize: () => 36, overscan: 12 });

  if (!schedule.length) return <EmptyState icon={<CalendarX />} title="Sin vuelos programados">No hay vuelos de Iberia en este periodo.</EmptyState>;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput className="w-full sm:w-64" placeholder="Filtrar por vuelo, fecha, destino…" value={q} onChange={e => setQ(e.target.value)} aria-label="Filtrar horario" />
        <div className="flex flex-wrap gap-1.5">
          {fleetCounts.map(([f, n]) => (
            <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-ink-600 ring-1 ring-inset ring-ink-150">
              <span className="size-2 rounded-full ring-1 ring-ink-950/10" style={{ background: SUBFLEET_COLOR[f] ? `#${SUBFLEET_COLOR[f]}` : '#e5e8ec' }} />
              {f} <span className="tabular-nums text-ink-400">{n}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-ink-150">
        <div ref={parent} className="scroll-thin min-h-0 flex-1 overflow-auto" data-testid="schedule-scroll">
          <div className="min-w-[782px]">
            <div className={`${GRID} sticky top-0 z-10 bg-ink-900 text-[10.5px] font-semibold tracking-wide text-white/85`}>
              {SCHEDULE_HEADERS.map(h => <div key={h} className="px-2 py-2.5 text-center">{h}</div>)}
            </div>
            <div style={{ height: v.getTotalSize(), position: 'relative' }}>
              {v.getVirtualItems().map(item => {
                const r = rows[item.index];
                const bg = SUBFLEET_COLOR[r[9]];
                return (
                  <div
                    key={item.key}
                    data-testid="schedule-row"
                    className={`${GRID} absolute inset-x-0 items-center border-b border-ink-100 text-center text-[12.5px] text-ink-700 tabular-nums ${item.index % 2 ? 'bg-ink-50/60' : 'bg-white'} hover:bg-brand-50/40`}
                    style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                  >
                    <div className="font-medium text-ink-900">{r[0]}</div>
                    <div className="font-mono text-[11.5px] text-ink-500">{r[1]}</div>
                    <div className="font-mono font-semibold text-ink-900">{r[2]}</div>
                    <div>{r[3]}</div>
                    <div className="text-ink-500">{r[4]}</div>
                    <div className="font-mono">{r[5]}</div>
                    <div>{r[6]}</div>
                    <div className="text-ink-500">{r[7]}</div>
                    <div className="font-mono">{r[8]}</div>
                    <div className="px-1.5">
                      <span className="block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-800 ring-1 ring-inset ring-ink-950/5" style={{ background: bg ? `#${bg}` : undefined }}>{r[9]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {q && <div className="mt-2 text-xs text-ink-500">{rows.length} de {schedule.length} movimientos</div>}
    </div>
  );
}
