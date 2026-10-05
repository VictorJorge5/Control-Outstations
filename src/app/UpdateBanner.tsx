import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RefreshCw, X } from 'lucide-react';
import { easeOut } from '@/lib/motion';

// Cada 5 minutos (y al volver a la pestaña) pide /version.json sin cache; si el build es distinto
// del cargado, se ha publicado una version nueva y se ofrece recargar.
async function hasNewVersion() {
  try {
    const res = await fetch('/version.json?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return false;
    const { build } = await res.json();
    return !!build && build !== __APP_BUILD__;
  } catch {
    return false;
  }
}

export function UpdateBanner() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => { hasNewVersion().then(v => { if (v) setOpen(true); }); };
    const id = setInterval(check, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <AnimatePresence>
      {open && !dismissed && (
        <motion.div
          data-testid="update-banner"
          role="status"
          initial={{ opacity: 0, y: -16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%', transition: { duration: 0.4, ease: easeOut } }}
          exit={{ opacity: 0, y: -16, x: '-50%' }}
          className="fixed left-1/2 top-4 z-[80] flex items-center gap-3 rounded-2xl bg-ink-900 py-2 pl-4 pr-2 text-sm text-white shadow-overlay"
        >
          <span className="relative flex size-2"><span className="absolute inset-0 animate-ping rounded-full bg-gold-400" /><span className="relative size-2 rounded-full bg-gold-400" /></span>
          Hay una versión más reciente disponible.
          <button onClick={() => location.reload()} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20">
            <RefreshCw className="size-3.5" /> Recargar
          </button>
          <button onClick={() => setDismissed(true)} aria-label="Cerrar" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
