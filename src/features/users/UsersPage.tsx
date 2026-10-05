import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { History, KeyRound, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { useUsers } from '@/lib/queries';
import { usePermissions, useSession } from '@/lib/session';
import type { Role, User } from '@/lib/types';
import { useConfirm } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Switch, Tip } from '@/components/ui/controls';
import { Badge, Card, Select, Skeleton } from '@/components/ui/primitives';
import { LoadError, Page, PageHeader } from '@/components/layout/Page';
import { ROLE_LABELS } from '@/features/activity/activityText';
import { TempPasswordDialog } from './TempPasswordDialog';

export default function UsersPage() {
  const { isAdmin } = usePermissions();
  const users = useUsers();
  const navigate = useNavigate();
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  if (!isAdmin) return <Navigate to="/" replace />;

  const counts = (users.data || []).reduce<Record<string, number>>((a, u) => ({ ...a, [u.role]: (a[u.role] || 0) + 1 }), {});
  return (
    <Page>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Altas, permisos y contraseñas de acceso a la app."
        back={{ to: '/', label: 'Inicio' }}
        actions={<>
          <Button icon={<History />} onClick={() => navigate('/usuarios/historial')}>Historial</Button>
          <Button variant="primary" icon={<UserPlus />} onClick={() => navigate('/usuarios/nuevo')}>Nuevo usuario</Button>
        </>}
      >
        {users.data && (
          <div className="flex flex-wrap gap-2">
            {(['admin', 'user', 'viewer'] as Role[]).map(r => <Badge key={r} tone={r === 'admin' ? 'dark' : r === 'viewer' ? 'warning' : 'neutral'}>{ROLE_LABELS[r]}: {counts[r] || 0}</Badge>)}
          </div>
        )}
      </PageHeader>

      {users.error ? <LoadError error={users.error} onRetry={() => users.refetch()} />
        : users.isPending ? <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          : (
            <Card className="divide-y divide-ink-100 overflow-hidden">
              <AnimatePresence initial={false}>
                {users.data!.map((u, i) => <UserRow key={u.email} user={u} index={i} onTempPassword={p => setTemp({ email: u.email, password: p })} />)}
              </AnimatePresence>
            </Card>
          )}
      <TempPasswordDialog data={temp} onClose={() => setTemp(null)} />
    </Page>
  );
}

function UserRow({ user: u, index, onTempPassword }: { user: User; index: number; onTempPassword: (p: string) => void }) {
  const { email: me } = useSession();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const isMe = u.email === me;
  const role = u.role || (u.is_admin ? 'admin' : 'user');
  const initials = u.email.split('@')[0].split(/[._-]/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('');

  async function patch(body: Record<string, unknown>, okMsg?: string) {
    setBusy(true);
    try {
      const res = await api<{ temp_password?: string }>(`/api/admin-users/${encodeURIComponent(u.email)}`, { method: 'PATCH', body });
      await qc.invalidateQueries({ queryKey: ['users'] });
      if (okMsg) toast.success(okMsg);
      return res;
    } catch (err) {
      toast.error('No se ha podido guardar', { description: (err as Error).message });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!(await confirm({ title: `¿Restablecer la contraseña de ${u.email}?`, description: 'Se generará una contraseña temporal nueva; la anterior dejará de funcionar y se cerrarán sus sesiones.', confirmLabel: 'Restablecer' }))) return;
    const res = await patch({ reset_password: true });
    if (res?.temp_password) onTempPassword(res.temp_password);
  }

  async function remove() {
    if (!(await confirm({ title: `¿Eliminar la cuenta ${u.email}?`, description: 'No se puede deshacer.', confirmLabel: 'Eliminar cuenta', danger: true }))) return;
    setBusy(true);
    try {
      await api(`/api/admin-users/${encodeURIComponent(u.email)}`, { method: 'DELETE' });
      await qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Cuenta ${u.email} eliminada`);
    } catch (err) {
      toast.error('No se ha podido eliminar', { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.04, 0.3) } }} exit={{ opacity: 0, height: 0 }}
      className={cn('flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4', busy && 'opacity-60')} data-testid="user-row">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold', role === 'admin' ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600')}>{initials || '?'}</span>
      <div className="min-w-[220px] flex-1">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-900">{u.email}{isMe && <span className="text-xs font-normal text-ink-400">(tú)</span>}</div>
        <div className="text-[12.5px] text-ink-500">
          Alta {new Date(u.created_at * 1000).toLocaleDateString('es-ES')}{u.updated_at ? ` · actualizado ${timeAgo(u.updated_at)}` : ''}
          {!!u.must_change_password && <> · <span className="font-medium text-amber-700">pendiente de elegir contraseña</span></>}
        </div>
      </div>
      <Select aria-label={`Rol de ${u.email}`} value={role} disabled={isMe || busy} title={isMe ? 'No puedes cambiar tu propio rol' : undefined} className="w-40"
        onChange={e => patch({ role: e.target.value }, `Rol de ${u.email}: ${ROLE_LABELS[e.target.value]}`)}>
        {(['admin', 'user', 'viewer'] as Role[]).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </Select>
      <Switch checked={!!u.show_data_badge} disabled={busy} onCheckedChange={v => patch({ show_data_badge: v })} label="Aviso datos" />
      <div className="flex gap-1.5">
        <Tip content={isMe ? 'Para cambiar tu contraseña usa el menú de usuario' : 'Restablecer contraseña'}>
          <span><Button size="icon-sm" variant="ghost" aria-label={`Restablecer contraseña de ${u.email}`} disabled={isMe || busy} onClick={resetPassword}><KeyRound /></Button></span>
        </Tip>
        <Tip content={isMe ? 'No puedes eliminar tu propia cuenta' : 'Eliminar cuenta'}>
          <span><Button size="icon-sm" variant="ghost" className="hover:bg-brand-50 hover:text-brand-600" aria-label={`Eliminar ${u.email}`} disabled={isMe || busy} onClick={remove}><Trash2 /></Button></span>
        </Tip>
      </div>
    </motion.div>
  );
}
