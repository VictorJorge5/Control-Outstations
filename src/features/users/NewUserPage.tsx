import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Eye, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fadeUp, stagger } from '@/lib/motion';
import { usePermissions } from '@/lib/session';
import type { Role } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/controls';
import { Card, Field, Input } from '@/components/ui/primitives';
import { Page, PageHeader } from '@/components/layout/Page';
import { TempPasswordDialog } from './TempPasswordDialog';

const ROLES: { v: Role; label: string; desc: string; icon: typeof UserRound }[] = [
  { v: 'user', label: 'Usuario', desc: 'Trabajo diario: F-CAMO y seguimiento.', icon: UserRound },
  { v: 'viewer', label: 'Consulta', desc: 'Puede verlo todo, no modificar nada.', icon: Eye },
  { v: 'admin', label: 'Administrador', desc: 'Además gestiona usuarios y datos.', icon: ShieldCheck },
];

export default function NewUserPage() {
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('user');
  const [badge, setBadge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  if (!isAdmin) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    setBusy(true);
    try {
      const { temp_password } = await api<{ temp_password: string }>('/api/admin-users', { method: 'POST', body: { email: value, role, show_data_badge: badge } });
      qc.invalidateQueries({ queryKey: ['users'] });
      setCreated({ email: value, password: temp_password });
    } catch (err) {
      toast.error('No se ha podido crear', { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page width="narrow">
      <PageHeader back={{ to: '/usuarios', label: 'Todos los usuarios' }} eyebrow="Administración" title="Nuevo usuario" description="Recibirá una contraseña temporal y tendrá que elegir la suya al entrar." />
      <motion.form onSubmit={submit} variants={stagger(0.06)} initial="hidden" animate="show">
        <motion.div variants={fadeUp}>
          <Card className="space-y-6 p-5 sm:p-6">
            <Field label="Correo @iberia.es" htmlFor="user-email" hint="Solo se admiten altas con correo @iberia.es.">
              <Input id="user-email" type="email" required placeholder="nombre.apellido@iberia.es" value={email} onChange={e => setEmail(e.target.value)} className="sm:max-w-md" />
            </Field>
            <div>
              <div className="mb-2 text-[12.5px] font-medium text-ink-600">Rol</div>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Rol">
                {ROLES.map(r => (
                  <button key={r.v} type="button" role="radio" aria-checked={role === r.v} onClick={() => setRole(r.v)}
                    className={cn('rounded-xl p-4 text-left ring-1 ring-inset transition-all', role === r.v ? 'bg-brand-50/60 ring-2 ring-brand-500' : 'bg-white ring-ink-200 hover:ring-ink-300')}>
                    <r.icon className={cn('mb-2 size-5', role === r.v ? 'text-brand-600' : 'text-ink-400')} />
                    <div className="text-[14px] font-semibold text-ink-900">{r.label}</div>
                    <div className="mt-0.5 text-[12.5px] text-ink-500">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <Checkbox checked={badge} onCheckedChange={setBadge} label="Ve el aviso de «datos actualizados»" />
          </Card>
        </motion.div>
        <motion.div variants={fadeUp} className="mt-4 flex justify-end gap-2">
          <Button onClick={() => navigate('/usuarios')}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={busy}>Crear usuario</Button>
        </motion.div>
      </motion.form>
      <TempPasswordDialog data={created ? { ...created, created: true } : null} onClose={() => navigate('/usuarios')} />
    </Page>
  );
}
