import { motion } from 'motion/react';
import logo from '@/assets/iberia-logo.png';
import { easeOut } from '@/lib/motion';

export function LoadingScreen() {
  return (
    <div className="grid h-full place-items-center bg-ink-50" role="status" aria-live="polite" data-testid="loading-screen">
      <motion.div className="flex flex-col items-center" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: easeOut }}>
        <div className="relative">
          <motion.div className="absolute inset-0 rounded-[22px] bg-brand-500" animate={{ scale: [1, 1.35], opacity: [0.35, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }} />
          <div className="relative grid size-20 place-items-center rounded-[22px] bg-gradient-to-br from-brand-500 to-brand-700 shadow-lift">
            <img src={logo} alt="" className="w-14" />
          </div>
        </div>
        <div className="mt-7 text-[15px] font-semibold text-ink-800">Cargando datos…</div>
        <div className="mt-1 text-sm text-ink-500">Estaciones, proveedores y horarios</div>
        <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-ink-150">
          <motion.div className="h-full w-1/3 rounded-full bg-brand-600" animate={{ x: ['-100%', '300%'] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
      </motion.div>
    </div>
  );
}
