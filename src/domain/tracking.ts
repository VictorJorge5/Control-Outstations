import { parseDateStr } from '@/lib/format';
import type { AltStation, Candidate, FcamoItem, Station, StationNote } from '@/lib/types';

// Seguimiento de estaciones con vuelo y sin proveedor contratado. Por cada estacion importan tres cosas:
// a quien hemos contactado, a quien hemos elegido y en que situacion esta.

export type Stage = 'none' | 'searching' | 'selected' | 'interim' | 'covered';

export const STAGES: { v: Stage; label: string; hint: string }[] = [
  { v: 'none', label: 'Sin gestionar', hint: 'Todavía no hemos contactado con ningún proveedor.' },
  { v: 'searching', label: 'En búsqueda', hint: 'Estamos contactando proveedores.' },
  { v: 'selected', label: 'Proveedor elegido', hint: 'Ya hay proveedor elegido; falta cerrar el contrato.' },
  { v: 'interim', label: 'Solución provisional', hint: 'Cubierta temporalmente por otra vía.' },
  { v: 'covered', label: 'Cubierta', hint: 'Ya tiene proveedor contratado; sale del seguimiento.' },
];

export const stageLabel = (v: string) => (STAGES.find(s => s.v === v) || STAGES[0]).label;

// las fases del sistema anterior (contactado / negociando) cuentan como "en busqueda"
export function normStage(v: string | null | undefined): Stage {
  if (v === 'contacted' || v === 'negotiating') return 'searching';
  return STAGES.some(s => s.v === v) ? (v as Stage) : 'none';
}

export type CandState = 'identified' | 'contacted' | 'selected';
// estado de un proveedor: pendiente | contactado | elegido (los antiguos offer/negotiating = contactado)
export function candState(status: string): CandState {
  if (status === 'selected') return 'selected';
  if (status === 'contacted' || status === 'offer' || status === 'negotiating') return 'contacted';
  return 'identified';
}
export function candLabel(status: string) {
  return ({ selected: 'Elegido', contacted: 'Contactado', identified: 'Pendiente', offer: 'Oferta recibida', negotiating: 'Negociando', discarded: 'Descartado' } as Record<string, string>)[status] || 'Pendiente';
}

export interface TrackingData {
  notes: Record<string, StationNote>;
  cands: Record<string, Candidate[]>;
  /** F-CAMO mas relevante por estacion (uno pendiente antes que uno completado) */
  fcamo: Record<string, FcamoItem>;
}

export function buildTrackingData(notes: StationNote[], candidates: Candidate[], fcamo: FcamoItem[]): TrackingData {
  const out: TrackingData = { notes: {}, cands: {}, fcamo: {} };
  notes.forEach(n => { out.notes[n.station_code] = n; });
  candidates.forEach(c => { (out.cands[c.station_code] ||= []).push(c); });
  fcamo.forEach(f => {
    const cur = out.fcamo[f.station_code];
    if (!cur || (cur.status === 'completed' && f.status !== 'completed')) out.fcamo[f.station_code] = f;
  });
  return out;
}

export const uncoveredCodes = (stations: Station[]) => stations.filter(s => s.pending && s.in_schedule).map(s => s.code);

const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

export interface FlightInfo {
  first: Date | null;
  days: number | null;
  operating: boolean;
  movements: number;
  city: string;
  country: string;
}

/** Primer vuelo de la estacion y cuantos dias faltan (para ordenar por urgencia) */
export function flightInfo(s: Station | undefined): FlightInfo {
  let first: Date | null = null;
  if (s?.schedule) {
    for (const r of s.schedule) {
      const d = parseDateStr(r[0]);
      if (!isNaN(d.getTime()) && (!first || d < first)) first = d;
    }
  } else if (s?.first_flight) {
    first = parseDateStr(s.first_flight); // version lite de /api/data: el Worker ya lo trae calculado
  }
  const t = today();
  const days = first ? Math.round((first.getTime() - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000) : null;
  return {
    first, days, operating: days !== null && days <= 0,
    movements: s ? (s.flights || (s.schedule || []).length) : 0,
    city: s?.city || '', country: s?.country || '',
  };
}

export function flightText(f: FlightInfo) {
  if (!f.first || f.days === null) return 'Sin vuelos programados';
  const d = f.first.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (f.days <= 0) return `Ya opera desde el ${d}`;
  if (f.days === 1) return `Primer vuelo mañana (${d})`;
  return `Primer vuelo en ${f.days} días (${d})`;
}

export type Urgency = 'crit' | 'high' | '';
export function urgency(f: FlightInfo, stage: Stage): Urgency {
  if (stage === 'interim' || stage === 'covered' || !f.first || f.days === null) return '';
  return f.operating ? 'crit' : f.days <= 14 ? 'high' : '';
}

export const noteOf = (t: TrackingData, code: string): StationNote =>
  t.notes[code] || { station_code: code, stage: 'none', note: '', covered: 0, updated_by: '', updated_at: null };
export const stageOf = (t: TrackingData, code: string) => normStage(noteOf(t, code).stage);

export interface ProviderSuggestion { name: string; easa: string; email: string; phone: string }

/** Proveedores que pueden cubrir la estacion (datos de proveedores no contratados) */
export function suggestions(code: string, stations: Station[], altStations: AltStation[]): ProviderSuggestion[] {
  const out: ProviderSuggestion[] = [];
  const seen = new Set<string>();
  const add = (p: { supplier?: string; easa?: string; email?: string; phone?: string }) => {
    const name = String(p.supplier || '').trim();
    const k = name.toLowerCase();
    if (!name || seen.has(k)) return;
    seen.add(k);
    out.push({ name, easa: p.easa || '', email: p.email || '', phone: p.phone || '' });
  };
  altStations.find(x => x.code === code)?.providers.forEach(add);
  stations.find(x => x.code === code)?.alt_providers?.forEach(add);
  return out;
}

export interface ProviderRow extends ProviderSuggestion { cand: Candidate | null; orphan: boolean }

// una fila por proveedor del listado + los apuntados que no estan en el listado (a mano, o porque
// se actualizaron los datos): se siguen mostrando para no perder el seguimiento
export function providerRows(t: TrackingData, code: string, stations: Station[], altStations: AltStation[]): ProviderRow[] {
  const stored = t.cands[code] || [];
  const byName = new Map(stored.map(c => [c.provider_name.trim().toLowerCase(), c]));
  const rows: ProviderRow[] = [];
  const used = new Set<number>();
  suggestions(code, stations, altStations).forEach(s => {
    const c = byName.get(s.name.toLowerCase());
    if (c) used.add(c.id);
    rows.push({ ...s, cand: c || null, orphan: false });
  });
  stored.forEach(c => { if (!used.has(c.id)) rows.push({ name: c.provider_name, easa: '', email: '', phone: '', cand: c, orphan: true }); });
  const rank = (r: ProviderRow) => { const st = r.cand ? candState(r.cand.status) : 'identified'; return st === 'selected' ? 0 : st === 'contacted' ? 1 : 2; };
  return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'));
}

export function summary(t: TrackingData, code: string) {
  const st = (t.cands[code] || []).map(c => ({ name: c.provider_name, state: candState(c.status) }));
  return {
    chosen: st.find(c => c.state === 'selected') || null,
    contacted: st.filter(c => c.state !== 'identified'),
  };
}

export interface TrackingItem {
  code: string;
  stage: Stage;
  note: StationNote;
  flight: FlightInfo;
  sum: ReturnType<typeof summary>;
}

export function trackingItems(t: TrackingData, stations: Station[]): TrackingItem[] {
  return uncoveredCodes(stations).map(code => ({
    code, stage: stageOf(t, code), note: noteOf(t, code),
    flight: flightInfo(stations.find(s => s.code === code)), sum: summary(t, code),
  }));
}

export type StageFilter = 'all' | Stage;

export function stageCounts(items: TrackingItem[]) {
  const c: Record<StageFilter, number> = { all: 0, none: 0, searching: 0, selected: 0, interim: 0, covered: 0 };
  items.forEach(it => { c[it.stage]++; if (it.stage !== 'covered') c.all++; });
  return c;
}

export function visibleItems(items: TrackingItem[], filter: StageFilter, q: string) {
  let out = filter === 'all' ? items.filter(i => i.stage !== 'covered') : items.filter(i => i.stage === filter);
  const query = q.trim().toLowerCase();
  if (query) {
    out = out.filter(i => [i.code, i.flight.city, i.flight.country, ...i.sum.contacted.map(c => c.name)].join(' ').toLowerCase().includes(query));
  }
  // los que ya operan primero (mas movimientos antes); despues, por fecha de primer vuelo
  return out.sort((a, b) => {
    if (a.flight.operating !== b.flight.operating) return a.flight.operating ? -1 : 1;
    if (a.flight.operating) return b.flight.movements - a.flight.movements;
    return (a.flight.first ? a.flight.first.getTime() : Infinity) - (b.flight.first ? b.flight.first.getTime() : Infinity);
  });
}

/** Resumen por estado para la portada (a partir de las notas) */
export function homeTrackingSummary(stations: Station[], notes: StationNote[]) {
  const byCode: Record<string, StationNote> = {};
  notes.forEach(n => { byCode[n.station_code] = n; });
  const pend = uncoveredCodes(stations).filter(c => !(byCode[c] && byCode[c].covered));
  const cnt = { none: 0, searching: 0, selected: 0, interim: 0 };
  pend.forEach(c => {
    const st = normStage(byCode[c]?.stage);
    if (st in cnt) cnt[st as keyof typeof cnt]++;
  });
  return { pending: pend.length, counts: cnt };
}
