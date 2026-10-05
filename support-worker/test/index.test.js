// Ejecutar: npm run test:worker
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const ORIGIN = 'https://victorjorge5.github.io';
const limiter = allowed => ({ limit: async () => ({ success: allowed }) });
const ai = (impl) => ({ run: impl });
const env = (over = {}) => ({ AI: ai(async () => ({ response: 'hola' })), PER_IP_LIMITER: limiter(true), GLOBAL_LIMITER: limiter(true), ...over });
const ask = (e, { origin = ORIGIN, body = { messages: [{ role: 'user', content: 'hi' }] } } = {}) =>
  worker.fetch(new Request('https://support.test/', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), e);

test('responde con la respuesta del modelo', async () => {
  const res = await ask(env());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { answer: 'hola' });
});

test('rechaza otros origenes sin llamar al modelo', async () => {
  let called = false;
  const res = await ask(env({ AI: ai(async () => { called = true; return { response: 'x' }; }) }), { origin: 'https://evil.example' });
  assert.equal(res.status, 403);
  assert.equal(called, false);
});

test('429 cuando se supera el limite por IP o global', async () => {
  assert.equal((await ask(env({ PER_IP_LIMITER: limiter(false) }))).status, 429);
  assert.equal((await ask(env({ GLOBAL_LIMITER: limiter(false) }))).status, 429);
});

test('sin bindings de limite sigue funcionando', async () => {
  assert.equal((await ask(env({ PER_IP_LIMITER: undefined, GLOBAL_LIMITER: undefined }))).status, 200);
});

test('no devuelve el detalle de los errores internos', async () => {
  const orig = console.error; console.error = () => {};
  const res = await ask(env({ AI: ai(async () => { throw new Error('secreto interno'); }) }));
  console.error = orig;
  assert.equal(res.status, 500);
  assert.ok(!JSON.stringify(await res.json()).includes('secreto'));
});

test('400 con un cuerpo no valido', async () => {
  assert.equal((await ask(env(), { body: { messages: [] } })).status, 400);
});
