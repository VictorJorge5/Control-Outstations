import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';

// La contrasena temporal solo la devuelve el Worker una vez: se muestra aqui para copiarla.
export function TempPasswordDialog({ data, onClose }: { data: { email: string; password: string; created?: boolean } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open={!!data} onOpenChange={o => { if (!o) { setCopied(false); onClose(); } }} size="sm"
      title={data?.created ? 'Usuario creado' : 'Contraseña restablecida'}
      description={data ? `Contraseña temporal para ${data.email}` : undefined}>
      {data && (
        <div>
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-3 rounded-2xl bg-ink-900 p-4 text-white">
            <KeyRound className="size-5 shrink-0 text-gold-400" />
            <code className="flex-1 select-all break-all font-mono text-lg tracking-wider" data-testid="temp-password">{data.password}</code>
            <Button size="sm" variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={() => navigator.clipboard?.writeText(data.password).then(() => setCopied(true))}>
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </motion.div>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-600">
            Cópiala y pásasela por un canal seguro: <b className="font-semibold text-ink-900">no se volverá a mostrar</b>. Al entrar tendrá que elegir una propia{data.created ? '' : ', y sus sesiones abiertas se han cerrado'}.
          </p>
          <div className="mt-5 flex justify-end"><Button variant="dark" onClick={onClose}>Hecho</Button></div>
        </div>
      )}
    </Modal>
  );
}
