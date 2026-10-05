import { motion } from 'motion/react';
import logo from '@/assets/iberia-logo.png';
import { easeOut } from '@/lib/motion';

// Rutas de vuelo estilizadas que se dibujan en bucle sobre el panel de marca.
const ROUTES = [
  'M60 420 C 180 250, 360 210, 520 300',
  'M90 180 C 230 120, 380 140, 470 90',
  'M120 520 C 260 420, 420 440, 560 520',
  'M30 300 C 160 330, 290 360, 400 250',
];
const POINTS: [number, number][] = [[60, 420], [520, 300], [90, 180], [470, 90], [120, 520], [560, 520], [30, 300], [400, 250]];

export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-brand-700 lg:flex lg:w-[46%] lg:flex-col xl:w-[44%]">
      {/* fondo: degradado con luces suaves */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,#e0263f_0%,transparent_55%),radial-gradient(90%_70%_at_100%_100%,#5c0716_0%,transparent_60%),linear-gradient(160deg,#c8102e_0%,#8f0b22_100%)]" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

      <svg viewBox="0 0 600 600" className="absolute inset-x-0 bottom-0 h-[78%] w-full" fill="none" aria-hidden>
        {ROUTES.map((d, i) => (
          <g key={i}>
            <path d={d} stroke="white" strokeOpacity="0.12" strokeWidth="1.2" strokeDasharray="3 6" />
            <motion.path
              d={d}
              stroke="url(#route)"
              strokeWidth="1.8"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
              transition={{ duration: 4.2, times: [0, 0.7, 1], delay: 0.6 + i * 1.1, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
            />
          </g>
        ))}
        {POINTS.map(([x, y], i) => (
          <g key={i}>
            <motion.circle cx={x} cy={y} r="10" fill="white" initial={{ opacity: 0.25, scale: 0.4 }} animate={{ opacity: [0.25, 0, 0.25], scale: [0.4, 1.6, 0.4] }} transition={{ duration: 3.2, delay: i * 0.4, repeat: Infinity }} style={{ transformOrigin: `${x}px ${y}px` }} />
            <circle cx={x} cy={y} r="3" fill="white" fillOpacity="0.85" />
          </g>
        ))}
        <defs>
          <linearGradient id="route" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fbd034" stopOpacity="0.2" />
            <stop offset="0.6" stopColor="#fbd034" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
      </svg>

      <div className="relative z-10 flex flex-1 flex-col p-12 xl:p-14">
        <motion.img src={logo} alt="Iberia" className="h-8 w-auto self-start" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: easeOut }} />
        <motion.div className="mt-auto max-w-md pb-[38%]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: easeOut }}>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85 ring-1 ring-white/15 backdrop-blur">
            <span className="size-1.5 rounded-full bg-gold-400" /> Dirección Técnica del Operador
          </div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-white xl:text-[44px]">Control de Estaciones</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">
            Red de proveedores de Outstations: cobertura, horarios, pernoctas y seguimiento de cada estación en un solo sitio.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
