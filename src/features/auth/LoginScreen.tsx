import { useState, type FormEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CircleCheck, Eye, EyeOff, TriangleAlert } from 'lucide-react';
import logo from '@/assets/iberia-logo.png';
import { api, ApiError } from '@/lib/api';
import { session, useSession } from '@/lib/session';
import type { LoginResponse } from '@/lib/types';
import { easeOut } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/primitives';
import { BrandPanel } from './BrandPanel';

export const PASSWORD_MIN = 10;

type View =
  | { kind: 'login' }
  | { kind: 'change'; token: string; current: string }
  | { kind: 'reset' };

export function LoginScreen({ resetToken, onResetDone }: { resetToken: string | null; onResetDone: () => void }) {
  const { expiredMessage } = useSession();
  const [view, setView] = useState<View>(resetToken ? { kind: 'reset' } : { kind: 'login' });
  const [notice, setNotice] = useState<{ tone: 'error' | 'ok'; text: string } | null>(expiredMessage ? { tone: 'error', text: expiredMessage } : null);

  const title = view.kind === 'change' ? 'Elige tu contraseña' : view.kind === 'reset' ? 'Nueva contraseña' : 'Iniciar sesión';
  const subtitle = view.kind === 'change'
    ? 'Has entrado con una contraseña temporal. Elige la tuya para continuar.'
    : view.kind === 'reset' ? 'Elige tu nueva contraseña.' : 'Accede con tu cuenta de Iberia.';

  return (
    <div className="flex min-h-full bg-white">
      <BrandPanel />
      <div className="relative flex flex-1 flex-col">
        {/* cabecera compacta en movil */}
        <div className="flex h-16 items-center gap-3 bg-brand-600 px-5 lg:hidden">
          <img src={logo} alt="Iberia" className="h-6 w-auto" />
          <div className="h-6 w-px bg-white/30" />
          <span className="text-sm font-semibold text-white">Control de Estaciones</span>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-12">
          <div className="w-full max-w-[380px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={view.kind}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: easeOut } }}
                exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
              >
                <h2 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h2>
                <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>

                <Notice notice={notice} />

                {view.kind === 'login' && (
                  <LoginForm
                    onError={text => setNotice({ tone: 'error', text })}
                    onClear={() => { setNotice(null); session.clearMessage(); }}
                    onMustChange={(token, current) => { setNotice(null); setView({ kind: 'change', token, current }); }}
                  />
                )}
                {view.kind === 'change' && (
                  <NewPasswordForm
                    submitLabel="Guardar y entrar"
                    onCancel={() => { setNotice(null); setView({ kind: 'login' }); }}
                    onSubmit={async password => {
                      try {
                        const data = await api<LoginResponse>('/api/change-password', {
                          method: 'POST', token: view.token, expireOn401: false,
                          body: { current_password: view.current, new_password: password },
                        });
                        if (data.token) session.start({ ...data, token: data.token });
                        return null;
                      } catch (err) {
                        if (err instanceof ApiError && err.status === 401) {
                          setView({ kind: 'login' });
                          setNotice({ tone: 'error', text: 'Ha caducado el tiempo para elegir la contraseña. Vuelve a iniciar sesión con la temporal.' });
                          return null;
                        }
                        return (err as Error).message || 'No se ha podido cambiar la contraseña.';
                      }
                    }}
                  />
                )}
                {view.kind === 'reset' && (
                  <NewPasswordForm
                    submitLabel="Guardar contraseña"
                    onSubmit={async password => {
                      try {
                        await api('/api/reset-password', { method: 'POST', body: { token: resetToken, password } });
                        window.history.replaceState({}, '', window.location.pathname);
                        onResetDone();
                        setView({ kind: 'login' });
                        setNotice({ tone: 'ok', text: 'Contraseña guardada. Ya puedes iniciar sesión.' });
                        return null;
                      } catch (err) {
                        return (err as Error).message || 'No se ha podido guardar la nueva contraseña.';
                      }
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <p className="px-5 pb-6 text-center text-xs text-ink-400">Dirección Técnica del Operador · Outstations</p>
      </div>
    </div>
  );
}

function Notice({ notice }: { notice: { tone: 'error' | 'ok'; text: string } | null }) {
  return (
    <AnimatePresence initial={false}>
      {notice && (
        <motion.div
          key={notice.text}
          role={notice.tone === 'error' ? 'alert' : 'status'}
          data-testid="login-notice"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto', transition: { duration: 0.25, ease: easeOut } }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className={notice.tone === 'error'
            ? 'mt-5 flex gap-2.5 rounded-xl bg-brand-50 px-3.5 py-3 text-[13px] leading-snug text-brand-800 ring-1 ring-inset ring-brand-100'
            : 'mt-5 flex gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3 text-[13px] leading-snug text-emerald-800 ring-1 ring-inset ring-emerald-100'}>
            {notice.tone === 'error' ? <TriangleAlert className="mt-px size-4 shrink-0" /> : <CircleCheck className="mt-px size-4 shrink-0" />}
            {notice.text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LoginForm({ onError, onClear, onMustChange }: { onError: (t: string) => void; onClear: () => void; onMustChange: (token: string, current: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    onClear();
    setBusy(true);
    try {
      const data = await api<LoginResponse>('/api/login', { method: 'POST', token: null, body: { email: email.trim().toLowerCase(), password } });
      if (data.must_change && data.token) {
        // contraseña temporal: hay que elegir una propia antes de entrar (el token restringido no se guarda)
        setPassword('');
        onMustChange(data.token, password);
      } else if (data.token) {
        session.start({ ...data, token: data.token });
      } else {
        onError(data.error || 'Usuario o contraseña incorrectos.');
      }
    } catch (err) {
      const e = err as ApiError;
      onError(e.status === 0 ? 'No se ha podido conectar con el servidor de acceso. Inténtalo de nuevo.' : e.message || 'Usuario o contraseña incorrectos.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4" aria-label="Iniciar sesión">
      <Field label="Correo" htmlFor="login-email">
        <Input id="login-email" type="email" autoComplete="username" placeholder="nombre@iberia.es" required autoFocus value={email} onChange={e => setEmail(e.target.value)} />
      </Field>
      <Field label="Contraseña" htmlFor="login-pass">
        <PasswordInput id="login-pass" autoComplete="current-password" value={password} onChange={setPassword} />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="mt-2 w-full" loading={busy}>
        Entrar {!busy && <ArrowRight />}
      </Button>
      <p className="pt-2 text-center text-xs leading-relaxed text-ink-500">¿Has olvidado tu contraseña? Pide a un administrador que te la restablezca.</p>
    </form>
  );
}

export function NewPasswordForm({ onSubmit, onCancel, submitLabel, current }: {
  onSubmit: (password: string, current?: string) => Promise<string | null>;
  onCancel?: () => void;
  submitLabel: string;
  /** muestra el campo de contraseña actual (cambio voluntario) */
  current?: boolean;
}) {
  const [cur, setCur] = useState('');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (current && !cur) return setError('Escribe tu contraseña actual.');
    if (p1.length < PASSWORD_MIN) return setError(`La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres.`);
    if (p1 !== p2) return setError('Las dos contraseñas nuevas no coinciden.');
    setBusy(true);
    const err = await onSubmit(p1, cur);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Notice notice={error ? { tone: 'error', text: error } : null} />
      {current && (
        <Field label="Contraseña actual" htmlFor="pw-current">
          <PasswordInput id="pw-current" autoComplete="current-password" value={cur} onChange={setCur} />
        </Field>
      )}
      <Field label={`Contraseña nueva (mínimo ${PASSWORD_MIN} caracteres)`} htmlFor="pw-new1">
        <PasswordInput id="pw-new1" autoComplete="new-password" value={p1} onChange={setP1} />
        <StrengthMeter value={p1} />
      </Field>
      <Field label="Repite la contraseña nueva" htmlFor="pw-new2">
        <PasswordInput id="pw-new2" autoComplete="new-password" value={p2} onChange={setP2} />
      </Field>
      <div className="flex gap-2 pt-2">
        {onCancel && <Button variant="secondary" size="lg" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" variant="primary" size="lg" className="flex-1" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} required maxLength={200} value={value} onChange={e => onChange(e.target.value)} className="pr-11" />
      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function StrengthMeter({ value }: { value: string }): ReactNode {
  if (!value) return null;
  const score = Math.min(4, [value.length >= PASSWORD_MIN, value.length >= 14, /[A-Z]/.test(value) && /[a-z]/.test(value), /\d/.test(value) && /[^A-Za-z0-9]/.test(value)].filter(Boolean).length);
  const labels = ['Muy corta', 'Aceptable', 'Buena', 'Fuerte', 'Muy fuerte'];
  const colors = ['bg-brand-500', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500', 'bg-emerald-600'];
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-ink-100">
            <motion.div className={`h-full ${colors[score]}`} initial={false} animate={{ width: i < Math.max(1, score) ? '100%' : '0%' }} transition={{ duration: 0.3 }} />
          </div>
        ))}
      </div>
      <span className="w-20 text-right text-[11px] font-medium text-ink-500">{labels[score]}</span>
    </div>
  );
}
