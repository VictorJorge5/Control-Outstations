// Worker simulado para los tests e2e: misma forma de respuesta que worker/src/index.js y con
// estado en memoria (cada test empieza con datos limpios), para poder probar cambios de verdad.
// MOCK_DATA=/ruta/datos.json carga otro juego de estaciones (p. ej. a escala real) solo en local.
import { readFileSync } from 'node:fs';

export const API = 'https://control-estaciones-auth.victorjjm5.workers.dev';

const SCHEDULE = [
  ['15/SEP/2026', '1234567', 'IB3170', 'MAD', '4', '08:00', 'LHR', '5', '09:15', 'A320 NEO'],
  ['16/OCT/2026', '1234567', 'IB3171', 'LHR', '5', '10:15', 'MAD', '4', '13:30', 'A321 CEO'],
];
const station = (code, city, country, lat, lon, extra = {}) => ({
  code, city, country, lat, lon, name: city,
  providers: ['Swissport'],
  easa: [{ approval_number: 'UK.145.0001', vendor: 'IB_TEST', fleet: { CFM56: true, LEAP1A: true }, contacts: [{ number: '+44 20 0000 0000', description: 'Ops 24h', main: true }, { number: 'ops@swissport.test', description: 'Correo de operaciones' }] }],
  in_schedule: true, pending: false, flights: SCHEDULE.length, schedule: SCHEDULE,
  pernocta: true, pernocta_by_month: { '2026-10': 1 },
  pernocta_by_date: { '2026-10-16': [{ arr_flight: 'IB3170', arr_from: 'MAD', arr_from_time: '08:00', arr_to: code, arr_to_time: '09:15', dep_flight: 'IB3171', dep_from: code, dep_from_time: '10:15', dep_to: 'MAD', dep_to_time: '13:30' }] },
  alt_providers: [{ supplier: 'Menzies', easa: 'UK.145.0099', email: 'menzies@test', phone: '+44 1', fleet: { CFM56: true } }],
  ...extra,
});
export const STATIONS = [
  station('LHR', 'London', 'UK', 51.47, -0.45),
  station('CDG', 'Paris', 'France', 49.0, 2.55, { pending: true, providers: [], easa: [], alt_providers: [] }),
  station('JFK', 'New York', 'USA', 40.64, -73.78, { in_schedule: false, flights: 0, schedule: [], pernocta: false, pernocta_by_month: {}, pernocta_by_date: {} }),
];
const ALT = [
  { code: 'CDG', city: 'Paris', country: 'France', lat: 49.0, lon: 2.55, providers: [{ supplier: 'Aviapartner', easa: 'FR.145.0001', email: 'ops@aviapartner.test', phone: '+33 1', fleet: { CFM56: true } }, { supplier: 'WFS', fleet: {} }] },
  { code: 'BOS', city: 'Boston', country: 'USA', lat: 42.36, lon: -71.0, providers: [{ supplier: 'Menzies', fleet: { CFM56: true } }] },
];

const EXTERNAL = process.env.MOCK_DATA ? JSON.parse(readFileSync(process.env.MOCK_DATA, 'utf8')) : null;
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// horario y pernoctas inventados con el volumen de la estacion (solo para MOCK_DATA)
function syntheticDetails(s) {
  const schedule = [];
  const start = Date.UTC(2026, 8, 15);
  for (let i = 0; i < s.flights; i++) {
    const d = new Date(start + Math.floor((i / Math.max(1, s.flights)) * 194) * 86400000);
    const date = `${String(d.getUTCDate()).padStart(2, '0')}/${MON[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
    const out = i % 2 === 0;
    schedule.push([date, '1234567', `IB${3100 + (i % 80)}`, out ? 'MAD' : s.code, out ? '4S' : '1', `${String(7 + (i % 14)).padStart(2, '0')}:${i % 2 ? '35' : '05'}`, out ? s.code : 'MAD', out ? '1' : '4S', `${String(9 + (i % 12)).padStart(2, '0')}:20`, ['A320 NEO', 'A321 CEO', 'A350', 'A330 RR700'][i % 4]]);
  }
  const pernocta_by_date = {};
  Object.entries(s.pernocta_by_month || {}).forEach(([m, n]) => {
    for (let d = 1; d <= n; d++) pernocta_by_date[`${m}-${String(d).padStart(2, '0')}`] = [{ arr_flight: 'IB3170', arr_from: 'MAD', arr_from_time: '20:05', arr_to: s.code, arr_to_time: '22:30', dep_flight: 'IB3171', dep_from: s.code, dep_from_time: '07:15', dep_to: 'MAD', dep_to_time: '09:40' }];
  });
  return { code: s.code, schedule, pernocta_by_date };
}

const lite = s => {
  const out = { ...s, first_flight: s.schedule.length ? s.schedule[0][0] : null };
  delete out.schedule;
  delete out.pernocta_by_date;
  return out;
};
const now = () => Math.floor(Date.now() / 1000);

function initialState(role) {
  const t = now();
  return {
    me: { email: 'test@iberia.es', role },
    notes: [],
    candidates: [],
    nextCand: 1,
    fcamo: [{ id: 1, station_code: 'LHR', reason: 'opening', station_types: '["ETOPS"]', company_name: 'Swissport', easa_ref: 'UK.145.0001', easa_date: '', fleet_scope: '["A320 FAMILY"]', items_state: '{"amos_org_setup":true}', approved_by: '', approved_date: '', status: 'pending', created_by: 'ana@iberia.es', created_at: t - 3600, updated_at: t - 3600, deleted: 0 }],
    nextFcamo: 2,
    activity: [{ type: 'fcamo', station_code: 'LHR', action: 'created', fcamo_id: 1, changed_by: 'ana@iberia.es', changed_at: t - 3600 }],
    users: [
      { email: 'test@iberia.es', role, is_admin: role === 'admin', show_data_badge: 1, must_change_password: 0, created_at: t - 86400 * 30, updated_at: null },
      { email: 'ana@iberia.es', role: 'user', is_admin: false, show_data_badge: 0, must_change_password: 0, created_at: t - 86400 * 10, updated_at: null },
    ],
    audit: [{ id: 1, target_email: 'ana@iberia.es', action: 'created', detail: 'user', changed_by: 'test@iberia.es', changed_at: t - 86400 * 10 }],
  };
}

/**
 * Instala el Worker simulado en el contexto del navegador.
 * opts.legacy: se comporta como el Worker antiguo (ignora ?lite=1 y no tiene /api/station).
 * opts.role: rol del usuario que inicia sesion.
 * Devuelve { calls, state }: llamadas hechas ("GET /api/data?lite=1", ...) y el estado del servidor.
 */
export async function mockApi(context, { legacy = false, role = 'admin', mustChange = false } = {}) {
  const calls = [];
  const db = initialState(role);
  await context.route('https://server.arcgisonline.com/**', r => r.fulfill({ status: 204 }));
  await context.route(API + '/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    calls.push(`${method} ${url.pathname}${url.search}`);
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    const body = (() => { try { return JSON.parse(req.postData() || '{}'); } catch { return {}; } })();
    const p = url.pathname;
    const parts = p.split('/').filter(Boolean);
    const log = (code, action, value) => db.activity.unshift({ type: 'note', station_code: code, action, value, changed_by: db.me.email, changed_at: now() });

    if (p === '/api/login') {
      if (body.password === 'mala') return reply({ error: 'Usuario o contraseña incorrectos' }, 401);
      if (mustChange) return reply({ must_change: true, token: 'restricted', email: body.email });
      return reply({ token: 't', role, is_admin: role === 'admin', email: db.me.email, show_data_badge: true });
    }
    if (p === '/api/change-password') return reply({ ok: true, token: 't2', role, email: db.me.email, show_data_badge: true });
    if (p === '/api/me') return reply({ role, email: db.me.email });
    if (p === '/api/data') {
      if (EXTERNAL) return reply({ ...EXTERNAL, data_updated_at: 1789650015 });
      const useLite = !legacy && url.searchParams.get('lite') === '1';
      return reply({ stations: STATIONS.map(s => (useLite ? lite(s) : s)), alt_stations: ALT, pernocta_months: ['2026-09', '2026-10', '2026-11'], data_updated_at: 1789650015 });
    }
    if (p.startsWith('/api/station/')) {
      if (legacy) return reply({ error: 'Not found' }, 404);
      if (EXTERNAL) {
        const s = EXTERNAL.stations.find(x => x.code === parts[2]);
        return s ? reply(syntheticDetails(s)) : reply({ error: 'Estación no encontrada' }, 404);
      }
      const s = STATIONS.find(x => x.code === parts[2]);
      return s ? reply({ code: s.code, schedule: s.schedule, pernocta_by_date: s.pernocta_by_date }) : reply({ error: 'Estación no encontrada' }, 404);
    }
    if (p === '/api/notes') return reply({ items: db.notes });
    if (p === '/api/activity') return reply({ items: db.activity });

    // ---- seguimiento ----
    if (p.startsWith('/api/tracking')) {
      if (method !== 'GET' && role === 'viewer') return reply({ error: 'Tu usuario es de solo consulta: no puede modificar datos.' }, 403);
      const snapshot = code => ({ ok: true, note: db.notes.find(n => n.station_code === code) || null, candidates: db.candidates.filter(c => c.station_code === code) });
      const ensureNote = code => {
        let n = db.notes.find(x => x.station_code === code);
        if (!n) { n = { station_code: code, note: '', covered: 0, stage: 'none', updated_by: '', updated_at: null }; db.notes.push(n); }
        return n;
      };
      const recompute = code => {
        const n = ensureNote(code);
        if (n.stage === 'interim' || n.stage === 'covered') return;
        const st = db.candidates.filter(c => c.station_code === code).map(c => c.status);
        n.stage = st.includes('selected') ? 'selected' : st.some(s => s !== 'identified') ? 'searching' : 'none';
      };
      const demote = (code, exceptId) => db.candidates.filter(c => c.station_code === code && c.status === 'selected' && c.id !== exceptId).map(c => { c.status = 'contacted'; return c.provider_name; });
      if (method === 'GET' && parts.length === 2) return reply({ notes: db.notes, candidates: db.candidates });
      if (parts[2] === 'candidates') {
        const c = db.candidates.find(x => x.id === Number(parts[3]));
        if (!c) return reply({ error: 'Proveedor no encontrado' }, 404);
        if (method === 'DELETE') { db.candidates = db.candidates.filter(x => x !== c); log(c.station_code, 'cand_remove', c.provider_name); recompute(c.station_code); return reply(snapshot(c.station_code)); }
        const replaced = body.status === 'selected' ? demote(c.station_code, c.id) : [];
        c.status = body.status; log(c.station_code, 'cand_status', `${c.provider_name}|${body.status}`); recompute(c.station_code);
        return reply({ ...snapshot(c.station_code), replaced });
      }
      const code = parts[2];
      if (method === 'PATCH') {
        const n = ensureNote(code);
        if (body.stage !== undefined) {
          if ((body.stage === 'covered' || n.stage === 'covered') && body.stage !== n.stage && role !== 'admin') return reply({ error: 'Solo los administradores pueden marcar una estación como cubierta o reabrirla.' }, 403);
          n.stage = body.stage; n.covered = body.stage === 'covered' ? 1 : 0; log(code, 'stage', body.stage);
          if (body.stage === 'none') recompute(code);
        }
        if (body.note !== undefined) { n.note = body.note; n.updated_by = db.me.email; n.updated_at = now(); log(code, 'note', body.note); }
        return reply(snapshot(code));
      }
      if (method === 'POST' && parts[3] === 'candidates') {
        if (db.candidates.some(c => c.station_code === code && c.provider_name.toLowerCase() === String(body.provider_name).toLowerCase())) return reply({ error: 'Ese proveedor ya está apuntado en esta estación' }, 409);
        const c = { id: db.nextCand++, station_code: code, provider_name: body.provider_name, status: body.status || 'identified', created_by: db.me.email, created_at: now(), updated_by: db.me.email, updated_at: now() };
        db.candidates.push(c); ensureNote(code);
        const replaced = c.status === 'selected' ? demote(code, c.id) : [];
        log(code, 'cand_add', c.provider_name); recompute(code);
        return reply({ ...snapshot(code), replaced });
      }
    }

    // ---- F-CAMO ----
    if (p.startsWith('/api/fcamo')) {
      const sub = parts[2];
      const flog = (f, action) => db.activity.unshift({ type: 'fcamo', station_code: f.station_code, action, fcamo_id: f.id, changed_by: db.me.email, changed_at: now() });
      if (method === 'GET' && !sub) return reply({ items: db.fcamo.filter(f => !f.deleted) });
      if (method === 'GET' && sub === 'trash') return reply({ items: db.fcamo.filter(f => f.deleted) });
      if (method === 'POST' && !sub) {
        if (role === 'viewer') return reply({ error: 'Solo consulta' }, 403);
        const f = { id: db.nextFcamo++, station_code: body.station_code, reason: body.reason, station_types: JSON.stringify(body.station_types || []), company_name: body.company_name || '', easa_ref: body.easa_ref || '', easa_date: body.easa_date || '', fleet_scope: JSON.stringify(body.fleet_scope || []), items_state: '{}', approved_by: '', approved_date: '', status: 'pending', created_by: db.me.email, created_at: now(), updated_at: now(), deleted: 0 };
        db.fcamo.push(f); flog(f, 'created');
        return reply({ item: f });
      }
      const f = db.fcamo.find(x => x.id === Number(sub));
      if (!f) return reply({ error: 'No encontrado' }, 404);
      if (method === 'GET') return reply({ item: f });
      if (method === 'POST' && parts[3] === 'restore') { f.deleted = 0; flog(f, 'restored'); return reply({ item: f }); }
      if (method === 'PATCH') {
        if (body.items_state) f.items_state = JSON.stringify(body.items_state);
        if (body.status && body.status !== f.status) { f.status = body.status; flog(f, body.status === 'completed' ? 'completed' : 'reopened'); }
        f.updated_at = now();
        return reply({ item: f });
      }
      if (method === 'DELETE') { f.deleted = 1; f.deleted_by = db.me.email; f.deleted_at = now(); flog(f, 'deleted'); return reply({ ok: true }); }
    }

    // ---- usuarios ----
    if (p.startsWith('/api/admin-users')) {
      if (role !== 'admin') return reply({ error: 'No autorizado' }, 403);
      const target = parts[2] ? decodeURIComponent(parts[2]) : null;
      if (method === 'GET' && !target) return reply({ items: db.users });
      if (method === 'GET' && target === 'audit') return reply({ items: db.audit });
      if (method === 'POST') {
        if (!/@iberia\.es$/.test(body.email)) return reply({ error: 'Solo se admiten altas con correo @iberia.es (letras, números, punto o guion)' }, 400);
        db.users.push({ email: body.email, role: body.role, is_admin: body.role === 'admin', show_data_badge: body.show_data_badge ? 1 : 0, must_change_password: 1, created_at: now(), updated_at: null });
        return reply({ ok: true, email: body.email, temp_password: 'temp-abc123def456' });
      }
      const u = db.users.find(x => x.email === target);
      if (!u) return reply({ error: 'Usuario no encontrado' }, 404);
      if (method === 'PATCH') {
        if (body.role) { u.role = body.role; u.is_admin = body.role === 'admin'; }
        if (body.show_data_badge !== undefined) u.show_data_badge = body.show_data_badge ? 1 : 0;
        u.updated_at = now();
        if (body.reset_password) { u.must_change_password = 1; return reply({ ok: true, temp_password: 'temp-reset-987654' }); }
        return reply({ ok: true });
      }
      if (method === 'DELETE') { db.users = db.users.filter(x => x !== u); return reply({ ok: true }); }
    }
    return reply({ error: 'Not found' }, 404);
  });
  return { calls, state: db };
}

// Inicia sesion y espera a que la app este visible
export async function login(page, path = '/') {
  await page.goto(path);
  await page.fill('#login-email', 'test@iberia.es');
  await page.fill('#login-pass', 'contraseña-larga');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByTestId('open-search').waitFor();
}

// Recoge errores de JS y de consola para comprobar al final que no hay ninguno
export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}
