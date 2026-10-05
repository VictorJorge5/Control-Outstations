import { useSyncExternalStore } from 'react';
import type { Role } from './types';

// Mismas claves que la version anterior: quien ya tenia la sesion abierta sigue dentro.
const KEYS = {
  token: 'ib_control_estaciones_auth',
  badge: 'ib_control_estaciones_badge',
  admin: 'ib_control_estaciones_admin',
  email: 'ib_control_estaciones_email',
  role: 'ib_control_estaciones_role',
} as const;

export interface Session {
  token: string | null;
  email: string;
  role: Role;
  showDataBadge: boolean;
  /** Motivo por el que se cerro la sesion (se muestra en el login) */
  expiredMessage: string | null;
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* almacenamiento bloqueado: la sesion dura lo que la pestaña */ }
}

function normRole(r: string | null | undefined, legacyAdmin?: string | null): Role {
  if (r === 'admin' || r === 'user' || r === 'viewer') return r;
  return legacyAdmin === '1' ? 'admin' : 'user';
}

function load(): Session {
  return {
    token: read(KEYS.token),
    email: read(KEYS.email) || '',
    role: normRole(read(KEYS.role), read(KEYS.admin)),
    showDataBadge: read(KEYS.badge) === '1',
    expiredMessage: null,
  };
}

let state: Session = load();
const listeners = new Set<() => void>();
function emit(next: Session) {
  state = next;
  listeners.forEach(l => l());
}

export const session = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  start(data: { token: string; email?: string; role?: Role; is_admin?: boolean; show_data_badge?: boolean }) {
    const role = normRole(data.role, data.is_admin ? '1' : '0');
    write(KEYS.token, data.token);
    write(KEYS.email, data.email || '');
    write(KEYS.role, role);
    write(KEYS.admin, role === 'admin' ? '1' : '0');
    write(KEYS.badge, data.show_data_badge ? '1' : '0');
    emit({ token: data.token, email: data.email || '', role, showDataBadge: !!data.show_data_badge, expiredMessage: null });
  },
  setRole(role: Role) {
    const r = normRole(role);
    write(KEYS.role, r);
    write(KEYS.admin, r === 'admin' ? '1' : '0');
    if (r !== state.role) emit({ ...state, role: r });
  },
  /** Cierra la sesion; con mensaje, se muestra en la pantalla de login */
  end(message: string | null = null) {
    Object.values(KEYS).forEach(k => write(k, null));
    emit({ token: null, email: '', role: 'user', showDataBadge: false, expiredMessage: message });
  },
  clearMessage() {
    if (state.expiredMessage) emit({ ...state, expiredMessage: null });
  },
};

export function useSession(): Session {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}

/** Permisos de la interfaz. El Worker vuelve a comprobarlo todo: esto solo decide que se muestra. */
export function usePermissions() {
  const { role } = useSession();
  return { role, canWrite: role !== 'viewer', isAdmin: role === 'admin' };
}
