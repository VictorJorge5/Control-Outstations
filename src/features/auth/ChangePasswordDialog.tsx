import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { session } from '@/lib/session';
import type { LoginResponse } from '@/lib/types';
import { Modal } from '@/components/ui/overlay';
import { NewPasswordForm } from './LoginScreen';

// Cambio de contraseña voluntario (desde el menu de usuario). Cierra las demas sesiones del usuario.
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="sm" title="Cambiar contraseña" description="Se cerrarán tus otras sesiones abiertas.">
      <NewPasswordForm
        current
        submitLabel="Guardar contraseña"
        onCancel={() => onOpenChange(false)}
        onSubmit={async (password, current) => {
          try {
            const data = await api<LoginResponse>('/api/change-password', {
              method: 'POST', expireOn401: false,
              body: { current_password: current, new_password: password },
            });
            if (data.token) session.start({ ...data, token: data.token });
            onOpenChange(false);
            toast.success('Contraseña cambiada', { description: 'Se han cerrado tus otras sesiones.' });
            return null;
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) return 'Tu sesión ya no es válida. Vuelve a iniciar sesión.';
            return (err as Error).message || 'No se ha podido cambiar la contraseña.';
          }
        }}
      />
    </Modal>
  );
}
