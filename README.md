# Control de Estaciones · Outstations DTO

App de control de estaciones. El front-end es una app Vite (HTML + JS sin
framework) que se despliega en **Vercel**; el login y los datos los sirve el
Worker de Cloudflare `control-estaciones-auth` (carpeta `worker/`), con una
base de datos D1.

## Estructura

```
index.html          marcado (login, cabecera, mapa, modales)
src/main.js         acceso: login, sesión, roles, rutas (#inicio, #mapa, #seguimiento)
src/app.js          la app (mapa, listas, fichas, F-CAMO, seguimiento, Excel).
                    Se carga en un chunk aparte SOLO tras el login, cuando ya hay datos.
src/data.js         datos devueltos por /api/data (estaciones, alternativos, pernoctas)
src/styles.css      estilos
public/             ficheros estáticos (favicon)
vercel.json         build, cabeceras de seguridad (CSP...) y caché
worker/             Worker "control-estaciones-auth" (API + D1) con wrangler.toml, schema.sql y tests
support-worker/     Worker "outstations-support" (chatbot de soporte, Workers AI) con tests
tests/e2e/          tests de Playwright contra el build de producción, con el Worker simulado
```

Leaflet, ExcelJS y las fuentes IBM Plex vienen de npm y se sirven desde el
propio dominio (ya no hay CDNs ni Google Fonts). ExcelJS (~250 kB gzip) solo se
descarga al pulsar «Descargar Excel».

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

1. **Desplegar el Worker nuevo** (`worker/`). Es compatible con la web actual de
   GitHub Pages: sin `?lite=1` responde igual que antes.
   - Antes, comprueba en el panel (Worker > Settings > Runtime) la
     *compatibility date* y ponla en `worker/wrangler.toml`.
   - `cd worker && npx wrangler deploy` (o el workflow «Deploy Workers»).
2. **Importar el repo en Vercel** desde [vercel.com/new](https://vercel.com/new).
   Lee `vercel.json` solo: Vite, `npm run build`, salida `dist/`.
3. **Abrir el CORS al dominio nuevo** en las variables del Worker:
   - `ALLOWED_ORIGIN` = `https://victorjorge5.github.io,https://<proyecto>.vercel.app`
   - (opcional, para las previews de cada PR) `ALLOWED_ORIGIN_PATTERN` =
     `^https://<proyecto>-[a-z0-9-]+-<equipo>\.vercel\.app$`
4. Probar en Vercel. Cuando todo funcione, poner `APP_URL` al dominio de Vercel,
   quitar GitHub Pages de `ALLOWED_ORIGIN` y desactivar GitHub Pages.

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
la pestaña Actions). Necesita en GitHub (Settings > Secrets and variables >
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
