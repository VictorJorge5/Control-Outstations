import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  Activity, ArrowRight, ArrowUpRight, Building2, ClipboardCheck, Globe2, Moon, PlaneTakeoff, TriangleAlert, Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { fadeUp, stagger } from '@/lib/motion';
import { monthLabel, plural, timeAgo } from '@/lib/format';
import { usePermissions, useSession } from '@/lib/session';
import { useActivity, useAppData, useFcamoList, useNotes, useUsers } from '@/lib/queries';
import { homeTrackingSummary } from '@/domain/tracking';
import { STATUS_META, stationStatus, type StationStatus } from '@/domain/status';
import { AnimatedNumber } from '@/components/ui/controls';
import { Card, Skeleton } from '@/components/ui/primitives';
import { Page } from '@/components/layout/Page';
import { ActivityText } from '@/features/activity/activityText';

function greeting() {
  const h = new Date().getHours();
  return h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}
const firstName = (email: string) => {
  const n = email.split('@')[0]?.split(/[._-]/)[0] || '';
  return n ? n[0]!.toUpperCase() + n.slice(1) : '';
};

export default function HomePage() {
  const { stations, altStations, providers, altProviders, months } = useAppData();
  const { email } = useSession();
  const { isAdmin, role } = usePermissions();
  const notes = useNotes();
  const fcamo = useFcamoList();
  const activity = useActivity();
  const users = useUsers();

  const inSchedule = stations.filter(s => s.in_schedule).length;
  const tracking = notes.data ? homeTrackingSummary(stations, notes.data) : null;
  const fcamoPending = fcamo.data ? fcamo.data.filter(i => i.status !== 'completed').length : null;
  const pernocta = stations.filter(s => s.pernocta);
  const pernoctaNoProv = pernocta.filter(s => s.pending).length;
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const trackingParts = tracking
    ? (Object.entries(tracking.counts) as [string, number][]).filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${({ none: 'sin gestionar', searching: 'en búsqueda', selected: 'con proveedor elegido', interim: 'provisional' } as Record<string, string>)[k]}`)
    : [];
  const now = Math.floor(Date.now() / 1000);
  const activity24 = activity.data ? activity.data.filter(a => now - a.changed_at < 86400).length : null;

  return (
    <Page width="wide">
      <motion.div variants={stagger(0.06)} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="text-[13px] font-medium text-ink-500 first-letter:uppercase">{today}</motion.div>
        <motion.h1 variants={fadeUp} className="mt-1 text-[28px] font-semibold tracking-tight text-ink-900 sm:text-[32px]">
          {greeting()}{firstName(email) ? `, ${firstName(email)}` : ''}
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-1.5 text-[15px] text-ink-500">Así está hoy la red de Outstations.</motion.p>
        {role === 'viewer' && (
          <motion.div variants={fadeUp} id="home-role" className="mt-4 inline-flex rounded-xl bg-amber-50 px-3.5 py-2 text-[13px] text-amber-800 ring-1 ring-inset ring-amber-200">
            Tu acceso es de solo consulta: puedes verlo todo, pero no modificar datos.
          </motion.div>
        )}
      </motion.div>

      {/* KPIs */}
      <motion.div variants={stagger(0.07, 0.15)} initial="hidden" animate="show" className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi icon={<PlaneTakeoff />} label="Estaciones con vuelo" value={inSchedule} sub={`de ${stations.length} en la red · IB 26/27`} to="/mapa" />
        <Kpi icon={<Building2 />} label="Proveedores contratados" value={providers.length} sub={`${altProviders.length} alternativos en ${altStations.length} estaciones`} to="/mapa" />
        <Kpi icon={<TriangleAlert />} label="Sin proveedor" value={tracking?.pending} sub={tracking ? (tracking.pending ? trackingParts.join(' · ') : 'Todas cubiertas') : undefined} to="/seguimiento" tone={tracking && tracking.pending ? 'alert' : undefined} testId="kpi-uncovered" />
        <Kpi icon={<ClipboardCheck />} label="F-CAMO pendientes" value={fcamoPending} sub={fcamo.data ? (fcamo.data.length ? `${fcamo.data.length - (fcamoPending || 0)} completados` : 'Ninguno abierto todavía') : undefined} to="/fcamo" />
      </motion.div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.3 }} className="lg:col-span-2">
          <NetworkCard />
        </motion.div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.38 }}>
          <Card className="flex h-full flex-col p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-ink-900">Actividad reciente</h2>
              <Link to="/actividad" className="flex items-center gap-1 text-[13px] font-medium text-ink-500 hover:text-brand-600">Ver todo <ArrowRight className="size-3.5" /></Link>
            </div>
            <div className="mt-1 text-xs text-ink-400">{activity24 !== null ? `${activity24 >= 50 ? '50+' : activity24} cambios en las últimas 24 h` : ' '}</div>
            <div className="mt-4 flex-1 space-y-3.5">
              {activity.isPending && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9" />)}
              {activity.data && !activity.data.length && <p className="py-6 text-center text-sm text-ink-400">Sin actividad registrada.</p>}
              {activity.data?.slice(0, 5).map((a, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.05 }} className="flex gap-3">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', a.type === 'note' ? 'bg-sky-500' : 'bg-violet-500')} />
                  <div className="min-w-0 text-[13px] leading-snug text-ink-600">
                    <ActivityText entry={a} />
                    <div className="mt-0.5 text-[11.5px] text-ink-400">{timeAgo(a.changed_at)}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* modulos */}
      <h2 className="mb-3 mt-10 text-[15px] font-semibold text-ink-900">Módulos</h2>
      <motion.div variants={stagger(0.05, 0.1)} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleTile id="home-t-contracted" to="/mapa" icon={<Globe2 />} name="Proveedores contratados" desc="Red contratada en el mapa" stat={`${inSchedule} estaciones con vuelo IB 26/27`} count={providers.length} />
        <ModuleTile id="home-t-alt" to="/mapa?modo=alternativos" icon={<Building2 />} name="Proveedores no contratados" desc="Proveedores de respaldo por estación" stat={`${altStations.length} estaciones con alternativas`} count={altProviders.length} />
        <ModuleTile id="home-t-uncov" to="/seguimiento" icon={<TriangleAlert />} name="Estaciones sin proveedor" desc="Seguimiento de estaciones sin cobertura" stat={tracking ? (tracking.pending ? trackingParts.join(' · ') : 'Todas las estaciones cubiertas') : undefined} count={tracking?.pending} alert />
        <ModuleTile id="home-t-fcamo" to="/fcamo" icon={<ClipboardCheck />} name="F-CAMO" desc="Checklists F-CAMO-IBE-14" stat={fcamo.data ? (fcamo.data.length ? `${fcamo.data.length - (fcamoPending || 0)} completados · ${fcamoPending} pendientes` : 'Ninguno abierto todavía') : undefined} count={fcamoPending ?? undefined} />
        <ModuleTile id="home-t-pernocta" to="/pernoctas" icon={<Moon />} name="Pernoctas" desc={`Matriz por estación y mes · ${months.length ? `${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])}` : ''}`} stat={pernoctaNoProv ? `${pernoctaNoProv} sin proveedor contratado` : 'Todas con proveedor'} count={pernocta.length} />
        <ModuleTile id="home-t-activity" to="/actividad" icon={<Activity />} name="Actividad reciente" desc="Notas y F-CAMO de todo el equipo" stat={activity.data ? (activity.data.length ? `último cambio ${timeAgo(activity.data[0].changed_at)}` : 'Sin actividad registrada') : undefined} count={activity24 ?? undefined} />
        {isAdmin && (
          <ModuleTile id="home-t-users" to="/usuarios" icon={<Users />} name="Gestión de usuarios" desc="Altas, permisos y contraseñas" stat={users.data ? plural(users.data.filter(u => u.role === 'admin').length, 'administrador', 'administradores') : undefined} count={users.data?.length} />
        )}
      </motion.div>
    </Page>
  );
}

function Kpi({ icon, label, value, sub, to, tone, testId }: { icon: ReactNode; label: string; value: number | null | undefined; sub?: string; to: string; tone?: 'alert'; testId?: string }) {
  return (
    <motion.div variants={fadeUp}>
      <Link to={to} data-testid={testId} className="group relative block h-full overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-ink-150 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift sm:p-5">
        {tone === 'alert' && <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-700" />}
        <div className="flex items-center gap-2.5">
          <span className={cn('grid size-8 place-items-center rounded-lg [&_svg]:size-4', tone === 'alert' ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-500')}>{icon}</span>
          <span className="text-[12.5px] font-medium text-ink-500">{label}</span>
          <ArrowUpRight className="ml-auto size-4 text-ink-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
        <div className={cn('mt-3 text-[32px] font-semibold leading-none tracking-tight', tone === 'alert' ? 'text-brand-600' : 'text-ink-900')}>
          {value === null || value === undefined ? <Skeleton className="h-8 w-14" /> : <AnimatedNumber value={value} />}
        </div>
        <div className="mt-2 line-clamp-2 min-h-[2lh] text-xs leading-snug text-ink-500">{sub ?? ''}</div>
      </Link>
    </motion.div>
  );
}

function ModuleTile({ id, to, icon, name, desc, stat, count, alert }: { id: string; to: string; icon: ReactNode; name: string; desc: string; stat?: string; count?: number; alert?: boolean }) {
  const navigate = useNavigate();
  return (
    <motion.button
      variants={fadeUp}
      id={id}
      onClick={() => navigate(to)}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group flex items-start gap-4 rounded-2xl bg-white p-5 text-left ring-1 ring-ink-150 shadow-card transition-shadow hover:shadow-lift"
    >
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl transition-colors [&_svg]:size-5', alert ? 'bg-brand-50 text-brand-600 group-hover:bg-brand-100' : 'bg-ink-100 text-ink-600 group-hover:bg-ink-900 group-hover:text-white')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[14.5px] font-semibold text-ink-900">
          {name}
          <ArrowRight className="size-4 -translate-x-1 text-ink-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </span>
        <span className="mt-0.5 block text-[13px] text-ink-500">{desc}</span>
        <span className="mt-2.5 block min-h-[18px] text-xs font-medium text-ink-600">{stat ?? <Skeleton className="h-3.5 w-40" />}</span>
      </span>
      {count !== undefined && <span className={cn('text-2xl font-semibold tabular-nums', alert && count > 0 ? 'text-brand-600' : 'text-ink-800')}><AnimatedNumber value={count} /></span>}
    </motion.button>
  );
}

// ---- Estado de la red + pernoctas por mes ----
function NetworkCard() {
  const { stations, months } = useAppData();
  const navigate = useNavigate();
  const [hover, setHover] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<StationStatus, number> = { assigned: 0, pending: 0, inactive: 0 };
    stations.forEach(s => { c[stationStatus(s)]++; });
    return c;
  }, [stations]);
  const total = stations.length || 1;

  const perMonth = useMemo(() => months.map(m => ({
    m, n: stations.reduce((acc, s) => acc + (s.pernocta_by_month?.[m] || 0), 0),
  })), [months, stations]);
  const max = Math.max(1, ...perMonth.map(p => p.n));
  const peak = perMonth.reduce((a, b) => (b.n > a.n ? b : a), perMonth[0] || { m: '', n: 0 });

  return (
    <Card className="h-full p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-900">Estado de la red</h2>
        <Link to="/mapa" className="flex items-center gap-1 text-[13px] font-medium text-ink-500 hover:text-brand-600">Ver mapa <ArrowRight className="size-3.5" /></Link>
      </div>
      <div className="mt-1 text-xs text-ink-400">{stations.length} estaciones de la red contratada</div>

      {/* barra apilada: 2px de separacion entre segmentos, extremos redondeados */}
      <div className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={(Object.keys(counts) as StationStatus[]).map(k => `${STATUS_META[k].label}: ${counts[k]}`).join(', ')}>
        {(Object.keys(counts) as StationStatus[]).filter(k => counts[k] > 0).map((k, i) => (
          <motion.div
            key={k}
            title={`${STATUS_META[k].label}: ${counts[k]}`}
            initial={{ width: 0 }}
            animate={{ width: `${(counts[k] / total) * 100}%` }}
            transition={{ duration: 0.9, delay: 0.4 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: STATUS_META[k].color }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {(Object.keys(counts) as StationStatus[]).map(k => (
          <button key={k} onClick={() => navigate('/mapa')} className="rounded-xl p-2 text-left transition-colors hover:bg-ink-50">
            <div className="flex items-center gap-2 text-xs text-ink-500"><span className="size-2 rounded-full" style={{ background: STATUS_META[k].color }} />{STATUS_META[k].label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-ink-900"><AnimatedNumber value={counts[k]} /> <span className="text-xs font-medium text-ink-400">{Math.round((counts[k] / total) * 100)}%</span></div>
          </button>
        ))}
      </div>

      {perMonth.length > 0 && (
        <div className="mt-6 border-t border-ink-100 pt-5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold text-ink-800">Pernoctas por mes</h3>
            <span className="hidden text-xs text-ink-400 sm:inline">noches con avión en estación, todas las estaciones</span>
          </div>
          <div className="relative mt-4 flex h-28 items-end gap-1.5 sm:gap-2">
            {perMonth.map((p, i) => (
              <button
                key={p.m}
                onMouseEnter={() => setHover(p.m)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.m)}
                onBlur={() => setHover(null)}
                onClick={() => navigate('/pernoctas')}
                aria-label={`${monthLabel(p.m)}: ${p.n} pernoctas`}
                className="group relative flex h-full flex-1 flex-col items-center justify-end"
              >
                {(hover === p.m || (hover === null && p.m === peak.m)) && (
                  <span className="absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[11px] font-semibold text-white shadow-lift">{p.n.toLocaleString('es-ES')}</span>
                )}
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(2, (p.n / max) * 100)}%` }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className={cn('w-full max-w-6 rounded-t-[4px] transition-colors', hover === p.m ? 'bg-brand-600' : 'bg-brand-400/80')}
                />
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5 border-t border-ink-150 pt-1.5 sm:gap-2">
            {perMonth.map(p => <span key={p.m} className="flex-1 text-center text-[10.5px] capitalize text-ink-400">{monthLabel(p.m).split(' ')[0]}</span>)}
          </div>
        </div>
      )}
    </Card>
  );
}
