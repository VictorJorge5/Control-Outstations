import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ClipboardCheck, FileText, Mail, Phone, Plus, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fadeUp, spring, stagger } from '@/lib/motion';
import { fmtNumber, timeAgo, who } from '@/lib/format';
import { useAppData } from '@/lib/queries';
import { usePermissions } from '@/lib/session';
import { useStationNav } from '@/lib/nav';
import type { TrackingSnapshot } from '@/lib/types';
import { fcamoProgress } from '@/domain/fcamo';
import {
  candState, flightInfo, flightText, noteOf, providerRows, stageOf, STAGES, suggestions, summary, urgency,
  type ProviderRow, type Stage, type TrackingData,
} from '@/domain/tracking';
import { useConfirm } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/controls';
import { Badge, Card, Code, Input, SectionTitle, Skeleton, Textarea } from '@/components/ui/primitives';
import { LoadError, Page, PageHeader } from '@/components/layout/Page';
import { StagePill, STAGE_TONE, useApplySnapshot, useTracking } from './shared';

export default function TrackingDetailPage() {
  const { code: raw = '' } = useParams();
  const code = raw.toUpperCase();
  const navigate = useNavigate();
  const { stationByCode } = useAppData();
  const t = useTracking();
  const exists = stationByCode.has(code);

  useEffect(() => {
    if (!exists) { toast.error('Esa estación no existe'); navigate('/seguimiento', { replace: true }); }
  }, [exists, navigate]);

  // Esc vuelve a la lista (si no hay ningun dialogo abierto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role=dialog],[role=alertdialog]')) navigate('/seguimiento');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  if (!exists) return null;
  return (
    <Page width="narrow">
      {t.error && !t.data ? <LoadError error={t.error} onRetry={() => t.raw.refetch()} />
        : !t.data ? <DetailSkeleton />
          : <Detail code={code} data={t.data} />}
    </Page>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-16 w-80" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function Detail({ code, data }: { code: string; data: TrackingData }) {
  const { stations, altStations, stationByCode } = useAppData();
  const { canWrite, isAdmin } = usePermissions();
  const { openStation } = useStationNav();
  const confirm = useConfirm();
  const applySnapshot = useApplySnapshot();
  const [busy, setBusy] = useState<string | null>(null);

  const station = stationByCode.get(code)!;
  const note = noteOf(data, code);
  const stage = stageOf(data, code);
  const f = flightInfo(station);
  const urg = urgency(f, stage);
  const sum = summary(data, code);
  const rows = useMemo(() => providerRows(data, code, stations, altStations), [data, code, stations, altStations]);
  const fc = data.fcamo[code];
  const def = STAGES.find(s => s.v === stage)!;

  async function mutate(key: string, fn: () => Promise<TrackingSnapshot>, okMsg?: string) {
    setBusy(key);
    try {
      const snap = await fn();
      applySnapshot(code, snap);
      if (okMsg) toast.success(okMsg);
      return snap;
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) toast.error((err as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }
  const candOf = (name: string) => (data.cands[code] || []).find(c => c.provider_name.trim().toLowerCase() === name.trim().toLowerCase());

  // pone a un proveedor en un estado, creandolo si todavia no estaba apuntado
  async function setProvider(name: string, status: 'identified' | 'contacted' | 'selected') {
    const cand = candOf(name);
    const snap = await mutate('prov:' + name, () => cand
      ? api<TrackingSnapshot>(`/api/tracking/candidates/${cand.id}`, { method: 'PATCH', body: { status } })
      : api<TrackingSnapshot>(`/api/tracking/${code}/candidates`, { method: 'POST', body: { provider_name: name, status } }));
    if (snap && status === 'selected') {
      toast.success(snap.replaced?.length ? `${name} elegido (sustituye a ${snap.replaced.join(', ')})` : `${name} elegido`);
    }
  }

  async function setStage(v: Stage) {
    if (v === stage) return;
    if ((v === 'covered' || stage === 'covered') && !isAdmin) { toast.error('Solo los administradores pueden cerrar o reabrir una estación.'); return; }
    if (v === 'covered' && !(await confirm({ title: `¿Marcar ${code} como cubierta?`, description: 'Saldrá de la lista (podrás verla en el filtro «Cubiertas»).', confirmLabel: 'Marcar como cubierta' }))) return;
    mutate('stage', () => api<TrackingSnapshot>(`/api/tracking/${code}`, { method: 'PATCH', body: { stage: v } }));
  }

  async function removeProvider(name: string) {
    const c = candOf(name);
    if (!c || !(await confirm({ title: `¿Quitar a ${c.provider_name}?`, description: `Dejará de aparecer en la lista de ${code}.`, confirmLabel: 'Quitar', danger: true }))) return;
    mutate('prov:' + name, () => api<TrackingSnapshot>(`/api/tracking/candidates/${c.id}`, { method: 'DELETE' }), 'Proveedor quitado');
  }

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show">
      <PageHeader
        back={{ to: '/seguimiento', label: 'Todas las estaciones' }}
        title={<span className="flex items-center gap-3"><Code size="xl">{code}</Code> <span>{f.city}{f.country ? `, ${f.country}` : ''}</span></span>}
        description={<span className={cn(urg === 'crit' ? 'font-medium text-brand-600' : urg === 'high' ? 'font-medium text-amber-700' : '')}>{flightText(f)}{f.movements ? ` · ${fmtNumber(f.movements)} movimientos` : ''}</span>}
        actions={<Button icon={<FileText />} onClick={() => openStation(code)}>Ver ficha</Button>}
      />

      {!canWrite && <motion.div variants={fadeUp} className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800 ring-1 ring-inset ring-amber-200">Solo consulta: puedes ver el seguimiento, pero no modificarlo.</motion.div>}

      <motion.div variants={fadeUp} className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-ink-500">Estado</div><div className="mt-1.5"><StagePill stage={stage} /></div></Card>
        <Card className="p-4"><div className="text-xs text-ink-500">Contactados</div><div className="mt-1 text-[14px] font-semibold text-ink-900" data-testid="trk-contacted">{sum.contacted.length ? sum.contacted.map(c => c.name).join(', ') : <i className="font-normal text-ink-400">ninguno todavía</i>}</div></Card>
        <Card className="p-4"><div className="text-xs text-ink-500">Elegido</div><div className="mt-1 text-[14px] font-semibold text-ink-900" data-testid="trk-chosen">{sum.chosen ? sum.chosen.name : <i className="font-normal text-ink-400">ninguno todavía</i>}</div></Card>
      </motion.div>

      {/* estado */}
      <motion.section variants={fadeUp} className="mt-8">
        <SectionTitle>Estado de la estación</SectionTitle>
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-ink-100/70 p-1.5" role="group" aria-label="Estado de la estación">
          {STAGES.map(s => {
            const adminOnly = (s.v === 'covered' || stage === 'covered') && s.v !== stage;
            const blocked = !canWrite || (adminOnly && !isAdmin);
            const on = s.v === stage;
            return (
              <button
                key={s.v}
                disabled={blocked || busy === 'stage'}
                title={!canWrite ? 'Solo consulta' : blocked ? 'Solo los administradores pueden cerrar o reabrir una estación' : undefined}
                onClick={() => setStage(s.v)}
                className={cn('relative flex-1 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed', on ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800 disabled:opacity-40 disabled:hover:text-ink-500')}
                aria-pressed={on}
              >
                {on && <motion.span layoutId="stage-on" transition={spring} className="absolute inset-0 rounded-xl bg-white shadow-card ring-1 ring-ink-150" />}
                <span className="relative flex items-center justify-center gap-1.5 whitespace-nowrap">
                  {on && <span className={cn('size-1.5 rounded-full', { brand: 'bg-brand-600', warning: 'bg-amber-500', info: 'bg-sky-500', violet: 'bg-violet-500', success: 'bg-emerald-500' }[STAGE_TONE[s.v]])} />}
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[13px] text-ink-500">
          {def.hint}{' '}
          {canWrite && <span className="text-ink-400">{isAdmin ? 'Cambia solo al marcar contactados o elegir; «Provisional» y «Cubierta» las marcas tú.' : 'Cambia solo al marcar contactados o elegir; «Provisional» la marcas tú y «Cubierta» la marca un administrador.'}</span>}
        </p>
      </motion.section>

      {/* proveedores */}
      <motion.section variants={fadeUp} className="mt-8">
        <SectionTitle count={rows.length}>Proveedores que pueden cubrirla</SectionTitle>
        <Card className="divide-y divide-ink-100 overflow-hidden">
          {rows.length === 0 && <div className="px-5 py-8 text-center text-sm text-ink-500">No hay proveedores en el listado para esta estación. Puedes apuntar uno abajo.</div>}
          <AnimatePresence initial={false}>
            {rows.map(r => (
              <ProviderLine key={r.name} row={r} busy={busy === 'prov:' + r.name} readOnly={!canWrite}
                onContacted={v => setProvider(r.name, v ? 'contacted' : 'identified')}
                onChoose={() => setProvider(r.name, 'selected')}
                onUnchoose={() => setProvider(r.name, 'contacted')}
                onRemove={() => removeProvider(r.name)}
              />
            ))}
          </AnimatePresence>
          {canWrite && <AddProvider code={code} existing={name => !!candOf(name) || suggestions(code, stations, altStations).some(s => s.name.toLowerCase() === name.toLowerCase())} onAdd={name => mutate('add', () => api<TrackingSnapshot>(`/api/tracking/${code}/candidates`, { method: 'POST', body: { provider_name: name } }), 'Proveedor añadido a esta estación')} />}
        </Card>
      </motion.section>

      {/* notas */}
      <motion.section variants={fadeUp} className="mt-8">
        <SectionTitle>Notas</SectionTitle>
        <Notes key={note.updated_at ?? 0} initial={note.note || ''} readOnly={!canWrite} updated={note.updated_at ? `Última actualización ${timeAgo(note.updated_at)} · ${who(note.updated_by)}` : ''}
          onSave={text => mutate('note', () => api<TrackingSnapshot>(`/api/tracking/${code}`, { method: 'PATCH', body: { note: text } }), 'Notas guardadas')} saving={busy === 'note'} />
      </motion.section>

      {fc && (
        <motion.section variants={fadeUp} className="mt-8">
          <SectionTitle>F-CAMO-IBE-14</SectionTitle>
          <Link to={`/fcamo/${fc.id}`} className="group flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink-150 shadow-card transition-shadow hover:shadow-lift">
            <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600"><ClipboardCheck className="size-5" /></span>
            <span className="flex-1 text-sm text-ink-700"><b className="font-semibold text-ink-900">{fc.status === 'completed' ? 'Completado' : 'Abierto'}</b> para esta estación · {fcamoProgress(fc).done}/{fcamoProgress(fc).total} puntos</span>
            <span className="text-sm font-medium text-brand-600 group-hover:underline">Abrir →</span>
          </Link>
        </motion.section>
      )}
    </motion.div>
  );
}

function ProviderLine({ row: r, busy, readOnly, onContacted, onChoose, onUnchoose, onRemove }: {
  row: ProviderRow; busy: boolean; readOnly: boolean;
  onContacted: (v: boolean) => void; onChoose: () => void; onUnchoose: () => void; onRemove: () => void;
}) {
  const state = r.cand ? candState(r.cand.status) : 'identified';
  const chosen = state === 'selected';
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} data-testid="trk-provider" data-name={r.name}
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors', chosen && 'bg-sky-50/60', busy && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-semibold text-ink-900">{r.name}</span>
          {r.easa && <Badge>EASA {r.easa}</Badge>}
          <AnimatePresence>{chosen && <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}><Badge tone="info"><Star className="size-2.5 fill-current" /> Elegido</Badge></motion.span>}</AnimatePresence>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-500">
          {r.email && <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:text-ink-800"><Mail className="size-3" />{r.email}</a>}
          {r.phone && <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1 hover:text-ink-800"><Phone className="size-3" />{r.phone}</a>}
          {!r.email && !r.phone && r.orphan && <span>Fuera del listado de proveedores no contratados</span>}
        </div>
      </div>
      <Checkbox checked={state !== 'identified'} disabled={chosen || readOnly || busy} onCheckedChange={onContacted} label="Contactado" className="text-[13px]" />
      {!readOnly && (chosen
        ? <Button size="sm" variant="secondary" onClick={onUnchoose} disabled={busy}>Quitar elección</Button>
        : <Button size="sm" variant="dark" icon={<Check />} onClick={onChoose} disabled={busy}>Elegir</Button>)}
      {!readOnly && r.orphan && r.cand && (
        <button onClick={onRemove} disabled={busy} className="grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-brand-50 hover:text-brand-600" aria-label={`Quitar ${r.name} de la lista`}><X className="size-4" /></button>
      )}
    </motion.div>
  );
}

function AddProvider({ existing, onAdd }: { code: string; existing: (name: string) => boolean; onAdd: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  async function add() {
    const n = name.trim();
    if (!n) { toast.error('Escribe el nombre del proveedor'); ref.current?.focus(); return; }
    if (existing(n)) { toast.error('Ese proveedor ya está en la lista'); return; }
    const ok = await onAdd(n);
    if (ok) { setName(''); ref.current?.focus(); }
  }
  return (
    <div className="flex gap-2 bg-ink-50/60 px-5 py-3.5">
      <Input ref={ref} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} maxLength={120} placeholder="¿Otro proveedor que pueda cubrirla? Escribe su nombre…" aria-label="Nombre del proveedor" />
      <Button variant="secondary" icon={<Plus />} onClick={add}>Añadir</Button>
    </div>
  );
}

function Notes({ initial, readOnly, updated, onSave, saving }: { initial: string; readOnly: boolean; updated: string; onSave: (t: string) => void; saving: boolean }) {
  const [text, setText] = useState(initial);
  const dirty = text !== initial;
  return (
    <div>
      <Textarea value={text} onChange={e => setText(e.target.value)} readOnly={readOnly} maxLength={2000} rows={4} placeholder={readOnly ? '' : 'Cualquier cosa que convenga recordar de esta estación…'} aria-label="Notas" />
      <div className="mt-2.5 flex items-center gap-3">
        {!readOnly && <Button variant="primary" size="sm" onClick={() => onSave(text)} disabled={!dirty} loading={saving}>Guardar notas</Button>}
        <span className="text-xs text-ink-400">{updated}</span>
        <AnimatePresence>{dirty && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs font-medium text-amber-700">Cambios sin guardar</motion.span>}</AnimatePresence>
      </div>
    </div>
  );
}
