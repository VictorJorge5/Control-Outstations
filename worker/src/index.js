/**
 * Control de Estaciones - Worker de autenticacion
 * ------------------------------------------------
 * Endpoints:
 *   POST /api/login            { email, password }        -> { token }  (429 tras 5 fallos seguidos por email o 20 por IP: bloqueo 15 min)
 *   POST /api/request-reset    { email }                  -> { ok: true }  (siempre, no revela si el email existe)
 *   POST /api/reset-password   { token, password }        -> { ok: true }
 *   POST /api/change-password  { current_password, new_password } -> { token, ... }  (voluntario u obligatorio tras una temporal)
 *   GET  /api/health                                       -> { ok: true }
 *   ---- seguimiento de estaciones sin proveedor (cualquier usuario con sesion) ----
 *   GET    /api/tracking                          -> { notes, candidates }
 *   PATCH  /api/tracking/:code                    { stage?, note? }
 *   POST   /api/tracking/:code/candidates         { provider_name, status? }   status: identified | contacted | selected
 *   PATCH  /api/tracking/candidates/:id           { status }
 *   DELETE /api/tracking/candidates/:id
 *   ---- solo admin (comprobado siempre contra la DB) ----
 *   GET    /api/admin-users               -> lista de usuarios (sin hash/salt)
 *   GET    /api/admin-users/audit         -> historial de altas/bajas/cambios
 *   GET    /api/me                        -> { email, role, is_admin }
 *   POST   /api/admin-users               { email, role?, show_data_badge? } -> crea usuario (role: admin | user | viewer), devuelve temp_password una vez
 *   PATCH  /api/admin-users/:email        { role?, show_data_badge?, reset_password? } -> cambia el rol o resetea la contraseña
 *   DELETE /api/admin-users/:email        -> elimina usuario
 *
 * Bindings esperados (wrangler.toml):
 *   DB              -> D1 database
 *   AUTH_SECRET     -> secret, para firmar los tokens de sesion (wrangler secret put AUTH_SECRET)
 *   SENDGRID_API_KEY -> secret, API key de SendGrid para enviar el correo de reseteo
 *   FROM_EMAIL      -> var, direccion verificada como "Single Sender" en SendGrid (solo el email, sin nombre)
 *   ALLOWED_ORIGIN  -> var, origen(es) permitido(s) para CORS, separados por comas
 *                      (ej. https://tuusuario.github.io,https://control-outstations.vercel.app)
 *   APP_URL         -> var, URL publica de la app (para construir el link de reseteo)
 */

const PBKDF2_ITERATIONS = 100000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias
const RESET_TTL_SECONDS = 60 * 60; // 1 hora
// ---- roles: admin (todo) | user (trabajo diario) | viewer (solo consulta) ----
// is_admin sigue siendo la fuente para "admin" (asi nadie pierde permisos si falta la columna role);
// role distingue user de viewer. Al cambiar un rol se escriben las dos columnas.
const ROLES = ['admin', 'user', 'viewer'];
function roleOf(row) {
  if (!row) return null;
  if (row.is_admin) return 'admin';
  return row.role === 'viewer' ? 'viewer' : 'user';
}
async function roleOfEmail(env, email) {
  return roleOf(await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first());
}
const READ_ONLY_MSG = 'Tu usuario es de solo consulta: no puede modificar datos.';

const DUMMY_SALT_HEX = '00112233445566778899aabbccddeeff';
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;
const PWCHANGE_TOKEN_TTL_SECONDS = 30 * 60; // token restringido: solo sirve para elegir la contraseña nueva

// Los origenes permitidos se normalizan (si por error se escribe con ruta, p. ej. https://x.github.io/App/, se queda en
// https://x.github.io). ALLOWED_ORIGIN admite varios separados por comas (p. ej. GitHub Pages y Vercel a la vez
// durante la migracion); APP_URL siempre cuenta como permitido. Nunca se abre a '*'.
function allowedOrigins(env) {
  const out = [];
  for (const candidate of [...String(env.ALLOWED_ORIGIN || '').split(','), env.APP_URL]) {
    const c = (candidate || '').trim();
    if (!c || c === '*') continue;
    try { out.push(new URL(c).origin); } catch { /* ignorar el mal escrito */ }
  }
  return out;
}

// Si el navegador viene de un origen permitido se le devuelve ese mismo; si no, el primero de la lista
// (el navegador bloqueara la respuesta, que es lo que queremos).
function allowedOrigin(env) {
  const list = allowedOrigins(env);
  if (env.REQUEST_ORIGIN && list.includes(env.REQUEST_ORIGIN)) return env.REQUEST_ORIGIN;
  return list[0] || 'null';
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(env),
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes.buffer;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBuf(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}

function randomHex(nBytes) {
  const arr = new Uint8Array(nBytes);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

async function sha256Hex(text) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return bufToHex(digest);
}

async function hmacSign(text, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return bufToHex(sig);
}

function b64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return decodeURIComponent(escape(atob(str)));
}

// opts.scope = 'pwchange' emite un token restringido (solo vale para /api/change-password)
async function makeSessionToken(email, env, opts = {}) {
  const nowMs = Date.now();
  // iat va en milisegundos: asi una sesion iniciada en el mismo segundo que un cambio de contraseña tambien se distingue
  const claims = { email, iat: nowMs, exp: Math.floor(nowMs / 1000) + (opts.ttl || SESSION_TTL_SECONDS) };
  if (opts.scope) claims.scope = opts.scope;
  const p = b64urlEncode(JSON.stringify(claims));
  const sig = await hmacSign(p, env.AUTH_SECRET);
  return `${p}.${sig}`;
}

// Devuelve el email si la sesion es valida, o null. Ademas de firma y caducidad se comprueba, contra la DB:
//  - que el usuario siga existiendo (si lo borran, el corte es inmediato);
//  - que la contraseña no se haya cambiado/reseteado DESPUES de emitir el token (cierra las sesiones viejas);
//  - que no tenga pendiente elegir contraseña nueva (mientras tanto solo vale el token restringido).
// opts.allowRestricted deja pasar el token restringido y a quien tiene el cambio pendiente (solo /api/change-password).
async function verifySessionToken(token, env, opts = {}) {
  if (!token || !token.includes('.')) return null;
  const [p, sig] = token.split('.');
  const expected = await hmacSign(p, env.AUTH_SECRET);
  if (!timingSafeEqual(sig, expected)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(p)); } catch { return null; }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(payload.email).first();
  if (!user) return null;
  const issuedAt = payload.iat || (payload.exp - SESSION_TTL_SECONDS) * 1000; // los tokens antiguos no llevan iat
  if (issuedAt < (user.password_changed_at || 0)) return null;
  const restricted = payload.scope === 'pwchange';
  // el token restringido solo vale mientras el cambio siga pendiente (se puede usar una unica vez)
  if (restricted && (!opts.allowRestricted || !user.must_change_password)) return null;
  if (user.must_change_password && !opts.allowRestricted) return null;
  return payload.email;
}

// ---- limite de intentos de login: por email (5 fallos) y por IP (20 fallos)
// en una ventana de 15 min; al superarlo, bloqueo de 15 min ----
const LOGIN_MAX_EMAIL = 5;
const LOGIN_MAX_IP = 20;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_LOCK_SECONDS = 15 * 60;

async function loginLockRemaining(env, keys) {
  const now = Math.floor(Date.now() / 1000);
  let remaining = 0;
  for (const key of keys) {
    const row = await env.DB.prepare('SELECT locked_until FROM login_attempts WHERE key = ?').bind(key).first();
    if (row && row.locked_until > now) remaining = Math.max(remaining, row.locked_until - now);
  }
  return remaining;
}

// devuelve true si este fallo ha provocado el bloqueo
async function registerLoginFailure(env, key, max) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('SELECT fails, window_start FROM login_attempts WHERE key = ?').bind(key).first();
  let fails = 1;
  let start = now;
  if (row && now - row.window_start < LOGIN_WINDOW_SECONDS) {
    fails = row.fails + 1;
    start = row.window_start;
  }
  const lockedUntil = fails >= max ? now + LOGIN_LOCK_SECONDS : 0;
  await env.DB.prepare(
    'INSERT INTO login_attempts (key, fails, window_start, locked_until) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET fails = excluded.fails, window_start = excluded.window_start, locked_until = excluded.locked_until'
  ).bind(key, fails, start, lockedUntil).run();
  // limpieza oportunista de filas antiguas para que la tabla no crezca
  await env.DB.prepare('DELETE FROM login_attempts WHERE window_start < ? AND locked_until < ?')
    .bind(now - LOGIN_WINDOW_SECONDS * 4, now).run();
  return lockedUntil > 0;
}

async function sendResetEmail(env, email, resetUrl) {
  if (!env.SENDGRID_API_KEY) return; // sin proveedor de correo no se envia nada (y el enlace nunca se escribe en los registros)
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email }] }],
      from: { email: env.FROM_EMAIL, name: 'Control de Estaciones' },
      subject: 'Restablecer contraseña - Control de Estaciones',
      content: [{
        type: 'text/html',
        value: `
          <p>Has solicitado restablecer tu contraseña para <b>Control de Estaciones</b>.</p>
          <p><a href="${resetUrl}">Haz clic aquí para elegir una nueva contraseña</a> (caduca en 1 hora).</p>
          <p>Si no has sido tú, puedes ignorar este correo.</p>
        `,
      }],
    }),
  });
}

// ---- validacion de los datos de F-CAMO: se acepta solo lo que la app puede enviar (mantener en sintonia con el HTML) ----
const FCAMO_REASONS = ['opening', 'update'];
const FCAMO_STATION_TYPES = ['ETOPS', 'Overnight', 'On call'];
const FCAMO_FLEET_SCOPE = ['A320 FAMILY', 'A321 XLR', 'A330', 'A350'];
const FCAMO_STATUSES = ['pending', 'completed'];

// Devuelve { error } o { value }. Solo valida los campos presentes en `body`.
function validateFcamo(body, { creating }) {
  const out = {};
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  const listOf = (v, allowed) => Array.isArray(v) && v.length <= allowed.length && v.every(x => allowed.includes(x)) && new Set(v).size === v.length;

  if (creating || body.station_code !== undefined) {
    if (typeof body.station_code !== 'string' || !/^[A-Z0-9]{3,4}$/.test(body.station_code)) return { error: 'Estación no válida' };
    out.station_code = body.station_code;
  }
  if (creating || body.reason !== undefined) {
    if (!FCAMO_REASONS.includes(body.reason)) return { error: 'Motivo no válido' };
    out.reason = body.reason;
  }
  if (body.station_types !== undefined) {
    if (!listOf(body.station_types, FCAMO_STATION_TYPES)) return { error: 'Tipo de estación no válido' };
    out.station_types = body.station_types;
  }
  if (body.fleet_scope !== undefined) {
    if (!listOf(body.fleet_scope, FCAMO_FLEET_SCOPE)) return { error: 'Flota no válida' };
    out.fleet_scope = body.fleet_scope;
  }
  for (const [field, max] of [['company_name', 200], ['easa_ref', 100], ['approved_by', 200], ['easa_date', 30], ['approved_date', 30]]) {
    if (body[field] !== undefined) {
      if (!text(body[field], max)) return { error: `El campo ${field} no es válido` };
      out[field] = body[field].trim();
    }
  }
  if (body.status !== undefined) {
    if (!FCAMO_STATUSES.includes(body.status)) return { error: 'Estado no válido' };
    out.status = body.status;
  }
  if (body.items_state !== undefined) {
    const s = body.items_state;
    if (!s || typeof s !== 'object' || Array.isArray(s)) return { error: 'Checklist no válido' };
    const keys = Object.keys(s);
    if (keys.length > 200 || !keys.every(k => /^[a-z0-9_]{1,60}$/.test(k) && typeof s[k] === 'boolean')) return { error: 'Checklist no válido' };
    out.items_state = s;
  }
  return { value: out };
}

export default {
  async fetch(request, env) {
    // el origen de la peticion viaja con env para que json()/corsHeaders() elijan el origen CORS correcto
    env = { ...env, REQUEST_ORIGIN: request.headers.get('Origin') || '' };
    try {
      return await handleRequest(request, env);
    } catch (err) {
      // el detalle tecnico solo va a los registros del Worker; al navegador no se le da ninguna pista
      console.error('Error interno:', err && err.stack ? err.stack : err);
      return json({ error: 'Error interno. Inténtalo de nuevo; si persiste, avisa al administrador.' }, 500, env);
    }
  },
};

async function handleRequest(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true }, 200, env);
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      const { email, password } = await request.json().catch(() => ({}));
      if (!email || !password) return json({ error: 'Faltan datos' }, 400, env);
      const emailNorm = String(email).trim().toLowerCase().slice(0, 254);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const emailKey = 'email:' + emailNorm;
      const ipKey = 'ip:' + ip;

      const lockedFor = await loginLockRemaining(env, [emailKey, ipKey]);
      if (lockedFor > 0) {
        return json({ error: `Demasiados intentos fallidos. Inténtalo de nuevo en ${Math.ceil(lockedFor / 60)} min.`, retry_after: lockedFor }, 429, env);
      }

      const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(emailNorm).first();
      let ok = false;
      if (row) {
        const computed = await hashPassword(password, row.salt);
        ok = timingSafeEqual(computed, row.password_hash);
      } else {
        // se hace el mismo trabajo aunque el usuario no exista, para que el tiempo de respuesta no delate quien tiene cuenta
        await hashPassword(String(password), DUMMY_SALT_HEX);
      }

      if (!ok) {
        const emailLocked = await registerLoginFailure(env, emailKey, LOGIN_MAX_EMAIL);
        const ipLocked = await registerLoginFailure(env, ipKey, LOGIN_MAX_IP);
        if (emailLocked && row) {
          // solo se audita si la cuenta existe, para que nadie pueda llenar el historial con emails inventados
          await env.DB.prepare(
            'INSERT INTO user_audit (target_email, action, detail, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(emailNorm, 'login_locked', 'demasiados intentos fallidos', 'sistema', Math.floor(Date.now() / 1000)).run();
        }
        if (emailLocked || ipLocked) {
          return json({ error: `Demasiados intentos fallidos. Inténtalo de nuevo en ${Math.ceil(LOGIN_LOCK_SECONDS / 60)} min.`, retry_after: LOGIN_LOCK_SECONDS }, 429, env);
        }
        return json({ error: 'Usuario o contraseña incorrectos' }, 401, env);
      }

      await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(emailKey).run();
      if (row.must_change_password) {
        // contraseña temporal: solo se entrega un token que sirve unicamente para elegir la nueva
        const restricted = await makeSessionToken(emailNorm, env, { ttl: PWCHANGE_TOKEN_TTL_SECONDS, scope: 'pwchange' });
        return json({ must_change: true, token: restricted, email: emailNorm }, 200, env);
      }
      const token = await makeSessionToken(emailNorm, env);
      return json({ token, email: emailNorm, show_data_badge: !!row.show_data_badge, is_admin: roleOf(row) === 'admin', role: roleOf(row) }, 200, env);
    }

    if (url.pathname === '/api/request-reset' && request.method === 'POST') {
      const { email } = await request.json().catch(() => ({}));
      const emailNorm = String(email || '').trim().toLowerCase().slice(0, 254);
      // limite de peticiones (3 por email y 10 por IP cada 15 min): evita usarlo para llenar de correos a alguien o gastar la cuota
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const keys = ['reset-email:' + emailNorm, 'reset-ip:' + ip];
      const blocked = (await loginLockRemaining(env, keys)) > 0;
      // Sin proveedor de correo configurado esta funcion esta desactivada: no se crea ningun enlace de reseteo.
      // (El Worker envia por SendGrid; hoy solo hay una clave de Resend, asi que no salia ningun correo.)
      if (emailNorm && !blocked && env.SENDGRID_API_KEY) {
        await registerLoginFailure(env, keys[0], 3);
        await registerLoginFailure(env, keys[1], 10);
        const row = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(emailNorm).first();
        if (row) {
          // un solo enlace vigente: los anteriores dejan de valer
          await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE email = ? AND used = 0').bind(emailNorm).run();
          const rawToken = randomHex(32);
          const tokenHash = await sha256Hex(rawToken);
          const expiresAt = Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS;
          await env.DB.prepare(
            'INSERT INTO password_resets (email, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)'
          ).bind(emailNorm, tokenHash, expiresAt, Math.floor(Date.now() / 1000)).run();

          const resetUrl = `${env.APP_URL}?reset=${rawToken}`;
          await sendResetEmail(env, emailNorm, resetUrl);
        }
      }
      // Respuesta identica exista o no el email (y este o no limitado), para no revelar qué usuarios existen.
      return json({ ok: true }, 200, env);
    }

    if (url.pathname === '/api/reset-password' && request.method === 'POST') {
      const { token, password } = await request.json().catch(() => ({}));
      if (!token || !password) return json({ error: 'Faltan datos' }, 400, env);
      if (String(password).length < MIN_PASSWORD_LENGTH) return json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` }, 400, env);
      if (String(password).length > MAX_PASSWORD_LENGTH) return json({ error: 'La contraseña es demasiado larga' }, 400, env);

      const tokenHash = await sha256Hex(token);
      const row = await env.DB.prepare(
        'SELECT * FROM password_resets WHERE token_hash = ? AND used = 0'
      ).bind(tokenHash).first();

      if (!row || row.expires_at < Math.floor(Date.now() / 1000)) {
        return json({ error: 'El enlace de restablecimiento no es válido o ha caducado' }, 400, env);
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const newSalt = randomHex(16);
      const newHash = await hashPassword(password, newSalt);
      await env.DB.prepare(
        'UPDATE users SET salt = ?, password_hash = ?, must_change_password = 0, password_changed_at = ?, updated_at = ? WHERE email = ?'
      ).bind(newSalt, newHash, Date.now(), nowSec, row.email).run();
      await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(row.id).run();
      await env.DB.prepare(
        'INSERT INTO user_audit (target_email, action, detail, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(row.email, 'password_changed', 'enlace de correo', row.email, nowSec).run();

      return json({ ok: true }, 200, env);
    }

    // ---- cambio de contraseña por el propio usuario (voluntario, o obligatorio tras una temporal) ----
    if (url.pathname === '/api/change-password' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const email = await verifySessionToken(token, env, { allowRestricted: true });
      if (!email) return json({ error: 'No autorizado' }, 401, env);

      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const emailKey = 'email:' + email;
      const ipKey = 'ip:' + ip;
      const lockedFor = await loginLockRemaining(env, [emailKey, ipKey]);
      if (lockedFor > 0) {
        return json({ error: `Demasiados intentos fallidos. Inténtalo de nuevo en ${Math.ceil(lockedFor / 60)} min.`, retry_after: lockedFor }, 429, env);
      }

      const { current_password, new_password } = await request.json().catch(() => ({}));
      if (typeof current_password !== 'string' || !current_password || typeof new_password !== 'string') {
        return json({ error: 'Faltan datos' }, 400, env);
      }
      if (new_password.length < MIN_PASSWORD_LENGTH) return json({ error: `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` }, 400, env);
      if (new_password.length > MAX_PASSWORD_LENGTH) return json({ error: 'La contraseña nueva es demasiado larga' }, 400, env);

      const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      const currentOk = timingSafeEqual(await hashPassword(current_password, row.salt), row.password_hash);
      if (!currentOk) {
        // adivinar la contraseña actual con un token robado cuenta como un intento de login fallido
        const emailLocked = await registerLoginFailure(env, emailKey, LOGIN_MAX_EMAIL);
        const ipLocked = await registerLoginFailure(env, ipKey, LOGIN_MAX_IP);
        if (emailLocked || ipLocked) {
          return json({ error: `Demasiados intentos fallidos. Inténtalo de nuevo en ${Math.ceil(LOGIN_LOCK_SECONDS / 60)} min.`, retry_after: LOGIN_LOCK_SECONDS }, 429, env);
        }
        return json({ error: 'La contraseña actual no es correcta' }, 403, env); // 403: un 401 cerraria la sesion en la app
      }
      if (new_password === current_password) {
        return json({ error: 'La contraseña nueva debe ser distinta de la actual' }, 400, env);
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const newSalt = randomHex(16);
      const newHash = await hashPassword(new_password, newSalt);
      await env.DB.prepare(
        'UPDATE users SET salt = ?, password_hash = ?, must_change_password = 0, password_changed_at = ?, updated_at = ? WHERE email = ?'
      ).bind(newSalt, newHash, Date.now(), nowSec, email).run();
      await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(emailKey).run();
      await env.DB.prepare(
        'INSERT INTO user_audit (target_email, action, detail, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(email, 'password_changed', row.must_change_password ? 'tras contraseña temporal' : '', email, nowSec).run();

      // todas las sesiones anteriores quedan cerradas; esta recibe un token nuevo
      const fresh = await makeSessionToken(email, env);
      return json({ ok: true, token: fresh, email, show_data_badge: !!row.show_data_badge, is_admin: roleOf(row) === 'admin', role: roleOf(row) }, 200, env);
    }

    // ---- quien soy y con que rol (la pantalla lo consulta para mostrar solo lo que corresponde) ----
    if (url.pathname === '/api/me' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const email = await verifySessionToken(token, env);
      if (!email) return json({ error: 'No autorizado' }, 401, env);
      const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      return json({ email, role: roleOf(row), is_admin: roleOf(row) === 'admin', show_data_badge: !!row.show_data_badge }, 200, env);
    }

    // ---- F-CAMO-IBE-14: checklists compartidas, requieren sesion valida ----
    if (url.pathname.startsWith('/api/fcamo')) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const email = await verifySessionToken(token, env);
      if (!email) return json({ error: 'No autorizado' }, 401, env);

      const role = await roleOfEmail(env, email);
      async function isAdmin(){ return role === 'admin'; }
      async function logFcamo(fcamoId, stationCode, action){
        await env.DB.prepare(
          'INSERT INTO fcamo_history (fcamo_id, station_code, action, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(fcamoId, stationCode, action, email, Math.floor(Date.now() / 1000)).run();
      }

      const parts = url.pathname.split('/').filter(Boolean); // ['api','fcamo', maybe id/'trash', maybe 'restore']
      const sub = parts[2] || null;
      const id = sub && sub !== 'trash' ? parseInt(sub, 10) : null;
      if (sub && sub !== 'trash' && !Number.isInteger(id)) return json({ error: 'Id no válido' }, 400, env);
      const action = parts[3] || null;

      if (request.method === 'GET' && sub === 'trash') {
        if (!(await isAdmin())) return json({ error: 'No autorizado' }, 403, env);
        const rows = await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE deleted = 1 ORDER BY deleted_at DESC').all();
        return json({ items: rows.results }, 200, env);
      }

      if (request.method === 'POST' && id && action === 'restore') {
        if (!(await isAdmin())) return json({ error: 'No autorizado' }, 403, env);
        const existing = await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE id = ?').bind(id).first();
        if (!existing) return json({ error: 'No encontrado' }, 404, env);
        await env.DB.prepare("UPDATE fcamo_checklists SET deleted = 0, deleted_by = '', deleted_at = NULL WHERE id = ?").bind(id).run();
        await logFcamo(id, existing.station_code, 'restored');
        const row = await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE id = ?').bind(id).first();
        return json({ item: row }, 200, env);
      }

      if (request.method === 'GET' && !sub) {
        const station = url.searchParams.get('station');
        const rows = station
          ? await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE station_code = ? AND deleted = 0 ORDER BY created_at DESC').bind(station).all()
          : await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE deleted = 0 ORDER BY created_at DESC').all();
        return json({ items: rows.results }, 200, env);
      }

      if (request.method === 'GET' && id) {
        const row = await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE id = ?').bind(id).first();
        if (!row) return json({ error: 'No encontrado' }, 404, env);
        return json({ item: row }, 200, env);
      }

      if (request.method === 'POST' && !sub) {
        if (role === 'viewer') return json({ error: READ_ONLY_MSG }, 403, env);
        const body = await request.json().catch(() => ({}));
        const check = validateFcamo(body, { creating: true });
        if (check.error) return json({ error: check.error }, 400, env);
        const v = check.value;
        const known = await env.DB.prepare('SELECT 1 FROM station_full WHERE code = ?').bind(v.station_code).first();
        if (!known) return json({ error: 'Estación no encontrada' }, 404, env);
        const now = Math.floor(Date.now() / 1000);
        const res = await env.DB.prepare(
          `INSERT INTO fcamo_checklists
           (station_code, reason, station_types, company_name, easa_ref, easa_date, fleet_scope, items_state, approved_by, approved_date, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, '{}', '', '', 'pending', ?, ?, ?)`
        ).bind(
          v.station_code, v.reason,
          JSON.stringify(v.station_types || []),
          v.company_name || '', v.easa_ref || '', v.easa_date || '',
          JSON.stringify(v.fleet_scope || []),
          email, now, now
        ).run();
        await logFcamo(res.meta.last_row_id, v.station_code, 'created');
        const row = await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE id = ?').bind(res.meta.last_row_id).first();
        return json({ item: row }, 200, env);
      }

      if (request.method === 'PATCH' && id) {
        if (role === 'viewer') return json({ error: READ_ONLY_MSG }, 403, env);
        const raw = await request.json().catch(() => ({}));
        // la estacion y el motivo de un F-CAMO no se cambian una vez creado
        const { station_code: _s, reason: _r, ...body } = raw;
        const check = validateFcamo(body, { creating: false });
        if (check.error) return json({ error: check.error }, 400, env);
        Object.assign(body, check.value);
        const existing = await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE id = ?').bind(id).first();
        if (!existing) return json({ error: 'No encontrado' }, 404, env);

        const fields = {
          station_types: body.station_types !== undefined ? JSON.stringify(body.station_types) : existing.station_types,
          company_name: body.company_name !== undefined ? body.company_name : existing.company_name,
          easa_ref: body.easa_ref !== undefined ? body.easa_ref : existing.easa_ref,
          easa_date: body.easa_date !== undefined ? body.easa_date : existing.easa_date,
          fleet_scope: body.fleet_scope !== undefined ? JSON.stringify(body.fleet_scope) : existing.fleet_scope,
          items_state: body.items_state !== undefined ? JSON.stringify(body.items_state) : existing.items_state,
          approved_by: body.approved_by !== undefined ? body.approved_by : existing.approved_by,
          approved_date: body.approved_date !== undefined ? body.approved_date : existing.approved_date,
          status: body.status !== undefined ? body.status : existing.status,
        };
        await env.DB.prepare(
          `UPDATE fcamo_checklists SET station_types=?, company_name=?, easa_ref=?, easa_date=?, fleet_scope=?, items_state=?, approved_by=?, approved_date=?, status=?, updated_at=? WHERE id=?`
        ).bind(
          fields.station_types, fields.company_name, fields.easa_ref, fields.easa_date,
          fields.fleet_scope, fields.items_state, fields.approved_by, fields.approved_date,
          fields.status, Math.floor(Date.now() / 1000), id
        ).run();
        if (body.status !== undefined && body.status !== existing.status){
          await logFcamo(id, existing.station_code, body.status === 'completed' ? 'completed' : 'reopened');
        }
        const row = await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE id = ?').bind(id).first();
        return json({ item: row }, 200, env);
      }

      if (request.method === 'DELETE' && id) {
        if (role !== 'admin') return json({ error: 'Solo los administradores pueden eliminar un F-CAMO.' }, 403, env);
        const existing = await env.DB.prepare('SELECT * FROM fcamo_checklists WHERE id = ?').bind(id).first();
        if (!existing) return json({ error: 'No encontrado' }, 404, env);
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare(
          'UPDATE fcamo_checklists SET deleted = 1, deleted_by = ?, deleted_at = ? WHERE id = ?'
        ).bind(email, now, id).run();
        await logFcamo(id, existing.station_code, 'deleted');
        return json({ ok: true }, 200, env);
      }

      return json({ error: 'Metodo no soportado' }, 405, env);
    }

    // ---- actividad reciente: fusion de notas + F-CAMO, para el panel de "Actividad reciente" ----
    if (url.pathname === '/api/activity' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const email = await verifySessionToken(token, env);
      if (!email) return json({ error: 'No autorizado' }, 401, env);

      const [noteRows, fcamoRows] = await Promise.all([
        env.DB.prepare('SELECT * FROM station_note_history ORDER BY changed_at DESC LIMIT 50').all(),
        env.DB.prepare('SELECT * FROM fcamo_history ORDER BY changed_at DESC LIMIT 50').all(),
      ]);
      const merged = [
        ...noteRows.results.map(r => ({ type:'note', station_code:r.station_code, action:r.action, value:r.value, changed_by:r.changed_by, changed_at:r.changed_at })),
        ...fcamoRows.results.map(r => ({ type:'fcamo', station_code:r.station_code, action:r.action, fcamo_id:r.fcamo_id, changed_by:r.changed_by, changed_at:r.changed_at })),
      ].sort((a, b) => b.changed_at - a.changed_at).slice(0, 50);

      return json({ items: merged }, 200, env);
    }

    // ---- datos sensibles: estaciones, horario, contactos, respaldo ----
    // Solo se sirven a quien tenga una sesion valida (igual que /api/fcamo).
    if (url.pathname === '/api/data' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const email = await verifySessionToken(token, env);
      if (!email) return json({ error: 'No autorizado' }, 401, env);

      const [stationsRes, altRes, metaRow] = await Promise.all([
        env.DB.prepare('SELECT data FROM station_full').all(),
        env.DB.prepare('SELECT data FROM alt_station_full').all(),
        env.DB.prepare("SELECT value FROM app_meta WHERE key = 'pernocta_months'").first(),
      ]);
      const stations = stationsRes.results.map(r => JSON.parse(r.data));
      const altStations = altRes.results.map(r => JSON.parse(r.data));
      const pernoctaMonths = metaRow ? JSON.parse(metaRow.value) : [];

      return json({ stations, alt_stations: altStations, pernocta_months: pernoctaMonths }, 200, env);
    }

    // ---- carga/actualizacion de los datos de estaciones y proveedores: SOLO administradores ----
    if (url.pathname === '/api/admin-import' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const email = await verifySessionToken(token, env);
      if (!email) return json({ error: 'No autorizado' }, 401, env);
      const me = await env.DB.prepare('SELECT is_admin FROM users WHERE email = ?').bind(email).first();
      if (!me || !me.is_admin) return json({ error: 'No autorizado' }, 403, env);

      const body = await request.json().catch(() => ({}));
      // forma minima de los datos: evita que un error (o una cuenta comprometida) deje datos rotos
      const validCode = s => s && typeof s === 'object' && typeof s.code === 'string' && /^[A-Z0-9]{3,4}$/.test(s.code);
      for (const key of ['stations', 'alt_stations']) {
        if (body[key] !== undefined && (!Array.isArray(body[key]) || body[key].length > 2000 || !body[key].every(validCode))) {
          return json({ error: `El campo ${key} no es válido (cada estación necesita un código de 3-4 letras o números)` }, 400, env);
        }
      }
      if (body.pernocta_months !== undefined && (!Array.isArray(body.pernocta_months) || body.pernocta_months.length > 60 || !body.pernocta_months.every(m => typeof m === 'string' && m.length <= 20))) {
        return json({ error: 'El campo pernocta_months no es válido' }, 400, env);
      }
      const now = Math.floor(Date.now() / 1000);
      let count = 0;

      if (Array.isArray(body.stations)) {
        const stmts = body.stations.map(s => env.DB.prepare(
          'INSERT INTO station_full (code, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
        ).bind(s.code, JSON.stringify(s), now));
        for (let i = 0; i < stmts.length; i += 20) {
          await env.DB.batch(stmts.slice(i, i + 20));
        }
        count += body.stations.length;
      }
      if (Array.isArray(body.alt_stations)) {
        const stmts = body.alt_stations.map(s => env.DB.prepare(
          'INSERT INTO alt_station_full (code, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
        ).bind(s.code, JSON.stringify(s), now));
        for (let i = 0; i < stmts.length; i += 20) {
          await env.DB.batch(stmts.slice(i, i + 20));
        }
        count += body.alt_stations.length;
      }
      if (Array.isArray(body.pernocta_months)) {
        await env.DB.prepare(
          "INSERT INTO app_meta (key, value) VALUES ('pernocta_months', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        ).bind(JSON.stringify(body.pernocta_months)).run();
      }

      return json({ ok: true, imported: count }, 200, env);
    }

    // ---- notas compartidas por estacion (estaciones sin proveedor, etc.) ----
    // con candado de edicion (para que no se pisen dos personas) e historial.
    // ---- notas de estacion: solo lectura (las usa la tarjeta de inicio). Las escrituras van por /api/tracking,
    // que valida la estacion y los textos; los endpoints antiguos de escritura y candado se han retirado. ----
    if (url.pathname === '/api/notes') {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const email = await verifySessionToken(token, env);
      if (!email) return json({ error: 'No autorizado' }, 401, env);
      if (request.method !== 'GET') return json({ error: 'Metodo no soportado' }, 405, env);
      const rows = await env.DB.prepare('SELECT * FROM station_notes').all();
      return json({ items: rows.results }, 200, env);
    }

    // ---- seguimiento de estaciones sin proveedor: a quien hemos contactado,
    // a quien hemos elegido y en que situacion esta la estacion ----
    if (url.pathname.startsWith('/api/tracking')) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const email = await verifySessionToken(token, env);
      if (!email) return json({ error: 'No autorizado' }, 401, env);

      const now = Math.floor(Date.now() / 1000);
      const role = await roleOfEmail(env, email);
      // consultar esta abierto a todos; cualquier cambio exige rol de usuario o administrador
      if (request.method !== 'GET' && role === 'viewer') return json({ error: READ_ONLY_MSG }, 403, env);
      const parts = url.pathname.split('/').filter(Boolean); // ['api','tracking', a, b]
      const CAND_STATUSES = ['identified', 'contacted', 'selected']; // pendiente | contactado | elegido
      const STAGES = ['none', 'searching', 'selected', 'interim', 'covered'];
      const codeRe = /^[A-Z0-9]{3,4}$/;

      const clean = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max);
      const logHistory = (code, action, value) => env.DB.prepare(
        'INSERT INTO station_note_history (station_code, action, value, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(code, action, value, email, now).run();

      async function stationExists(code) {
        if (!codeRe.test(code)) return false;
        const r = await env.DB.prepare('SELECT 1 FROM station_full WHERE code = ?').bind(code).first();
        return !!r;
      }
      const getNote = code => env.DB.prepare('SELECT * FROM station_notes WHERE station_code = ?').bind(code).first();
      async function ensureNote(code) {
        await env.DB.prepare(
          "INSERT INTO station_notes (station_code, note, covered, stage) VALUES (?, '', 0, 'none') ON CONFLICT(station_code) DO NOTHING"
        ).bind(code).run();
      }
      // La situacion se mueve sola (elegido -> 'selected'; alguno contactado -> 'searching'; ninguno -> 'none'),
      // salvo que se haya marcado a mano 'interim' o 'covered'. Las fases/estados del sistema anterior
      // (offer, negotiating, discarded) se interpretan como contactado / no contactado.
      async function recomputeStage(code) {
        await ensureNote(code);
        const note = await getNote(code);
        if (note.stage === 'interim' || note.stage === 'covered') return note.stage;
        const rows = await env.DB.prepare('SELECT status FROM station_candidates WHERE station_code = ?').bind(code).all();
        const st = rows.results.map(r => r.status);
        const next = st.includes('selected') ? 'selected'
          : st.some(s => s !== 'identified' && s !== 'discarded') ? 'searching'
          : 'none';
        if (next !== note.stage) {
          await env.DB.prepare('UPDATE station_notes SET stage = ?, covered = 0, updated_by = ?, updated_at = ? WHERE station_code = ?')
            .bind(next, email, now, code).run();
          await logHistory(code, 'stage', next);
        }
        return next;
      }
      async function snapshot(code) {
        const [note, cands] = await Promise.all([
          getNote(code),
          env.DB.prepare('SELECT * FROM station_candidates WHERE station_code = ? ORDER BY created_at ASC, id ASC').bind(code).all(),
        ]);
        return { note: note || null, candidates: cands.results };
      }
      // Solo puede haber un proveedor elegido: al elegir uno, el anterior pasa a "contactado".
      async function demoteOtherSelected(code, exceptId) {
        const prev = await env.DB.prepare(
          "SELECT id, provider_name FROM station_candidates WHERE station_code = ? AND status = 'selected' AND id != ?"
        ).bind(code, exceptId).all();
        for (const p of prev.results) {
          await env.DB.prepare("UPDATE station_candidates SET status = 'contacted', updated_by = ?, updated_at = ? WHERE id = ?")
            .bind(email, now, p.id).run();
          await logHistory(code, 'cand_status', `${p.provider_name}|contacted`);
        }
        return prev.results.map(p => p.provider_name);
      }

      // GET /api/tracking -> todas las notas de estacion + todos los proveedores registrados
      if (request.method === 'GET' && parts.length === 2) {
        const [notes, cands] = await Promise.all([
          env.DB.prepare('SELECT * FROM station_notes').all(),
          env.DB.prepare('SELECT * FROM station_candidates ORDER BY created_at ASC, id ASC').all(),
        ]);
        return json({ notes: notes.results, candidates: cands.results }, 200, env);
      }

      // PATCH/DELETE /api/tracking/candidates/:id
      if (parts[2] === 'candidates' && parts[3]) {
        const id = parseInt(parts[3], 10);
        if (!Number.isInteger(id)) return json({ error: 'Id no válido' }, 400, env);
        const cand = await env.DB.prepare('SELECT * FROM station_candidates WHERE id = ?').bind(id).first();
        if (!cand) return json({ error: 'Proveedor no encontrado' }, 404, env);

        if (request.method === 'DELETE') {
          await env.DB.prepare('DELETE FROM station_candidates WHERE id = ?').bind(id).run();
          await logHistory(cand.station_code, 'cand_remove', cand.provider_name);
          await recomputeStage(cand.station_code);
          return json({ ok: true, ...(await snapshot(cand.station_code)) }, 200, env);
        }
        if (request.method === 'PATCH') {
          const body = await request.json().catch(() => ({}));
          if (!CAND_STATUSES.includes(body.status)) return json({ error: 'Estado no válido' }, 400, env);
          let replaced = [];
          if (body.status === 'selected') replaced = await demoteOtherSelected(cand.station_code, id);
          if (body.status !== cand.status) {
            await env.DB.prepare('UPDATE station_candidates SET status = ?, updated_by = ?, updated_at = ? WHERE id = ?')
              .bind(body.status, email, now, id).run();
            await logHistory(cand.station_code, 'cand_status', `${cand.provider_name}|${body.status}`);
          }
          await recomputeStage(cand.station_code);
          return json({ ok: true, replaced, ...(await snapshot(cand.station_code)) }, 200, env);
        }
        return json({ error: 'Metodo no soportado' }, 405, env);
      }

      const code = (parts[2] || '').toUpperCase();
      const sub = parts[3] || null;
      if (!codeRe.test(code)) return json({ error: 'Estación no válida' }, 400, env);
      if (!(await stationExists(code))) return json({ error: 'Estación no encontrada' }, 404, env);

      // PATCH /api/tracking/:code -> situacion manual y/o nota
      if (request.method === 'PATCH' && !sub) {
        const body = await request.json().catch(() => ({}));
        await ensureNote(code);
        const cur = await getNote(code);

        if (body.stage !== undefined) {
          if (!STAGES.includes(body.stage)) return json({ error: 'Situación no válida' }, 400, env);
          // cerrar una estacion como "Cubierta", o reabrirla, es decision de un administrador
          if (body.stage !== cur.stage && (body.stage === 'covered' || cur.stage === 'covered') && role !== 'admin') {
            return json({ error: 'Solo los administradores pueden marcar una estación como cubierta o reabrirla.' }, 403, env);
          }
          if (body.stage !== cur.stage) {
            await env.DB.prepare('UPDATE station_notes SET stage = ?, covered = ?, updated_by = ?, updated_at = ? WHERE station_code = ?')
              .bind(body.stage, body.stage === 'covered' ? 1 : 0, email, now, code).run();
            await logHistory(code, 'stage', body.stage);
            // al volver a "sin gestionar" se recalcula segun a quien se haya contactado o elegido
            if (body.stage === 'none') await recomputeStage(code);
          }
        }
        if (body.note !== undefined) {
          const text = clean(body.note, 2000);
          if (text !== (cur.note || '')) {
            await env.DB.prepare('UPDATE station_notes SET note = ?, updated_by = ?, updated_at = ? WHERE station_code = ?')
              .bind(text, email, now, code).run();
            await logHistory(code, 'note', text);
          }
        }
        return json({ ok: true, ...(await snapshot(code)) }, 200, env);
      }

      // POST /api/tracking/:code/candidates -> apunta un proveedor (contactado / elegido / pendiente)
      if (request.method === 'POST' && sub === 'candidates') {
        const body = await request.json().catch(() => ({}));
        const name = clean(body.provider_name, 120);
        if (!name) return json({ error: 'Indica el nombre del proveedor' }, 400, env);
        const status = body.status === undefined ? 'identified' : body.status;
        if (!CAND_STATUSES.includes(status)) return json({ error: 'Estado no válido' }, 400, env);
        const dup = await env.DB.prepare(
          'SELECT id FROM station_candidates WHERE station_code = ? AND LOWER(provider_name) = LOWER(?)'
        ).bind(code, name).first();
        if (dup) return json({ error: 'Ese proveedor ya está apuntado en esta estación' }, 409, env);
        await ensureNote(code);
        const ins = await env.DB.prepare(
          'INSERT INTO station_candidates (station_code, provider_name, status, created_by, created_at, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(code, name, status, email, now, email, now).run();
        let replaced = [];
        if (status === 'selected') {
          const row = await env.DB.prepare('SELECT id FROM station_candidates WHERE station_code = ? AND LOWER(provider_name) = LOWER(?)').bind(code, name).first();
          replaced = await demoteOtherSelected(code, row.id);
        }
        await logHistory(code, 'cand_add', name);
        if (status !== 'identified') await logHistory(code, 'cand_status', `${name}|${status}`);
        await recomputeStage(code);
        return json({ ok: true, replaced, ...(await snapshot(code)) }, 200, env);
      }

      return json({ error: 'Metodo no soportado' }, 405, env);
    }

    // ---- gestion de usuarios: solo admin, siempre verificado contra la DB
    // (nunca contra nada que venga del cliente) ----
    if (url.pathname.startsWith('/api/admin-users')) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const email = await verifySessionToken(token, env);
      if (!email) return json({ error: 'No autorizado' }, 401, env);

      const me = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (roleOf(me) !== 'admin') return json({ error: 'No autorizado' }, 403, env);

      async function logUserAudit(targetEmail, action, detail) {
        await env.DB.prepare(
          'INSERT INTO user_audit (target_email, action, detail, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(targetEmail, action, detail || '', email, Math.floor(Date.now() / 1000)).run();
      }
      async function adminCount() {
        const r = await env.DB.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin = 1').first();
        return r.c;
      }
      function genTempPassword() {
        // 9 bytes hex = 18 caracteres, facil de copiar/pegar y de dictar por telefono
        return randomHex(9);
      }

      const parts = url.pathname.split('/').filter(Boolean); // ['api','admin-users', maybe email, maybe 'audit']
      const targetEmail = parts[2] ? decodeURIComponent(parts[2]).trim().toLowerCase() : null;
      const sub = parts[3] || null;

      // GET /api/admin-users -> lista (sin hash ni salt)
      if (request.method === 'GET' && !targetEmail) {
        const rows = await env.DB.prepare(
          'SELECT * FROM users ORDER BY created_at ASC'
        ).all();
        // nunca se envian el hash ni la sal; el rol se calcula igual que en el resto de comprobaciones
        return json({ items: rows.results.map(u => ({ email: u.email, role: roleOf(u), is_admin: roleOf(u) === 'admin', show_data_badge: u.show_data_badge, must_change_password: u.must_change_password || 0, created_at: u.created_at, updated_at: u.updated_at })) }, 200, env);
      }

      // GET /api/admin-users/audit -> historial reciente
      if (request.method === 'GET' && targetEmail === 'audit') {
        const rows = await env.DB.prepare(
          'SELECT * FROM user_audit ORDER BY changed_at DESC LIMIT 50'
        ).all();
        return json({ items: rows.results }, 200, env);
      }

      // POST /api/admin-users -> alta de usuario nuevo
      if (request.method === 'POST' && !targetEmail) {
        const body = await request.json().catch(() => ({}));
        const newEmail = String(body.email || '').trim().toLowerCase();
        if (!/^[a-z0-9._%+\-]+@iberia\.es$/.test(newEmail)) {
          return json({ error: 'Solo se admiten altas con correo @iberia.es (letras, números, punto o guion)' }, 400, env);
        }
        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(newEmail).first();
        if (existing) return json({ error: 'Ese usuario ya existe' }, 409, env);

        // rol: 'admin' | 'user' | 'viewer' (por defecto 'user'); se sigue aceptando is_admin por compatibilidad
        const newRole = body.role !== undefined ? body.role : (body.is_admin ? 'admin' : 'user');
        if (!ROLES.includes(newRole)) return json({ error: 'Rol no válido' }, 400, env);

        const tempPassword = genTempPassword();
        const salt = randomHex(16);
        const hash = await hashPassword(tempPassword, salt);
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare(
          'INSERT INTO users (email, salt, password_hash, show_data_badge, is_admin, role, must_change_password, password_changed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)'
        ).bind(newEmail, salt, hash, body.show_data_badge ? 1 : 0, newRole === 'admin' ? 1 : 0, newRole, Date.now(), now).run();
        await logUserAudit(newEmail, 'created', newRole);

        // La contraseña temporal solo se devuelve aqui, una vez; no se guarda en claro ni se reenvia.
        return json({ ok: true, email: newEmail, temp_password: tempPassword }, 200, env);
      }

      // A partir de aqui, todas las rutas operan sobre un usuario concreto
      if (targetEmail && targetEmail !== 'audit') {
        const targetRow = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(targetEmail).first();
        if (!targetRow && request.method !== 'DELETE') return json({ error: 'Usuario no encontrado' }, 404, env);

        // PATCH /api/admin-users/:email -> cambiar rol / show_data_badge / resetear contraseña
        if (request.method === 'PATCH') {
          const body = await request.json().catch(() => ({}));
          const now = Math.floor(Date.now() / 1000);

          const currentRole = roleOf(targetRow);
          let wantedRole = body.role;
          if (wantedRole === undefined && body.is_admin !== undefined) { // compatibilidad con el interruptor antiguo
            wantedRole = body.is_admin ? 'admin' : (currentRole === 'admin' ? 'user' : currentRole);
          }
          if (wantedRole !== undefined) {
            if (!ROLES.includes(wantedRole)) return json({ error: 'Rol no válido' }, 400, env);
            if (wantedRole !== currentRole) {
              if (targetEmail === email) {
                return json({ error: 'No puedes cambiar tu propio rol' }, 400, env);
              }
              if (currentRole === 'admin' && (await adminCount()) <= 1) {
                return json({ error: 'No puedes quitar el único administrador que queda' }, 400, env);
              }
              // las dos columnas siempre juntas: is_admin para "admin", role para user/viewer
              await env.DB.prepare('UPDATE users SET role = ?, is_admin = ?, updated_at = ? WHERE email = ?')
                .bind(wantedRole, wantedRole === 'admin' ? 1 : 0, now, targetEmail).run();
              await logUserAudit(targetEmail, 'role_changed', `${currentRole}>${wantedRole}`);
            }
          }

          if (body.show_data_badge !== undefined) {
            await env.DB.prepare('UPDATE users SET show_data_badge = ?, updated_at = ? WHERE email = ?')
              .bind(body.show_data_badge ? 1 : 0, now, targetEmail).run();
            await logUserAudit(targetEmail, body.show_data_badge ? 'badge_on' : 'badge_off', '');
          }

          if (body.reset_password) {
            if (targetEmail === email) {
              return json({ error: 'Para cambiar tu propia contraseña usa el botón «Contraseña» de la cabecera' }, 400, env);
            }
            const tempPassword = genTempPassword();
            const salt = randomHex(16);
            const hash = await hashPassword(tempPassword, salt);
            // la temporal obliga a elegir una nueva y cierra las sesiones que tuviera abiertas
            await env.DB.prepare('UPDATE users SET salt = ?, password_hash = ?, must_change_password = 1, password_changed_at = ?, updated_at = ? WHERE email = ?')
              .bind(salt, hash, Date.now(), now, targetEmail).run();
            // si se habia bloqueado por intentos fallidos, con la temporal puede entrar ya
            await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind('email:' + targetEmail).run();
            await logUserAudit(targetEmail, 'password_reset_by_admin', '');
            return json({ ok: true, temp_password: tempPassword }, 200, env);
          }

          return json({ ok: true }, 200, env);
        }

        // DELETE /api/admin-users/:email
        if (request.method === 'DELETE') {
          if (!targetRow) return json({ error: 'Usuario no encontrado' }, 404, env);
          if (targetEmail === email) {
            return json({ error: 'No puedes eliminar tu propia cuenta' }, 400, env);
          }
          if (targetRow.is_admin && (await adminCount()) <= 1) {
            return json({ error: 'No puedes eliminar al único administrador que queda' }, 400, env);
          }
          await env.DB.prepare('DELETE FROM users WHERE email = ?').bind(targetEmail).run();
          await logUserAudit(targetEmail, 'deleted', '');
          return json({ ok: true }, 200, env);
        }
      }

      return json({ error: 'Metodo no soportado' }, 405, env);
    }

    return json({ error: 'Not found' }, 404, env);
}
