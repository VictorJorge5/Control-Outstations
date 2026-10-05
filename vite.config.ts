import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Marca de version de cada build. La app la compara con /version.json para
// avisar a las pestañas abiertas de que hay una version nueva publicada.
const APP_BUILD = process.env.VERCEL_GIT_COMMIT_SHA
  ? `${new Date().toISOString()}-${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}`
  : new Date().toISOString();

// Las cabeceras de vercel.json (CSP incluida) tambien se aplican en `vite preview`,
// para que los tests e2e prueben la app con las mismas restricciones que en produccion.
type VercelHeader = { key: string; value: string };
const vercelHeaders = (JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers as { source: string; headers: VercelHeader[] }[])
  .find(h => h.source === '/(.*)')!.headers
  .filter(h => h.key !== 'Strict-Transport-Security')
  .reduce<Record<string, string>>((acc, h) => ({ ...acc, [h.key]: h.value }), {});

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: APP_BUILD }) + '\n' });
      },
    },
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: {
    __APP_BUILD__: JSON.stringify(APP_BUILD),
  },
  preview: {
    headers: vercelHeaders,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200, // exceljs pesa ~1 MB, pero solo se descarga al exportar
  },
});
