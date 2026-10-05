import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fadeUp, stagger } from '@/lib/motion';
import { useAppData } from '@/lib/queries';
import { usePermissions } from '@/lib/session';
import type { FcamoItem } from '@/lib/types';
import { FCAMO_FLEET_SCOPE, FCAMO_REASONS, FCAMO_STATION_TYPES } from '@/domain/fcamo';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/controls';
import { Card, Field, Input, Select } from '@/components/ui/primitives';
import { Page, PageHeader } from '@/components/layout/Page';

export default function FcamoNewPage() {
  const { sortedStations } = useAppData();
  const { canWrite } = usePermissions();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [reason, setReason] = useState(FCAMO_REASONS[0].value);
  const [station, setStation] = useState(sortedStations[0]?.code || '');
  const [types, setTypes] = useState<string[]>([]);
  const [fleet, setFleet] = useState<string[]>([]);
  const [company, setCompany] = useState('');
  const [easaRef, setEasaRef] = useState('');
  const [easaDate, setEasaDate] = useState('');
  const [busy, setBusy] = useState(false);

  if (!canWrite) return <Navigate to="/fcamo" replace />;
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter(x => x !== v));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { item } = await api<{ item: FcamoItem }>('/api/fcamo', {
        method: 'POST',
        body: { station_code: station, reason, station_types: types, company_name: company.trim(), easa_ref: easaRef.trim(), easa_date: easaDate.trim(), fleet_scope: fleet },
      });
      qc.setQueryData(['fcamo', 'item', item.id], item);
      qc.invalidateQueries({ queryKey: ['fcamo'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      toast.success(`F-CAMO-IBE-14 creado para ${item.station_code}`);
      navigate(`/fcamo/${item.id}`, { replace: true });
    } catch (err) {
      toast.error('No se ha podido crear', { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page width="narrow">
      <PageHeader back={{ to: '/fcamo', label: 'Todos los F-CAMO-IBE-14' }} eyebrow="F-CAMO-IBE-14" title="Nuevo checklist" description="Datos de la estación y de la organización de mantenimiento." />
      <motion.form onSubmit={submit} variants={stagger(0.06)} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={fadeUp}>
          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-[14px] font-semibold text-ink-900">Reason of F-CAMO-IBE-14</h2>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Motivo">
              {FCAMO_REASONS.map(r => (
                <button type="button" key={r.value} role="radio" aria-checked={reason === r.value} onClick={() => setReason(r.value)}
                  className={cn('rounded-xl p-4 text-left text-[13.5px] ring-1 ring-inset transition-all', reason === r.value ? 'bg-brand-50/60 text-ink-900 ring-2 ring-brand-500' : 'bg-white text-ink-600 ring-ink-200 hover:ring-ink-300')}>
                  <span className={cn('mb-2 grid size-4 place-items-center rounded-full ring-1', reason === r.value ? 'bg-brand-600 ring-brand-600' : 'ring-ink-300')}>
                    {reason === r.value && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  {r.label}
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="text-[14px] font-semibold text-ink-900">Station info</h2>
            <Field label="IATA Code" htmlFor="fcamo-station">
              <Select id="fcamo-station" value={station} onChange={e => setStation(e.target.value)} className="sm:max-w-sm">
                {sortedStations.map(s => <option key={s.code} value={s.code}>{s.code} — {s.city}</option>)}
              </Select>
            </Field>
            <div>
              <div className="mb-2 text-[12.5px] font-medium text-ink-600">Station Type</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {FCAMO_STATION_TYPES.map(t => <Checkbox key={t} checked={types.includes(t)} onCheckedChange={v => setTypes(l => toggle(l, t, v))} label={t} />)}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="text-[14px] font-semibold text-ink-900">Main organization data</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Company name" htmlFor="fcamo-company"><Input id="fcamo-company" value={company} onChange={e => setCompany(e.target.value)} maxLength={200} /></Field>
              <Field label="EASA approval reference" htmlFor="fcamo-easaref"><Input id="fcamo-easaref" value={easaRef} onChange={e => setEasaRef(e.target.value)} maxLength={100} /></Field>
              <Field label="Last EASA approval date" htmlFor="fcamo-easadate"><Input id="fcamo-easadate" value={easaDate} onChange={e => setEasaDate(e.target.value)} placeholder="dd-MM-yyyy" maxLength={30} /></Field>
            </div>
            <div>
              <div className="mb-2 text-[12.5px] font-medium text-ink-600">Scope / Approved Fleet</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {FCAMO_FLEET_SCOPE.map(f => <Checkbox key={f} checked={fleet.includes(f)} onCheckedChange={v => setFleet(l => toggle(l, f, v))} label={f} />)}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="flex justify-end gap-2 pt-2">
          <Button onClick={() => navigate('/fcamo')}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={busy}>Crear F-CAMO-IBE-14</Button>
        </motion.div>
      </motion.form>
    </Page>
  );
}
