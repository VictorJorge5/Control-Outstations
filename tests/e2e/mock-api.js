// Worker simulado para los tests e2e: misma forma de respuesta que worker/src/index.js.
export const API = 'https://control-estaciones-auth.victorjjm5.workers.dev';

const SCHEDULE = [
  ['15/SEP/2026', '1234567', 'IB3170', 'MAD', '4', '08:00', 'LHR', '5', '09:15', 'A320'],
  ['16/OCT/2026', '1234567', 'IB3171', 'LHR', '5', '10:15', 'MAD', '4', '13:30', 'A321'],
];
const station = (code, city, country, lat, lon, extra = {}) => ({
  code, city, country, lat, lon, name: city,
  providers: ['Swissport'],
  easa: [{ approval_number: 'UK.145.0001', vendor: 'IB_TEST', fleet: { CFM56: true }, contacts: [{ number: '+44 20 0000 0000', description: 'Ops 24h', main: true }] }],
  in_schedule: true, pending: false, flights: SCHEDULE.length, schedule: SCHEDULE,
  pernocta: true, pernocta_by_month: { '2026-10': 1 },
  pernocta_by_date: { '2026-10-16': [{ arr_flight: 'IB3170', arr_from: 'MAD', arr_from_time: '08:00', arr_to: 'LHR', arr_to_time: '09:15', dep_flight: 'IB3171', dep_from: 'LHR', dep_from_time: '10:15', dep_to: 'MAD', dep_to_time: '13:30' }] },
  alt_providers: [],
  ...extra,
});
export const STATIONS = [
  station('LHR', 'London', 'UK', 51.47, -0.45),
  station('CDG', 'Paris', 'France', 49.0, 2.55, { pending: true, providers: [] }),
  station('JFK', 'New York', 'USA', 40.64, -73.78, { in_schedule: false, flights: 0, schedule: [], pernocta: false, pernocta_by_month: {}, pernocta_by_date: {} }),
];
const ALT = [{ code: 'BOS', city: 'Boston', country: 'USA', lat: 42.36, lon: -71.0, providers: [{ supplier: 'Menzies' }] }];

const lite = s => {
  const out = { ...s, first_flight: s.schedule.length ? s.schedule[0][0] : null };
  delete out.schedule;
  delete out.pernocta_by_date;
  return out;
};

/**
 * Instala el Worker simulado en el contexto del navegador.
 * opts.legacy: se comporta como el Worker antiguo (ignora ?lite=1 y no tiene /api/station).
 * opts.role: rol del usuario que inicia sesion.
 * Devuelve la lista de llamadas ("GET /api/data?lite=1", ...).
 */
export async function mockApi(context, { legacy = false, role = 'admin' } = {}) {
  const calls = [];
  // sin red externa en los tests: teselas del mapa vacias
  await context.route('https://server.arcgisonline.com/**', r => r.fulfill({ status: 204 }));
  await context.route(API + '/**', route => {
    const req = route.request();
    const url = new URL(req.url());
    calls.push(`${req.method()} ${url.pathname}${url.search}`);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });

    const p = url.pathname;
    if (p === '/api/login') return reply({ token: 't', role, is_admin: role === 'admin', email: 'test@iberia.es', show_data_badge: true });
    if (p === '/api/me') return reply({ role, email: 'test@iberia.es' });
    if (p === '/api/data') {
      const useLite = !legacy && url.searchParams.get('lite') === '1';
      return reply({ stations: STATIONS.map(s => (useLite ? lite(s) : s)), alt_stations: ALT, pernocta_months: ['2026-10'] });
    }
    if (p.startsWith('/api/station/')) {
      if (legacy) return reply({ error: 'Not found' }, 404);
      const s = STATIONS.find(x => x.code === p.split('/').pop());
      return s ? reply({ code: s.code, schedule: s.schedule, pernocta_by_date: s.pernocta_by_date }) : reply({ error: 'Estación no encontrada' }, 404);
    }
    if (p === '/api/tracking') return reply({ notes: [], candidates: [] });
    if (p.startsWith('/api/admin-users')) return reply({ items: [] });
    return reply({ items: [] }); // notes, fcamo, activity
  });
  return calls;
}

// Inicia sesion y espera a que la app este visible
export async function login(page) {
  await page.goto('/');
  await page.fill('#login-email', 'test@iberia.es');
  await page.fill('#login-pass', 'contraseña-larga');
  await page.click('#login-form button[type=submit]');
  await page.waitForSelector('.app.visible');
}

// Recoge errores de JS y de consola para comprobar al final que no hay ninguno
export function collectErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}
