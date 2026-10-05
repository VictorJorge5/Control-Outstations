import { motion } from 'motion/react';
import { useAppData } from '@/lib/queries';
import { useStationNav } from '@/lib/nav';
import { stagger } from '@/lib/motion';
import { ALT_FLEET_COLS } from '@/domain/fleet';
import { Modal } from '@/components/ui/overlay';
import { Code } from '@/components/ui/primitives';
import { ProviderCard } from './parts';

// Detalle de una estacion en el modo "Proveedores no contratados"
export function AltStationDialog() {
  const { altCode, close } = useStationNav();
  const { altByCode } = useAppData();
  const s = altCode ? altByCode.get(altCode) : undefined;
  return (
    <Modal
      open={!!s}
      onOpenChange={o => { if (!o) close(); }}
      size="lg"
      title={s ? <span className="flex items-center gap-3"><Code size="lg">{s.code}</Code> {s.city}, {s.country}</span> : ''}
      description="Proveedores no contratados con cobertura en esta estación (solo se muestra la flota que operamos)."
    >
      {s && (
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-3">
          {s.providers.map(p => <ProviderCard key={p.supplier} provider={p} cols={ALT_FLEET_COLS} />)}
        </motion.div>
      )}
    </Modal>
  );
}
