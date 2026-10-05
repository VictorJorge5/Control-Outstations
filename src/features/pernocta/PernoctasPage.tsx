import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Moon } from 'lucide-react';
import { monthLabel } from '@/lib/format';
import { useAppData, useStationDetails } from '@/lib/queries';
import { useStationNav } from '@/lib/nav';
import { Switch } from '@/components/ui/controls';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { LoadError, Page, PageHeader } from '@/components/layout/Page';
import { PernoctaCalendar, PernoctaMatrix } from './PernoctaViews';

export default function PernoctasPage() {
  const { stations, months, stationByCode } = useAppData();
  const { openStation } = useStationNav();
  const [onlyPending, setOnlyPending] = useState(false);
  const [cal, setCal] = useState<{ code: string; month: string } | null>(null);

  const withPernocta = useMemo(() => stations
    .filter(s => s.pernocta_by_month && Object.keys(s.pernocta_by_month).length)
    .filter(s => !onlyPending || s.pending)
    .sort((a, b) => a.code.localeCompare(b.code)), [stations, onlyPending]);
  const range = months.length ? `${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])}` : '';

  return (
    <Page width="wide">
      <PageHeader
        eyebrow="Horario IB 26/27"
        title="Pernoctas"
        description={`Todas las estaciones con pernocta detectada${range ? ` (${range})` : ''}. Pulsa una cifra para ver las noches de ese mes.`}
        back={{ to: '/', label: 'Inicio' }}
        actions={!cal && <Switch checked={onlyPending} onCheckedChange={setOnlyPending} label="Solo sin proveedor contratado" />}
      />
      <AnimatePresence mode="wait" initial={false}>
        {cal ? (
          <motion.div key="cal" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
            <CalendarView code={cal.code} month={cal.month} onMonth={m => setCal({ ...cal, month: m })} onBack={() => setCal(null)} />
          </motion.div>
        ) : (
          <motion.div key="matrix" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
            {withPernocta.length
              ? <PernoctaMatrix stations={withPernocta} months={months} onCell={(code, month) => setCal({ code, month })} onStation={code => stationByCode.has(code) && openStation(code)} />
              : <EmptyState icon={<Moon />} title="Sin pernoctas">No hay estaciones con pernocta detectada.</EmptyState>}
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}

function CalendarView({ code, month, onMonth, onBack }: { code: string; month: string; onMonth: (m: string) => void; onBack: () => void }) {
  const { stationByCode, months } = useAppData();
  const s = stationByCode.get(code)!;
  const details = useStationDetails(s);
  if (details.isPending) return <div className="space-y-3"><Skeleton className="h-8 w-60" /><Skeleton className="h-96 rounded-2xl" /></div>;
  if (details.error) return <LoadError error={details.error} onRetry={() => details.refetch()} />;
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-ink-150 shadow-card sm:p-6">
      <PernoctaCalendar station={s} month={month} byDate={details.data!.pernocta_by_date} onBack={onBack} backLabel="Todas las estaciones" months={months.filter(m => s.pernocta_by_month?.[m])} onMonth={onMonth} />
    </div>
  );
}
