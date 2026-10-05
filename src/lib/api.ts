import { session } from './session';

// URL del Worker (API). Se puede cambiar por entorno con VITE_API_URL (ver README.md).
export const API_URL = (import.meta.env.VITE_API_URL || 'https://control-estaciones-auth.victorjjm5.workers.dev').replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// En estas rutas un 401 es una respuesta normal (credenciales malas), no una sesion caducada
const PUBLIC_PATHS = ['/api/login', '/api/request-reset', '/api/reset-password'];

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Token a usar en vez del de la sesion (p. ej. el restringido para elegir contraseña) */
  token?: string | null;
  /** false: no cerrar la sesion ante un 401 (cambio de contraseña, donde un 401 significa otra cosa) */
  expireOn401?: boolean;
}

export async function api<T = Record<string, unknown>>(path: string, opts: Options = {}): Promise<T> {
  const token = opts.token !== undefined ? opts.token : session.get().token;
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('No se ha podido conectar con el servidor. Inténtalo de nuevo.', 0);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // cuenta dada de baja o sesion caducada con la app abierta: se vuelve al login en vez de dejarla rota
    const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p));
    if (res.status === 401 && !isPublic && opts.expireOn401 !== false && session.get().token) {
      session.end('Tu sesión ya no es válida (cuenta dada de baja o sesión caducada). Vuelve a iniciar sesión.');
    }
    throw new ApiError(typeof data.error === 'string' ? data.error : 'Error de conexión', res.status, data);
  }
  return data as T;
}
