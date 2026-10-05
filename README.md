# Control de Estaciones · Outstations DTO

App de control de estaciones. El front-end es una app Vite (HTML + JS sin
framework) que se despliega en **Vercel**; el login y los datos los sirve el
Worker de Cloudflare `control-estaciones-auth` (carpeta `worker/`), con una
base de datos D1.

## Estructura

```
index.html        marcado (login, cabecera, mapa, modales)
src/main.js       acceso: login, sesión, roles, rutas (#inicio, #mapa, #seguimiento)
src/app.js        la app (mapa, listas, fichas, F-CAMO, seguimiento, Excel).
                  Se carga en un chunk aparte SOLO tras el login, cuando ya hay datos.
src/data.js       datos devueltos por /api/data (estaciones, alternativos, pernoctas)
src/styles.css    estilos
public/           ficheros estáticos (favicon)
vercel.json       build, cabeceras de seguridad (CSP...) y caché
worker/           Worker de Cloudflare (API) + wrangler.toml + schema.sql de la D1
```

Leaflet, ExcelJS y las fuentes IBM Plex vienen de npm y se sirven desde el
propio dominio (ya no hay CDNs ni Google Fonts). ExcelJS (~250 kB gzip) solo se
descarga al pulsar «Descargar Excel».

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:5173
npm run lint
npm run build     # genera dist/
npm run preview   # sirve dist/ en local
```

> El Worker solo acepta peticiones de los orígenes que tenga permitidos (CORS).
> Para probar en local con datos reales, añade `http://localhost:5173` a esa
> lista en el Worker.

### Variables de entorno

| Variable       | Uso                                    | Por defecto                                             |
| -------------- | -------------------------------------- | ------------------------------------------------------- |
| `VITE_API_URL` | URL del Worker (API de acceso y datos) | `https://control-estaciones-auth.victorjjm5.workers.dev` |

Si cambias la URL del Worker, actualiza también `connect-src` en la CSP de
`vercel.json`, o el navegador bloqueará las llamadas.

## Despliegue en Vercel

1. En [vercel.com/new](https://vercel.com/new), importa el repositorio
   `VictorJorge5/Control-Outstations`. Vercel lee `vercel.json` (Vite,
   `npm run build`, salida `dist/`); no hay que tocar nada más.
2. **Worker (CORS):** despliega el Worker de `worker/` (admite varios
   orígenes) y pon en la variable `ALLOWED_ORIGIN` los dos dominios separados
   por comas, p. ej.
   `https://victorjorge5.github.io,https://<proyecto>.vercel.app`.
   Sin esto el login desde Vercel falla con «No se ha podido conectar con el
   servidor de acceso». Con los dos a la vez, GitHub Pages sigue funcionando
   mientras pruebas.
3. **Worker (enlaces de correo):** los correos de «restablecer contraseña»
   llevan un enlace `?reset=<token>` a la URL de la app. Cambia esa URL en la
   configuración del Worker al nuevo dominio.
4. Cada push a `main` despliega a producción; cada rama/PR tiene su propia URL
   de previsualización.
5. Cuando todo funcione en Vercel, apaga el hosting anterior para no tener dos
   versiones publicadas.

## Worker (API)

El código desplegado en Cloudflare está en `worker/src/index.js`. A partir de
ahora conviene cambiarlo aquí y desplegar desde el repo, no editarlo en el panel:

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

`wrangler.toml` lleva `keep_vars = true`, así que el deploy no toca las
variables ni los secretos configurados en el panel.

Aviso de versión nueva: cada build genera `/version.json` con una marca única;
las pestañas abiertas lo consultan cada 5 minutos y, si cambia, muestran el
aviso «Hay una versión más reciente».
