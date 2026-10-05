import { test, expect } from '@playwright/test';
import { mockApi, login, collectErrors, STATIONS } from './mock-api.js';

const isMobile = ({ isMobile }) => isMobile;

test.describe('acceso', () => {
  test('login, inicio y cierre de sesion @smoke', async ({ page, context }) => {
    const errors = collectErrors(page);
    const calls = await mockApi(context);
    await login(page);
    await expect(page).toHaveURL(/#inicio$/);
    expect(calls).toContain('GET /api/data?lite=1');
    // las fuentes se sirven desde el propio dominio
    expect(await page.evaluate(() => document.fonts.check('600 14px "IBM Plex Sans"'))).toBe(true);

    await page.click('#logout-btn');
    await expect(page.locator('#login-form')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ib_control_estaciones_auth'))).toBeNull();
    expect(errors).toEqual([]);
  });

  test('un 401 con la app abierta devuelve al login', async ({ page, context }) => {
    await mockApi(context);
    await login(page);
    await context.route('**/api/me', r => r.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"No autorizado"}' }));
    await page.reload();
    await expect(page.locator('#login-error')).toContainText('ya no es válida');
  });

  test('un usuario de solo consulta ve el aviso', async ({ page, context }) => {
    await mockApi(context, { role: 'viewer' });
    await login(page);
    await expect(page.locator('#home-role')).toContainText('solo consulta');
  });
});

test.describe('mapa y fichas', () => {
  test.skip(isMobile, 'flujo de escritorio');

  test('lista, marcadores y ficha cargando el horario bajo demanda', async ({ page, context }) => {
    const errors = collectErrors(page);
    const calls = await mockApi(context);
    await login(page);
    await page.evaluate(() => { location.hash = '#mapa'; });
    await expect(page.locator('.row')).toHaveCount(STATIONS.length);
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(STATIONS.length);
    expect(calls.filter(c => c.startsWith('GET /api/station/'))).toEqual([]);

    await page.locator('.row', { hasText: 'LHR' }).locator('.row-sched-btn').click();
    await expect(page.locator('#modal-overlay')).toHaveClass(/open/);
    await expect(page.locator('#modal-sub')).toContainText('2 movimientos');
    await page.click('.modal-tab[data-tab="sched"]');
    await expect(page.locator('#tab-sched .sg-row')).toHaveCount(2);

    // segunda apertura: ya esta en memoria, no se vuelve a pedir
    await page.click('#btn-close-modal');
    await page.locator('.row', { hasText: 'LHR' }).locator('.row-sched-btn').click();
    expect(calls.filter(c => c === 'GET /api/station/LHR')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('exporta el horario a Excel', async ({ page, context }) => {
    await mockApi(context);
    await login(page);
    await page.evaluate(() => { location.hash = '#mapa'; });
    await page.locator('.row', { hasText: 'LHR' }).locator('.row-sched-btn').click();
    await page.click('.modal-tab[data-tab="sched"]');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-download-xlsx')]);
    expect(download.suggestedFilename()).toBe('Iberia Flight Schedule - LHR.xlsx');
  });

  test('calendario de pernocta desde la ficha', async ({ page, context }) => {
    await mockApi(context);
    await login(page);
    await page.evaluate(() => { location.hash = '#mapa'; });
    await page.locator('.row', { hasText: 'LHR' }).locator('.row-sched-btn').click();
    await page.click('.modal-tab[data-tab="pernocta"]');
    await page.click('#tab-pernocta .pmatrix-cell');
    await expect(page.locator('#tab-pernocta .pcal-has')).toContainText('IB3170');
  });

  test('si falla la carga del horario avisa y no abre la ficha', async ({ page, context }) => {
    const errors = collectErrors(page);
    await mockApi(context);
    await context.route('**/api/station/**', r => r.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"Error interno"}' }));
    await login(page);
    await page.evaluate(() => { location.hash = '#mapa'; });
    await page.locator('.row', { hasText: 'LHR' }).locator('.row-sched-btn').click();
    await expect(page.locator('#trk-toast')).toContainText('Error interno');
    await expect(page.locator('.modal-overlay.open')).toHaveCount(0);
    expect(errors.filter(e => !e.includes('500'))).toEqual([]);
  });

  test('compatible con el Worker antiguo (sin ?lite=1)', async ({ page, context }) => {
    const errors = collectErrors(page);
    const calls = await mockApi(context, { legacy: true });
    await login(page);
    await page.evaluate(() => { location.hash = '#mapa'; });
    await page.locator('.row', { hasText: 'LHR' }).locator('.row-sched-btn').click();
    await page.click('.modal-tab[data-tab="sched"]');
    await expect(page.locator('#tab-sched .sg-row')).toHaveCount(2);
    expect(calls.filter(c => c.startsWith('GET /api/station/'))).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test('aviso de version nueva cuando cambia /version.json @smoke', async ({ page, context }) => {
  await mockApi(context);
  await page.goto('/');
  await context.route('**/version.json*', r => r.fulfill({ contentType: 'application/json', body: '{"build":"otra"}' }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('#update-banner')).toHaveClass(/open/);
});
