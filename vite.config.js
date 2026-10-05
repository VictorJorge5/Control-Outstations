import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Las cabeceras de vercel.json (CSP incluida) tambien se aplican en `vite preview`,
// para que los tests e2e prueben la app con las mismas restricciones que en produccion.
const vercelHeaders = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'))
  .headers.find(h => h.source === '/(.*)').headers
  .filter(h => h.key !== 'Strict-Transport-Security')
  .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});

// Marca de version de cada build. main.js la compara con /version.json para
// avisar a las pestañas abiertas de que hay una version nueva publicada.
const APP_BUILD = process.env.VERCEL_GIT_COMMIT_SHA
  ? `${new Date().toISOString()}-${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}`
  : new Date().toISOString();

export default defineConfig({
  define: {
    __APP_BUILD__: JSON.stringify(APP_BUILD),
  },
  preview: {
    headers: vercelHeaders,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200, // exceljs pesa ~1 MB, pero solo se descarga al exportar
  },
  plugins: [
    {
      name: 'version-json',
      generateBundle(){
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: APP_BUILD }) + '\n' });
      },
    },
  ],
});
