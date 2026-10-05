import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Dialog as RDialog, AlertDialog as RAlert } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { easeOut } from '@/lib/motion';
import { Button } from './button';

const overlayAnim = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// ---- Dialogo centrado ----
export function Modal({ open, onOpenChange, title, description, actions, children, className, size = 'md' }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const w = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div {...overlayAnim} className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-[3px]" />
            </RDialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-3 sm:p-6">
              <RDialog.Content asChild forceMount aria-describedby={description ? undefined : undefined}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.32, ease: easeOut } }}
                  exit={{ opacity: 0, scale: 0.98, y: 6, transition: { duration: 0.15 } }}
                  className={cn('pointer-events-auto flex max-h-[min(88dvh,900px)] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-overlay ring-1 ring-ink-950/5', w, className)}
                >
                  <div className="flex items-start gap-4 border-b border-ink-100 px-6 py-5">
                    <div className="min-w-0 flex-1">
                      <RDialog.Title className="text-lg font-semibold tracking-tight text-ink-900">{title}</RDialog.Title>
                      {description ? <RDialog.Description className="mt-0.5 text-sm text-ink-500">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</RDialog.Description>}
                    </div>
                    {actions && <div className="flex items-center gap-2">{actions}</div>}
                    <RDialog.Close asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Cerrar"><X /></Button>
                    </RDialog.Close>
                  </div>
                  <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
                </motion.div>
              </RDialog.Content>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}

// ---- Panel lateral (ficha de estacion) ----
export function Sheet({ open, onOpenChange, children, label, className }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div {...overlayAnim} className="fixed inset-0 z-50 bg-ink-950/30 backdrop-blur-[2px]" />
            </RDialog.Overlay>
            <RDialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ x: '100%', opacity: 0.6 }}
                animate={{ x: 0, opacity: 1, transition: { duration: 0.45, ease: easeOut } }}
                exit={{ x: '100%', opacity: 0.6, transition: { duration: 0.25, ease: [0.4, 0, 1, 1] } }}
                className={cn('fixed inset-y-0 right-0 z-50 flex w-full max-w-[860px] flex-col bg-white shadow-overlay sm:inset-y-2 sm:right-2 sm:rounded-3xl sm:ring-1 sm:ring-ink-950/5 overflow-hidden', className)}
              >
                <RDialog.Title className="sr-only">{label}</RDialog.Title>
                {children}
              </motion.div>
            </RDialog.Content>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  );
}
export const SheetClose = RDialog.Close;

// ---- Confirmaciones (sustituyen a window.confirm) ----
interface ConfirmOptions { title: string; description?: ReactNode; confirmLabel?: string; danger?: boolean }
type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);
  const confirm = useCallback<ConfirmFn>(o => new Promise<boolean>(res => { resolver.current = res; setOpts(o); }), []);
  const close = (v: boolean) => { resolver.current?.(v); resolver.current = undefined; setOpts(null); };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <RAlert.Root open={!!opts} onOpenChange={o => { if (!o) close(false); }}>
        <AnimatePresence>
          {opts && (
            <RAlert.Portal forceMount>
              <RAlert.Overlay asChild forceMount>
                <motion.div {...overlayAnim} className="fixed inset-0 z-[60] bg-ink-950/40 backdrop-blur-[3px]" />
              </RAlert.Overlay>
              <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center p-4">
                <RAlert.Content asChild forceMount>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1, transition: { duration: 0.25, ease: easeOut } }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
                    className="pointer-events-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-overlay ring-1 ring-ink-950/5"
                  >
                    <RAlert.Title className="text-base font-semibold text-ink-900">{opts.title}</RAlert.Title>
                    <RAlert.Description className="mt-2 text-sm leading-relaxed text-ink-600">{opts.description}</RAlert.Description>
                    <div className="mt-6 flex justify-end gap-2">
                      <RAlert.Cancel asChild><Button variant="secondary">Cancelar</Button></RAlert.Cancel>
                      <RAlert.Action asChild>
                        <Button variant={opts.danger ? 'primary' : 'dark'} onClick={() => close(true)}>{opts.confirmLabel || 'Confirmar'}</Button>
                      </RAlert.Action>
                    </div>
                  </motion.div>
                </RAlert.Content>
              </div>
            </RAlert.Portal>
          )}
        </AnimatePresence>
      </RAlert.Root>
    </ConfirmContext.Provider>
  );
}
