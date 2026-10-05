# Control de Estaciones · Outstations DTO

App de control de estaciones. El front-end es una app **React + TypeScript**
(Vite, Tailwind CSS, Motion) que se despliega en **Vercel**; el login y los
datos los sirve el Worker de Cloudflare `control-estaciones-auth` (carpeta
`worker/`), con una base de datos D1.

## Estructura

```
index.html                 punto de entrada (solo monta React)
src/main.tsx               arranque; src/app/legacy-links.ts redirige los enlaces antiguos (#mapa, #seguimiento/ABC)
src/app/                   router, Root (login / carga de datos / app), aviso de versión nueva
src/components/ui/         sistema de diseño: botones, tarjetas, diálogos, pestañas, interruptores...
src/components/layout/     barra lateral, barra superior, buscador global (Ctrl/⌘+K), cabeceras de página
src/features/              una carpeta por pantalla: auth, home, map, station (ficha), tracking,
                           fcamo, pernocta, activity, users
src/domain/                lógica sin interfaz: seguimiento, F-CAMO, flotas, estados, Excel
src/lib/                   API (api.ts), sesión (session.ts), datos con TanStack Query (queries.ts)
public/                    ficheros estáticos (favicon)
vercel.json                build, cabeceras de seguridad (CSP...), caché y rutas de la SPA
worker/                    Worker "control-estaciones-auth" (API + D1) con wrangler.toml, schema.sql y tests
support-worker/            Worker "outstations-support" (chatbot de soporte, Workers AI) con tests
tests/e2e/                 tests de Playwright contra el build de producción, con un Worker simulado con estado
```

Rutas: `/` inicio, `/mapa`, `/seguimiento[/ABC]`, `/fcamo[/nuevo|/papelera|/:id]`,
`/pernoctas`, `/actividad`, `/usuarios[/nuevo|/historial]`. La ficha de una
estación se abre encima de cualquier pantalla con `?estacion=ABC` (y `&tab=sched`
para ir a una pestaña), así que los enlaces se pueden compartir.

Cada pantalla se descarga en su propio chunk; el login solo carga lo mínimo y el
resto de la app se baja en paralelo con los datos. Leaflet, ExcelJS y las
fuentes (Inter, IBM Plex Mono) vienen de npm y se sirven desde el propio
dominio. ExcelJS (~250 kB gzip) solo se descarga al pulsar «Descargar Excel», y
el Excel que genera es idéntico al de la versión anterior.

### Carga de datos

Tras el login la app pide `/api/data?lite=1`: las estaciones **sin** horario ni
pernoctas día a día (era el 95 % de los ~4 MB). Ese detalle se pide con
`/api/station/:code` la primera vez que se abre la ficha o el calendario de
pernocta de una estación, y se queda en memoria. Si el Worker es antiguo e
ignora `lite=1`, todo sigue funcionando con los datos completos.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:5173
npm run lint
npm run typecheck
npm run test:worker  # tests de los dos Workers (SQLite real con worker/schema.sql)
npm run test:e2e     # build + vite preview con la CSP de vercel.json + Playwright
npm test             # todo lo anterior
```

`npm run test:e2e` necesita Chromium (`npx playwright install chromium`); si ya
tienes uno, `PW_CHROMIUM_PATH=/ruta/a/chrome npm run test:e2e`.

> El Worker solo acepta peticiones de los orígenes que tenga permitidos (CORS).
> Para probar en local con datos reales, añade `http://localhost:5173` a
> `ALLOWED_ORIGIN`.

### Variables de entorno del front

| Variable       | Uso                                    | Por defecto                                             |
| -------------- | -------------------------------------- | ------------------------------------------------------- |
| `VITE_API_URL` | URL del Worker (API de acceso y datos) | `https://control-estaciones-auth.victorjjm5.workers.dev` |

Si cambias la URL del Worker, actualiza también `connect-src` en la CSP de
`vercel.json`, o el navegador bloqueará las llamadas.

## Puesta en marcha en Vercel (orden recomendado)

1. **Vercel:** proyecto `control-outstations` creado y desplegado en
   https://control-outstations.vercel.app (configuración de `vercel.json`: Vite,
   `npm run build`, salida `dist/`). La protección de Vercel solo se aplica a las
   previews. Falta conectar el repo en *Settings → Git* para que `main` y las PR
   se desplieguen solas.
2. **Worker:** se despliega con el workflow «Deploy Workers» al fusionar en
   `main`. Es compatible con la web de GitHub Pages (sin `?lite=1` responde igual
   que antes).
3. **CORS:** `ALLOWED_ORIGIN` (GitHub Pages + Vercel) y `ALLOWED_ORIGIN_PATTERN`
   (previews de Vercel) están en `[vars]` de `worker/wrangler.toml` y se aplican
   en cada despliegue.
4. Probar en Vercel. Cuando todo funcione, poner `APP_URL` al dominio de Vercel
   (panel de Cloudflare), quitar GitHub Pages de `ALLOWED_ORIGIN` en
   `worker/wrangler.toml` y desactivar GitHub Pages.

Cada push a `main` despliega a producción; cada rama/PR tiene su propia URL de
previsualización.

## Workers (API y chatbot)

El código desplegado en Cloudflare está en `worker/` y `support-worker/`. A
partir de ahora se cambia aquí y se despliega desde el repo, no editándolo en el
panel:

```bash
cd worker            # o support-worker
npx wrangler login
npx wrangler deploy
```

Los `wrangler.toml` llevan `keep_vars = true`, así que un deploy no borra las
variables ni los secretos configurados en el panel.

**Despliegue automático:** el workflow `Deploy Workers` despliega los dos
Workers al cambiar `worker/**` o `support-worker/**` en `main` (o a mano desde
la pestaña Actions). En las PR hace un build de prueba y comprueba el token, sin
desplegar. Necesita en GitHub (Settings > Secrets and variables >
Actions) el secreto `CLOUDFLARE_API_TOKEN` (plantilla «Edit Cloudflare
Workers») y la variable `CLOUDFLARE_ACCOUNT_ID`. Sin ellos se salta con un aviso.

**Chatbot (`support-worker/`):** la base de conocimiento está en
`src/knowledge-base.js`. Limita las peticiones a 6 por minuto e IP y 30 por
minuto en total (bindings `ratelimits` de `wrangler.toml`), rechaza otros
orígenes y no devuelve detalles de errores internos.

## Aviso de versión nueva

Cada build genera `/version.json` con una marca única; las pestañas abiertas lo
consultan cada 5 minutos y, si cambia, muestran el aviso «Hay una versión más
reciente».
