import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { monthLabel, WEEKDAYS_ES } from '@/lib/format';
import type { PernoctaOccurrence, Station } from '@/lib/types';
import { Code } from '@/components/ui/primitives';

// ---- Matriz estacion x mes: el numero de pernoctas, con intensidad de color por cantidad ----
export function PernoctaMatrix({ stations, months, onCell, onStation }: {
  stations: Station[];
  months: string[];
  onCell: (code: string, month: string) => void;
  onStation?: (code: string) => void;
}) {
  const max = Math.max(1, ...stations.flatMap(s => months.map(m => s.pernocta_by_month?.[m] || 0)));
  return (
    <div className="scroll-thin overflow-x-auto rounded-2xl bg-white ring-1 ring-ink-150">
      <table className="w-full border-collapse text-sm" data-testid="pernocta-matrix">
        <thead>
          <tr className="border-b border-ink-150">
            <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-400">Estación</th>
            {months.map(m => <th key={m} className="px-2 py-3 text-center text-[11px] font-semibold capitalize text-ink-500">{monthLabel(m)}</th>)}
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-400">Total</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s, ri) => {
            const total = months.reduce((a, m) => a + (s.pernocta_by_month?.[m] || 0), 0);
            return (
              <motion.tr key={s.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(ri * 0.02, 0.4) }} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50">
                <td className="sticky left-0 z-10 bg-white px-4 py-2">
                  <button onClick={() => onStation?.(s.code)} disabled={!onStation} className="flex items-center gap-2.5 text-left disabled:cursor-default">
                    <Code size="sm">{s.code}</Code>
                    <span className="hidden truncate text-[13px] text-ink-600 sm:inline">{s.city}</span>
                    {s.pending && <span className="size-1.5 rounded-full bg-amber-500" title="Sin proveedor contratado" />}
                  </button>
                </td>
                {months.map(m => {
                  const n = s.pernocta_by_month?.[m] || 0;
                  const t = n / max;
                  return (
                    <td key={m} className="px-1.5 py-1.5 text-center">
                      {n ? (
                        <button
                          onClick={() => onCell(s.code, m)}
                          className="mx-auto grid h-8 w-full min-w-11 max-w-16 place-items-center rounded-lg text-[13px] font-semibold tabular-nums transition-transform hover:scale-110 hover:shadow-card"
                          style={{ background: `rgb(124 58 237 / ${0.1 + t * 0.55})`, color: t > 0.55 ? '#fff' : '#4c1d95' }}
                          aria-label={`${s.code} ${monthLabel(m)}: ${n} pernoctas`}
                          data-testid="pernocta-cell"
                        >
                          {n}
                        </button>
                      ) : <span className="text-ink-200">—</span>}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right text-[13px] font-semibold tabular-nums text-ink-700">{total}</td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Calendario de un mes: vuelos de llegada y salida de cada noche ----
export function PernoctaCalendar({ station, month, byDate, onBack, backLabel, months, onMonth }: {
  station: Station;
  month: string;
  byDate: Record<string, PernoctaOccurrence[]>;
  onBack: () => void;
  backLabel: string;
  months?: string[];
  onMonth?: (m: string) => void;
}) {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const firstWeekdayMon = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7;
  const idx = months?.indexOf(month) ?? -1;
  const prev = months && idx > 0 ? months[idx - 1] : null;
  const next = months && idx >= 0 && idx < months.length - 1 ? months[idx + 1] : null;
  const nights = Object.entries(byDate).filter(([d]) => d.startsWith(month)).reduce((a, [, o]) => a + o.length, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="group flex items-center gap-1.5 text-[13px] font-medium text-ink-500 hover:text-ink-900">
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" /> {backLabel}
        </button>
        <div className="ml-auto flex items-center gap-1">
          {onMonth && <button disabled={!prev} onClick={() => prev && onMonth(prev)} className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 disabled:opacity-30" aria-label="Mes anterior"><ArrowLeft className="size-4" /></button>}
          {onMonth && <button disabled={!next} onClick={() => next && onMonth(next)} className="grid size-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100 disabled:opacity-30" aria-label="Mes siguiente"><ArrowRight className="size-4" /></button>}
        </div>
      </div>
      <div className="mb-4 flex items-center gap-3">
        <Code size="lg">{station.code}</Code>
        <div>
          <div className="text-[15px] font-semibold capitalize text-ink-900">{monthLabel(month)}</div>
          <div className="text-xs text-ink-500">{station.city}, {station.country} · {nights} pernocta{nights === 1 ? '' : 's'}</div>
        </div>
      </div>
      <motion.div key={month} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="scroll-thin overflow-x-auto">
        <div className="grid min-w-[700px] grid-cols-7 gap-1.5" data-testid="pernocta-calendar">
          {WEEKDAYS_ES.map(d => <div key={d} className="pb-1 text-center text-[10.5px] font-semibold tracking-wider text-ink-400">{d}</div>)}
          {Array.from({ length: firstWeekdayMon }, (_, i) => <div key={'b' + i} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const iso = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const occs = byDate[iso] || [];
            return (
              <div key={d} className={cn('min-h-[86px] rounded-xl p-2 text-[11px]', occs.length ? 'bg-violet-50 ring-1 ring-inset ring-violet-200' : 'bg-ink-50/70')}>
                <div className={cn('mb-1 text-[12px] font-semibold', occs.length ? 'text-violet-800' : 'text-ink-300')}>{d}</div>
                {occs.map((o, k) => (
                  <div key={k} className="space-y-1 leading-tight text-ink-700">
                    <div title={`Llega ${o.arr_flight} desde ${o.arr_from} (${o.arr_from_time} → ${o.arr_to_time})`}>
                      <div className="flex items-center gap-1 whitespace-nowrap"><PlaneLanding className="size-3 shrink-0 text-violet-500" /><b className="font-mono font-semibold">{o.arr_flight}</b><span className="text-ink-500">de {o.arr_from}</span></div>
                      <div className="pl-4 font-mono text-[10.5px] text-ink-500">{o.arr_from_time} → {o.arr_to_time}</div>
                    </div>
                    <div title={`Sale ${o.dep_flight} hacia ${o.dep_to} (${o.dep_from_time} → ${o.dep_to_time})`}>
                      <div className="flex items-center gap-1 whitespace-nowrap"><PlaneTakeoff className="size-3 shrink-0 text-violet-500" /><b className="font-mono font-semibold">{o.dep_flight}</b><span className="text-ink-500">a {o.dep_to}</span></div>
                      <div className="pl-4 font-mono text-[10.5px] text-ink-500">{o.dep_from_time} → {o.dep_to_time}</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
