import { test, expect } from '@playwright/test';
import { mockApi, login, collectErrors, STATIONS } from './mock-api.js';


test.describe('acceso', () => {
  test('login, portada y cierre de sesion @smoke', async ({ page, context, isMobile }) => {
    const errors = collectErrors(page);
    const { calls } = await mockApi(context);
    await login(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Test');
    expect(calls).toContain('GET /api/data?lite=1');
    await expect(page.getByTestId('kpi-uncovered')).toContainText('1');
    // fuentes servidas desde el propio dominio
    expect(await page.evaluate(() => document.fonts.check('600 14px "Inter Variable"'))).toBe(true);

    if (isMobile) await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('button', { name: 'Menú de usuario' }).last().click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page.locator('#login-email')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ib_control_estaciones_auth'))).toBeNull();
    expect(errors).toEqual([]);
  });

  test('contraseña incorrecta muestra el error', async ({ page, context }) => {
    await mockApi(context);
    await page.goto('/');
    await page.fill('#login-email', 'test@iberia.es');
    await page.fill('#login-pass', 'mala');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByTestId('login-notice')).toContainText('incorrectos');
  });

  test('contraseña temporal: hay que elegir una nueva para entrar', async ({ page, context }) => {
    const { calls } = await mockApi(context, { mustChange: true });
    await page.goto('/');
    await page.fill('#login-email', 'test@iberia.es');
    await page.fill('#login-pass', 'temporal-123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Elige tu contraseña' })).toBeVisible();
    await page.fill('#pw-new1', 'corta');
    await page.fill('#pw-new2', 'corta');
    await page.getByRole('button', { name: 'Guardar y entrar' }).click();
    await expect(page.getByTestId('login-notice')).toContainText('al menos 10');
    await page.fill('#pw-new1', 'una-contraseña-larga');
    await page.fill('#pw-new2', 'una-contraseña-larga');
    await page.getByRole('button', { name: 'Guardar y entrar' }).click();
    await page.getByRole('navigation', { name: 'Principal' }).first().waitFor();
    expect(calls).toContain('POST /api/change-password');
  });

  test('un 401 con la app abierta devuelve al login con aviso', async ({ page, context }) => {
    await mockApi(context);
    await login(page);
    await context.route('**/api/me', r => r.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"No autorizado"}' }));
    await page.reload();
    await expect(page.getByTestId('login-notice')).toContainText('ya no es válida');
  });

  test('usuario de solo consulta: aviso y sin acciones de escritura', async ({ page, context }) => {
    await mockApi(context, { role: 'viewer' });
    await login(page);
    await expect(page.locator('#home-role')).toContainText('solo consulta');
    await page.goto('/seguimiento/CDG');
    await expect(page.getByText('Solo consulta: puedes ver el seguimiento')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Elegir' })).toHaveCount(0);
    await page.goto('/fcamo');
    await expect(page.getByRole('button', { name: 'Nuevo F-CAMO' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  });

  test('los enlaces antiguos (#seguimiento/CDG) siguen funcionando', async ({ page, context }) => {
    await mockApi(context);
    await login(page, '/#seguimiento/CDG');
    await expect(page).toHaveURL(/\/seguimiento\/CDG$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Paris');
  });
});

test.describe('mapa y ficha de estación', () => {
  test.skip(({ isMobile }) => isMobile, 'flujo de escritorio');

  test('lista, marcadores y ficha que carga el horario bajo demanda', async ({ page, context }) => {
    const errors = collectErrors(page);
    const { calls } = await mockApi(context);
    await login(page, '/mapa');
    await expect(page.getByTestId('station-row')).toHaveCount(STATIONS.length);
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(STATIONS.length);
    expect(calls.filter(c => c.startsWith('GET /api/station/'))).toEqual([]);

    await page.locator('[data-testid=station-row][data-code=LHR] [data-testid=open-station]').click();
    await expect(page.getByTestId('sheet-code')).toHaveText('LHR');
    await expect(page).toHaveURL(/estacion=LHR/);
    await page.getByRole('tab', { name: /Programación/ }).click();
    await expect(page.getByTestId('schedule-row')).toHaveCount(2);

    // cerrar y volver a abrir: el horario ya esta en memoria
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('sheet-code')).toHaveCount(0);
    await page.locator('[data-testid=station-row][data-code=LHR] [data-testid=open-station]').click();
    await page.getByRole('tab', { name: /Programación/ }).click();
    await expect(page.getByTestId('schedule-row')).toHaveCount(2);
    expect(calls.filter(c => c === 'GET /api/station/LHR')).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('exporta el horario a Excel', async ({ page, context }) => {
    await mockApi(context);
    await login(page, '/mapa?estacion=LHR');
    await expect(page.getByTestId('download-xlsx')).toBeEnabled();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-xlsx').click()]);
    expect(download.suggestedFilename()).toBe('Iberia Flight Schedule - LHR.xlsx');
  });

  test('calendario de pernocta desde la ficha', async ({ page, context }) => {
    await mockApi(context);
    await login(page, '/mapa?estacion=LHR&tab=pernocta');
    await page.getByTestId('pernocta-cell').first().click();
    await expect(page.getByTestId('pernocta-calendar')).toContainText('IB3170');
  });

  test('si falla la carga del horario lo dice dentro de la ficha', async ({ page, context }) => {
    await mockApi(context);
    await context.route('**/api/station/**', r => r.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"error":"Error interno"}' }));
    await login(page, '/mapa?estacion=LHR&tab=sched');
    await expect(page.getByTestId('details-error')).toContainText('Error interno', { timeout: 15000 });
  });

  test('compatible con el Worker antiguo (sin ?lite=1)', async ({ page, context }) => {
    const errors = collectErrors(page);
    const { calls } = await mockApi(context, { legacy: true });
    await login(page, '/mapa?estacion=LHR&tab=sched');
    await expect(page.getByTestId('schedule-row')).toHaveCount(2);
    expect(calls.filter(c => c.startsWith('GET /api/station/'))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('modo proveedores no contratados y su detalle', async ({ page, context }) => {
    await mockApi(context);
    await login(page, '/mapa');
    await page.getByRole('tab', { name: 'No contratados' }).click();
    await expect(page.getByTestId('station-row')).toHaveCount(2);
    await page.locator('[data-testid=station-row][data-code=CDG] [data-testid=open-station]').click();
    await expect(page.getByRole('dialog')).toContainText('Aviapartner');
  });

  test('buscador con sugerencias filtra la lista', async ({ page, context }) => {
    await mockApi(context);
    await login(page, '/mapa');
    await page.getByTestId('map-search').fill('swiss');
    await page.getByRole('listbox').getByRole('option', { name: /Swissport/ }).click();
    await expect(page.getByTestId('station-row')).toHaveCount(2);
    await expect(page.getByTestId('list-count')).toContainText('2');
    await page.getByRole('button', { name: 'Limpiar' }).click();
    await expect(page.getByTestId('station-row')).toHaveCount(3);
  });

  test('buscador global (Ctrl+K) abre la ficha de una estación', async ({ page, context }) => {
    await mockApi(context);
    await login(page);
    await page.keyboard.press('Control+k');
    await page.keyboard.type('LHR');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('sheet-code')).toHaveText('LHR');
  });
});

test.describe('seguimiento', () => {
  test.skip(({ isMobile }) => isMobile, 'flujo de escritorio');

  test('elegir proveedor cambia el estado y lo refleja en la portada', async ({ page, context }) => {
    const { state } = await mockApi(context);
    await login(page, '/seguimiento');
    await expect(page.getByTestId('tracking-row')).toHaveCount(1);
    await page.getByTestId('tracking-row').click();
    await expect(page).toHaveURL(/\/seguimiento\/CDG$/);
    await page.locator('[data-testid=trk-provider][data-name=Aviapartner]').getByRole('button', { name: 'Elegir' }).click();
    await expect(page.getByTestId('trk-chosen')).toHaveText('Aviapartner');
    await expect(page.locator('[data-stage=selected]').first()).toBeVisible();
    expect(state.candidates.map(c => [c.provider_name, c.status])).toEqual([['Aviapartner', 'selected']]);

    await page.getByRole('textbox', { name: 'Notas' }).fill('Contrato en firma');
    await page.getByRole('button', { name: 'Guardar notas' }).click();
    await expect(page.getByText('Notas guardadas')).toBeVisible();
    expect(state.notes[0].note).toBe('Contrato en firma');
  });

  test('añadir un proveedor fuera del listado y quitarlo', async ({ page, context }) => {
    const { state } = await mockApi(context);
    await login(page, '/seguimiento/CDG');
    await page.getByRole('textbox', { name: 'Nombre del proveedor' }).fill('Local Handling SA');
    await page.getByRole('button', { name: 'Añadir' }).click();
    await expect(page.locator('[data-testid=trk-provider][data-name="Local Handling SA"]')).toBeVisible();
    await page.getByRole('button', { name: 'Quitar Local Handling SA de la lista' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Quitar' }).click();
    await expect(page.locator('[data-testid=trk-provider][data-name="Local Handling SA"]')).toHaveCount(0);
    expect(state.candidates).toEqual([]);
  });

  test('marcar como cubierta pide confirmación', async ({ page, context }) => {
    const { state } = await mockApi(context);
    await login(page, '/seguimiento/CDG');
    await page.getByRole('button', { name: 'Cubierta', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('¿Marcar CDG como cubierta?');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
    expect(state.notes.length).toBe(0);
    await page.getByRole('button', { name: 'Cubierta', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar como cubierta' }).click();
    await expect.poll(() => state.notes[0]?.stage).toBe('covered');
  });
});

test.describe('F-CAMO', () => {
  test.skip(({ isMobile }) => isMobile, 'flujo de escritorio');

  test('marcar un punto se guarda solo', async ({ page, context }) => {
    const { state } = await mockApi(context);
    await login(page, '/fcamo');
    await page.getByTestId('fcamo-row').click();
    await expect(page.getByTestId('fcamo-progress')).toHaveText('1/21');
    await page.getByText('Station contacts created / updated (APN 53)').click();
    await expect(page.getByTestId('fcamo-progress')).toHaveText('2/21');
    await expect(page.getByTestId('save-state')).toContainText('Guardado');
    expect(JSON.parse(state.fcamo[0].items_state)).toEqual({ amos_org_setup: true, amos_contacts: true });
  });

  test('crear, eliminar y restaurar', async ({ page, context }) => {
    const { state } = await mockApi(context);
    await login(page, '/fcamo');
    await page.getByRole('button', { name: 'Nuevo F-CAMO' }).click();
    await page.getByLabel('IATA Code').selectOption('CDG');
    await page.getByText('On call').click();
    await page.getByRole('button', { name: 'Crear F-CAMO-IBE-14' }).click();
    await expect(page).toHaveURL(/\/fcamo\/2$/);
    // On call oculta las secciones de personal y "Addition"
    await expect(page.getByTestId('fcamo-progress')).toHaveText('0/16');

    await page.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click();
    await expect(page).toHaveURL(/\/fcamo$/);
    await page.getByRole('button', { name: 'Papelera' }).click();
    await page.getByRole('button', { name: 'Restaurar' }).click();
    await expect.poll(() => state.fcamo[1].deleted).toBe(0);
  });
});

test.describe('usuarios y actividad', () => {
  test.skip(({ isMobile }) => isMobile, 'flujo de escritorio');

  test('alta de usuario muestra la contraseña temporal una vez', async ({ page, context }) => {
    const { state } = await mockApi(context);
    await login(page, '/usuarios');
    await expect(page.getByTestId('user-row')).toHaveCount(2);
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    await page.getByLabel('Correo @iberia.es').fill('nuevo.usuario@iberia.es');
    await page.getByRole('radio', { name: /Consulta/ }).click();
    await page.getByRole('button', { name: 'Crear usuario' }).click();
    await expect(page.getByTestId('temp-password')).toHaveText('temp-abc123def456');
    expect(state.users.find(u => u.email === 'nuevo.usuario@iberia.es').role).toBe('viewer');
    await page.getByRole('button', { name: 'Hecho' }).click();
    await expect(page.getByTestId('user-row')).toHaveCount(3);
  });

  test('restablecer contraseña de otro usuario', async ({ page, context }) => {
    await mockApi(context);
    await login(page, '/usuarios');
    await page.getByRole('button', { name: 'Restablecer contraseña de ana@iberia.es' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restablecer' }).click();
    await expect(page.getByTestId('temp-password')).toHaveText('temp-reset-987654');
  });

  test('actividad reciente enlaza al F-CAMO', async ({ page, context }) => {
    await mockApi(context);
    await login(page, '/actividad');
    await page.getByTestId('activity-item').first().click();
    await expect(page).toHaveURL(/\/fcamo\/1$/);
  });
});

test('navegación móvil por el menú lateral @smoke', async ({ page, context, isMobile }) => {
  test.skip(!isMobile, 'solo móvil');
  await mockApi(context);
  await login(page);
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Sin proveedor' }).click();
  await expect(page).toHaveURL(/\/seguimiento$/);
  await expect(page.getByTestId('tracking-row')).toHaveCount(1);
});

test('aviso de versión nueva cuando cambia /version.json @smoke', async ({ page, context }) => {
  await mockApi(context);
  await page.goto('/');
  await context.route('**/version.json*', r => r.fulfill({ contentType: 'application/json', body: '{"build":"otra"}' }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByTestId('update-banner')).toBeVisible();
});
