import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Compass, RotateCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Ruta que no existe, dentro de la app (con menu lateral) */
export function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6" data-testid="not-found">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink-100 text-ink-500"><Compass className="size-7" /></div>
        <div className="mt-5 font-mono text-[13px] font-semibold tracking-widest text-brand-600">ERROR 404</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">Esta pantalla no existe</h1>
        <p className="mt-2 text-[14.5px] text-ink-500">Puede que el enlace esté mal copiado o que la pantalla haya cambiado de sitio.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-ink-800">
          <ArrowLeft className="size-4" /> Volver al inicio
        </Link>
      </motion.div>
    </div>
  );
}

const RELOAD_KEY = 'ce_chunk_reload';
const isChunkError = (e: unknown) => /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i.test(String((e as Error)?.message || e));

/** Error inesperado al pintar una pantalla. Si es porque hay una version nueva desplegada
 *  (los trozos de codigo antiguos ya no existen), recarga una vez sola. */
export function RouteError() {
  const error = useRouteError();
  const chunk = isChunkError(error);
  useEffect(() => {
    if (!chunk) return;
    try {
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, '1');
    } catch { /* sin almacenamiento: no arriesgar un bucle */ return; }
    window.location.reload();
  }, [chunk]);

  return (
    <div className="grid min-h-[70vh] place-items-center px-6" role="alert" data-testid="route-error">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><TriangleAlert className="size-7" /></div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-900">{chunk ? 'Hay una versión nueva' : 'Algo ha fallado'}</h1>
        <p className="mt-2 text-[14.5px] text-ink-500">
          {chunk ? 'La aplicación se ha actualizado mientras la tenías abierta. Recarga para seguir.' : 'Ha ocurrido un error inesperado al mostrar esta pantalla. Tus datos están a salvo: recarga para continuar.'}
        </p>
        {!chunk && error instanceof Error && <pre className="mx-auto mt-4 max-w-full overflow-x-auto rounded-xl bg-white p-3 text-left font-mono text-[11.5px] text-ink-500 ring-1 ring-ink-150">{error.message}</pre>}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="primary" icon={<RotateCw />} onClick={() => window.location.reload()}>Recargar</Button>
          <Button onClick={() => { window.location.href = '/'; }}>Ir al inicio</Button>
        </div>
      </div>
    </div>
  );
}

/** Tras una carga correcta se permite otra recarga automatica en el futuro */
export function clearChunkReloadFlag() {
  try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* nada */ }
}
