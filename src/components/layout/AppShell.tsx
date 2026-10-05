import { useEffect, useState } from 'react';
import { NavLink, useLocation, useOutlet } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog as RDialog, DropdownMenu } from 'radix-ui';
import {
  Activity, ChevronsUpDown, ClipboardCheck, KeyRound, LayoutDashboard, LogOut, Map, Menu, Moon, Search, TriangleAlert, Users, X,
} from 'lucide-react';
import logo from '@/assets/iberia-logo.png';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { easeOut, spring } from '@/lib/motion';
import { session, usePermissions, useSession } from '@/lib/session';
import { useAppData, useFcamoList, useNotes } from '@/lib/queries';
import { homeTrackingSummary } from '@/domain/tracking';
import { Kbd } from '@/components/ui/primitives';
import { ChangePasswordDialog } from '@/features/auth/ChangePasswordDialog';
import { StationSheet } from '@/features/station/StationSheet';
import { AltStationDialog } from '@/features/station/AltStationDialog';
import { CommandPalette } from './CommandPalette';
import type { Role } from '@/lib/types';

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrador', user: 'Usuario', viewer: 'Consulta' };

export function AppShell({ dataUpdatedAt }: { dataUpdatedAt?: number | null }) {
  const location = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const isMap = location.pathname === '/mapa';

  // el rol puede haberlo cambiado un administrador: se pregunta al servidor al entrar
  useEffect(() => {
    api<{ role: Role }>('/api/me').then(d => session.setRole(d.role)).catch(() => { /* sin conexion: rol guardado */ });
  }, []);

  useEffect(() => { setMobileNav(false); }, [location.pathname]);

  // ⌘K / Ctrl+K abre el buscador global
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full">
      <aside className="hidden w-[256px] shrink-0 lg:block">
        <Sidebar onChangePassword={() => setPwOpen(true)} />
      </aside>

      {/* navegacion movil */}
      <RDialog.Root open={mobileNav} onOpenChange={setMobileNav}>
        <AnimatePresence>
          {mobileNav && (
            <RDialog.Portal forceMount>
              <RDialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-ink-950/50 backdrop-blur-sm lg:hidden" />
              </RDialog.Overlay>
              <RDialog.Content asChild forceMount aria-describedby={undefined}>
                <motion.div initial={{ x: '-100%' }} animate={{ x: 0, transition: { duration: 0.35, ease: easeOut } }} exit={{ x: '-100%', transition: { duration: 0.2 } }} className="fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden">
                  <RDialog.Title className="sr-only">Navegación</RDialog.Title>
                  <Sidebar onChangePassword={() => setPwOpen(true)} />
                  <RDialog.Close className="absolute right-3 top-4 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Cerrar menú"><X className="size-5" /></RDialog.Close>
                </motion.div>
              </RDialog.Content>
            </RDialog.Portal>
          )}
        </AnimatePresence>
      </RDialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileNav(true)} onSearch={() => setPalette(true)} dataUpdatedAt={dataUpdatedAt} />
        <main className={cn('relative min-h-0 flex-1', isMap ? 'overflow-hidden' : 'scroll-thin overflow-y-auto')} id="main">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className={cn(isMap && 'h-full')}
            >
              <FrozenOutlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <StationSheet />
      <AltStationDialog />
      <CommandPalette open={palette} onOpenChange={setPalette} />
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  );
}

// Durante la animacion de salida, la pagina que se va tiene que seguir mostrando SU ruta: un <Outlet>
// normal pintaria ya la nueva y habria dos copias de la pagina (y de sus formularios) a la vez.
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

function useNavCounts() {
  const { stations } = useAppData();
  const notes = useNotes();
  const fcamo = useFcamoList();
  return {
    tracking: notes.data ? homeTrackingSummary(stations, notes.data).pending : undefined,
    fcamo: fcamo.data ? fcamo.data.filter(i => i.status !== 'completed').length : undefined,
  };
}

function Sidebar({ onChangePassword }: { onChangePassword: () => void }) {
  const { isAdmin } = usePermissions();
  const counts = useNavCounts();
  const items = [
    { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
    { to: '/mapa', label: 'Mapa de la red', icon: Map },
    { to: '/seguimiento', label: 'Sin proveedor', icon: TriangleAlert, count: counts.tracking, alert: true },
    { to: '/fcamo', label: 'F-CAMO', icon: ClipboardCheck, count: counts.fcamo },
    { to: '/pernoctas', label: 'Pernoctas', icon: Moon },
    { to: '/actividad', label: 'Actividad', icon: Activity },
    ...(isAdmin ? [{ to: '/usuarios', label: 'Usuarios', icon: Users }] : []),
  ];

  return (
    <nav className="relative flex h-full flex-col overflow-hidden bg-ink-950 text-white" aria-label="Principal">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand-600/25 blur-3xl" />
      <div className="relative px-5 pb-6 pt-6">
        <img src={logo} alt="Iberia" className="h-6 w-auto" />
        <div className="mt-4 text-[15px] font-semibold tracking-tight">Control de Estaciones</div>
        <div className="mt-0.5 text-xs text-white/45">DTO · Outstations</div>
      </div>

      <div className="relative flex-1 space-y-0.5 px-3">
        <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-white/35">Menú</div>
        {items.map(it => (
          <NavLink key={it.to} to={it.to} end={it.end} className="group relative block">
            {({ isActive }) => (
              <span className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors', isActive ? 'text-white' : 'text-white/60 group-hover:bg-white/[0.04] group-hover:text-white')}>
                {isActive && <motion.span layoutId="nav-active" transition={spring} className="absolute inset-0 rounded-xl bg-white/[0.09] ring-1 ring-inset ring-white/10" />}
                {isActive && <motion.span layoutId="nav-bar" transition={spring} className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />}
                <it.icon className="relative size-[18px] shrink-0" strokeWidth={1.8} />
                <span className="relative flex-1">{it.label}</span>
                {it.count !== undefined && it.count > 0 && (
                  <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={cn('relative rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums', it.alert ? 'bg-brand-600 text-white' : 'bg-white/10 text-white/80')}>
                    {it.count}
                  </motion.span>
                )}
              </span>
            )}
          </NavLink>
        ))}
      </div>

      <UserMenu onChangePassword={onChangePassword} />
    </nav>
  );
}

function UserMenu({ onChangePassword }: { onChangePassword: () => void }) {
  const { email, role } = useSession();
  const initials = (email.split('@')[0] || '?').split(/[._-]/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('') || '?';
  return (
    <div className="relative border-t border-white/[0.07] p-3">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.06] data-[state=open]:bg-white/[0.06]" aria-label="Menú de usuario">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold">{initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{email || 'Usuario'}</span>
            <span className="block text-[11.5px] text-white/45">{ROLE_LABEL[role]}</span>
          </span>
          <ChevronsUpDown className="size-4 text-white/40" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" align="start" sideOffset={8} className="z-[60] w-[232px] rounded-xl bg-white p-1.5 shadow-overlay ring-1 ring-ink-950/5 data-[state=open]:animate-[marker-in_0.18s_ease-out]">
            <DropdownMenu.Item onSelect={onChangePassword} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-700 outline-none data-[highlighted]:bg-ink-100">
              <KeyRound className="size-4 text-ink-400" /> Cambiar contraseña
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-ink-100" />
            <DropdownMenu.Item onSelect={() => session.end()} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-brand-700 outline-none data-[highlighted]:bg-brand-50">
              <LogOut className="size-4" /> Cerrar sesión
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function Topbar({ onMenu, onSearch, dataUpdatedAt }: { onMenu: () => void; onSearch: () => void; dataUpdatedAt?: number | null }) {
  const { showDataBadge, role } = useSession();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const updated = dataUpdatedAt ? new Date(dataUpdatedAt * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : null;
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-ink-150/80 bg-white/80 px-4 backdrop-blur-xl sm:px-6">
      <button onClick={onMenu} className="grid size-9 place-items-center rounded-lg text-ink-600 hover:bg-ink-100 lg:hidden" aria-label="Abrir menú"><Menu className="size-5" /></button>
      <button
        onClick={onSearch}
        className="group flex h-10 w-full max-w-md items-center gap-2.5 rounded-xl bg-ink-50 px-3.5 text-sm text-ink-400 ring-1 ring-inset ring-ink-150 transition-all hover:bg-white hover:ring-ink-200 hover:shadow-card"
        data-testid="open-search"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Buscar estación, proveedor o pantalla…</span>
        <span className="hidden items-center gap-1 sm:flex"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></span>
      </button>
      <div className="ml-auto flex items-center gap-2">
        {role === 'viewer' && <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200 md:inline" data-testid="viewer-badge">Solo consulta</span>}
        {showDataBadge && updated && (
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 md:flex" data-testid="data-badge">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Datos del {updated}
          </span>
        )}
      </div>
    </header>
  );
}
