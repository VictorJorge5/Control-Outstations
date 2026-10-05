// Tests del Worker contra una SQLite real con el esquema de la D1 (worker/schema.sql).
// Ejecutar: npm run test:worker
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';

const SCHEMA = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const API = 'https://api.test';
const PAGES = 'https://victorjorge5.github.io';
const VERCEL = 'https://control-outstations.vercel.app';

// Adaptador minimo con la misma forma que el binding D1 (prepare/bind/first/all/run/batch)
function fakeD1(db) {
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => {
      const r = db.prepare(sql).run(...args);
      return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } };
    },
  });
  return { prepare: sql => stmt(sql), batch: async list => Promise.all(list.map(s => s.run())) };
}

async function pbkdf2Hex(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return Buffer.from(bits).toString('hex');
}

const SCHEDULE = [
  ['16/OCT/2026', '1', 'IB3171', 'LHR', '5', '10:15', 'MAD', '4', '13:30', 'A321'],
  ['15/SEP/2026', '1', 'IB3170', 'MAD', '4', '08:00', 'LHR', '5', '09:15', 'A320'],
];
const LHR = { code: 'LHR', city: 'London', country: 'UK', providers: ['Swissport'], flights: 2, schedule: SCHEDULE, pernocta_by_date: { '2026-10-01': [{}] }, pernocta_by_month: { '2026-10': 1 } };

let env;
async function call(path, { method = 'GET', token, body, origin = PAGES } = {}) {
  const headers = { Origin: origin };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(new Request(API + path, { method, headers, body: body && JSON.stringify(body) }), env);
  return { status: res.status, cors: res.headers.get('access-control-allow-origin'), data: await res.json().catch(() => null) };
}
async function login(email) {
  const r = await call('/api/login', { method: 'POST', body: { email, password: 'contraseña-larga' } });
  assert.equal(r.status, 200);
  return r.data.token;
}

beforeEach(async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const salt = '0123456789abcdef0123456789abcdef';
  const hash = await pbkdf2Hex('contraseña-larga', salt);
  const addUser = db.prepare('INSERT INTO users (email, salt, password_hash, created_at, is_admin, role) VALUES (?, ?, ?, 0, ?, ?)');
  addUser.run('admin@iberia.es', salt, hash, 1, 'admin');
  addUser.run('user@iberia.es', salt, hash, 0, 'user');
  db.prepare('INSERT INTO station_full (code, data, updated_at) VALUES (?, ?, 0)').run('LHR', JSON.stringify(LHR));
  db.prepare("INSERT INTO app_meta (key, value) VALUES ('pernocta_months', '[\"2026-10\"]')").run();
  db.prepare("INSERT INTO fcamo_checklists (station_code, reason, created_by, created_at, deleted) VALUES ('LHR', 'opening', 'x', 0, 1)").run();
  env = { DB: fakeD1(db), AUTH_SECRET: 'test-secret', ALLOWED_ORIGIN: `${PAGES}, ${VERCEL}/`, APP_URL: `${PAGES}/Control-Outstations/` };
});

test('CORS: responde con el origen de la peticion si esta en la lista', async () => {
  assert.equal((await call('/api/health', { origin: VERCEL })).cors, VERCEL);
  assert.equal((await call('/api/health', { origin: PAGES })).cors, PAGES);
  assert.equal((await call('/api/health', { origin: 'https://evil.example' })).cors, PAGES);
});

test('CORS: con un solo origen configurado se comporta como antes', async () => {
  env.ALLOWED_ORIGIN = PAGES;
  assert.equal((await call('/api/health', { origin: VERCEL })).cors, PAGES);
  delete env.ALLOWED_ORIGIN; delete env.APP_URL;
  assert.equal((await call('/api/health')).cors, 'null');
});

test('CORS: las previews de Vercel entran por ALLOWED_ORIGIN_PATTERN', async () => {
  env.ALLOWED_ORIGIN_PATTERN = '^https://control-outstations-[a-z0-9-]+-victorjorge5s-projects\\.vercel\\.app$';
  const preview = 'https://control-outstations-git-rama-victorjorge5s-projects.vercel.app';
  assert.equal((await call('/api/health', { origin: preview })).cors, preview);
  assert.equal((await call('/api/health', { origin: 'https://control-outstations-x-otro.vercel.app' })).cors, PAGES);
  assert.equal((await call('/api/health', { origin: preview + '.evil.example' })).cors, PAGES);
  env.ALLOWED_ORIGIN_PATTERN = 'vercel'; // sin anclar: se ignora
  assert.equal((await call('/api/health', { origin: preview })).cors, PAGES);
});

test('/api/data sin lite devuelve las estaciones completas (front antiguo)', async () => {
  const { status, data } = await call('/api/data', { token: await login('user@iberia.es') });
  assert.equal(status, 200);
  assert.deepEqual(data.stations[0].schedule, SCHEDULE);
  assert.deepEqual(data.pernocta_months, ['2026-10']);
});

test('/api/data?lite=1 quita horario y pernoctas por dia y calcula el primer vuelo', async () => {
  const { data } = await call('/api/data?lite=1', { token: await login('user@iberia.es') });
  const s = data.stations[0];
  assert.equal(s.schedule, undefined);
  assert.equal(s.pernocta_by_date, undefined);
  assert.equal(s.first_flight, '15/SEP/2026'); // el minimo, no la primera fila
  assert.deepEqual(s.pernocta_by_month, { '2026-10': 1 });
});

test('/api/station/:code devuelve el detalle y exige sesion', async () => {
  assert.equal((await call('/api/station/LHR')).status, 401);
  const token = await login('user@iberia.es');
  const ok = await call('/api/station/lhr', { token });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.data, { code: 'LHR', schedule: SCHEDULE, pernocta_by_date: { '2026-10-01': [{}] } });
  assert.equal((await call('/api/station/XXX', { token })).status, 404);
  assert.equal((await call('/api/station/..%2Fadmin', { token })).status, 400);
});

test('F-CAMO borrado: solo lo ve un administrador', async () => {
  assert.equal((await call('/api/fcamo/1', { token: await login('user@iberia.es') })).status, 404);
  const admin = await call('/api/fcamo/1', { token: await login('admin@iberia.es') });
  assert.equal(admin.status, 200);
  assert.equal(admin.data.item.deleted, 1);
});
