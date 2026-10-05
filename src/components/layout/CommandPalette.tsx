import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Command } from 'cmdk';
import { Dialog as RDialog } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, Building2, ClipboardCheck, CornerDownLeft, LayoutDashboard, Map, Moon, Search, TriangleAlert, Users } from 'lucide-react';
import { useAppData } from '@/lib/queries';
import { usePermissions } from '@/lib/session';
import { useStationNav } from '@/lib/nav';
import { easeOut } from '@/lib/motion';
import { Code, Kbd } from '@/components/ui/primitives';

// Orden de resultados: codigo IATA exacto > empieza por > alguna palabra empieza por > contiene.
function rank(value: string, search: string, keywords?: string[]) {
  const q = search.trim().toLowerCase();
  if (!q) return 1;
  const v = (value + ' ' + (keywords || []).join(' ')).toLowerCase();
  const code = v.split(' ')[0];
  if (code === q) return 1;
  if (v.startsWith(q)) return 0.9;
  if (v.split(/[\s,·-]+/).some(w => w.startsWith(q))) return 0.7;
  return v.includes(q) ? 0.4 : 0;
}

const item = 'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink-700 data-[selected=true]:bg-ink-100 data-[selected=true]:text-ink-900';
const group = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-400';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { sortedStations, sortedAltStations, stationByCode, providers, altProviders } = useAppData();
  const { isAdmin } = usePermissions();
  const { openStation, openAlt } = useStationNav();

  const altOnly = useMemo(() => sortedAltStations.filter(s => !stationByCode.has(s.code)), [sortedAltStations, stationByCode]);
  const altOnlyProviders = useMemo(() => altProviders.filter(p => !providers.includes(p)), [altProviders, providers]);

  const pages = [
    { to: '/', label: 'Inicio', icon: LayoutDashboard },
    { to: '/mapa', label: 'Mapa de la red', icon: Map },
    { to: '/seguimiento', label: 'Estaciones sin proveedor', icon: TriangleAlert },
    { to: '/fcamo', label: 'F-CAMO-IBE-14', icon: ClipboardCheck },
    { to: '/pernoctas', label: 'Pernoctas', icon: Moon },
    { to: '/actividad', label: 'Actividad reciente', icon: Activity },
    ...(isAdmin ? [{ to: '/usuarios', label: 'Usuarios', icon: Users }] : []),
  ];

  const run = (fn: () => void) => { onOpenChange(false); fn(); };

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-ink-950/40 backdrop-blur-[3px]" />
            </RDialog.Overlay>
            <div className="pointer-events-none fixed inset-x-0 top-[12vh] z-[60] flex justify-center px-3">
            <RDialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: easeOut } }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-overlay ring-1 ring-ink-950/5"
              >
                <RDialog.Title className="sr-only">Buscar</RDialog.Title>
                <Command label="Buscar" loop filter={rank}>
                  <div className="flex items-center gap-3 border-b border-ink-100 px-4">
                    <Search className="size-[18px] text-ink-400" />
                    <Command.Input autoFocus placeholder="Buscar estación, ciudad, proveedor…" className="h-14 flex-1 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-400" />
                    <Kbd>Esc</Kbd>
                  </div>
                  <Command.List className="scroll-thin max-h-[min(60vh,440px)] overflow-y-auto p-2">
                    <Command.Empty className="py-12 text-center text-sm text-ink-500">Sin coincidencias.</Command.Empty>
                    <Command.Group heading="Pantallas" className={group}>
                      {pages.map(p => (
                        <Command.Item key={p.to} value={`pantalla ${p.label}`} onSelect={() => run(() => navigate(p.to))} className={item}>
                          <p.icon className="size-4 text-ink-400" /> {p.label}
                        </Command.Item>
                      ))}
                    </Command.Group>
                    <Command.Group heading="Estaciones" className={group}>
                      {sortedStations.map(s => (
                        <Command.Item key={s.code} value={`${s.code} ${s.city} ${s.country} ${s.providers.join(' ')}`} onSelect={() => run(() => openStation(s.code))} className={item}>
                          <Code size="sm">{s.code}</Code>
                          <span className="flex-1 truncate">{s.city}, {s.country}</span>
                          <span className="truncate text-xs text-ink-400">{s.pending ? 'Sin proveedor' : s.providers.join(' · ')}</span>
                        </Command.Item>
                      ))}
                      {altOnly.map(s => (
                        <Command.Item key={'alt-' + s.code} value={`${s.code} ${s.city} ${s.country} alternativo ${s.providers.map(p => p.supplier).join(' ')}`} onSelect={() => run(() => openAlt(s.code))} className={item}>
                          <Code size="sm" className="bg-ink-500">{s.code}</Code>
                          <span className="flex-1 truncate">{s.city}, {s.country}</span>
                          <span className="text-xs text-ink-400">No contratado</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                    <Command.Group heading="Proveedores" className={group}>
                      {providers.map(p => (
                        <Command.Item key={p} value={`proveedor ${p}`} onSelect={() => run(() => navigate(`/mapa?proveedor=${encodeURIComponent(p)}`))} className={item}>
                          <Building2 className="size-4 text-ink-400" /> <span className="flex-1">{p}</span> <span className="text-xs text-ink-400">Contratado</span>
                        </Command.Item>
                      ))}
                      {altOnlyProviders.map(p => (
                        <Command.Item key={'alt-' + p} value={`proveedor ${p} alternativo`} onSelect={() => run(() => navigate(`/mapa?modo=alternativos&proveedor=${encodeURIComponent(p)}`))} className={item}>
                          <Building2 className="size-4 text-ink-400" /> <span className="flex-1">{p}</span> <span className="text-xs text-ink-400">No contratado</span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  </Command.List>
                  <div className="flex items-center gap-4 border-t border-ink-100 bg-ink-50/60 px-4 py-2.5 text-xs text-ink-500">
                    <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> moverse</span>
                    <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft className="size-3" /></Kbd> abrir</span>
                  </div>
                </Command>
              </motion.div>
            </RDialog.Content>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
