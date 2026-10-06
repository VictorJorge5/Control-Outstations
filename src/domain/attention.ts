import type { FcamoItem, Station, StationNote } from '@/lib/types';
import { flightInfo, flightText, normStage, stageLabel, uncoveredCodes } from './tracking';

// "Requiere atencion" de la portada: lo que alguien deberia mirar hoy, de mas a menos urgente.

export type Severity = 'critical' | 'high' | 'medium';

export interface AttentionItem {
  key: string;
  severity: Severity;
  code: string;
  title: string;
  detail: string;
  to: string;
}

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };
const DAY = 86400;

export function attentionItems(stations: Station[], notes: StationNote[], fcamo: FcamoItem[], nowSec = Math.floor(Date.now() / 1000)): AttentionItem[] {
  const byCode = new Map(stations.map(s => [s.code, s]));
  const noteBy = new Map(notes.map(n => [n.station_code, n]));
  const out: (AttentionItem & { sort: number })[] = [];

  // estaciones con vuelo y sin proveedor: urgencia segun el primer vuelo y la fase del seguimiento
  for (const code of uncoveredCodes(stations)) {
    const note = noteBy.get(code);
    if (note?.covered) continue;
    const stage = normStage(note?.stage);
    if (stage === 'interim' || stage === 'covered') continue;
    const s = byCode.get(code)!;
    const f = flightInfo(s);
    const severity: Severity = f.operating ? 'critical' : f.days !== null && f.days <= 14 ? 'high' : 'medium';
    out.push({
      key: 'trk-' + code, severity, code,
      title: `${s.city} sin proveedor`,
      detail: `${flightText(f)} · ${stageLabel(stage)}`,
      to: `/seguimiento/${code}`,
      sort: f.days ?? 9999,
    });
  }

  // F-CAMO abiertos: mas de 14 dias sin tocar pasa a prioridad alta
  for (const it of fcamo) {
    if (it.status === 'completed' || it.deleted) continue;
    const last = it.updated_at || it.created_at;
    const idle = Math.max(0, Math.floor((nowSec - last) / DAY));
    out.push({
      key: 'fc-' + it.id, severity: idle > 14 ? 'high' : 'medium', code: it.station_code,
      title: `F-CAMO de ${byCode.get(it.station_code)?.city || it.station_code} abierto`,
      detail: `${it.company_name || 'Sin empresa'} · ${idle === 0 ? 'actualizado hoy' : idle === 1 ? 'sin cambios desde ayer' : `sin cambios desde hace ${idle} días`}`,
      to: `/fcamo/${it.id}`,
      sort: 10000 - idle,
    });
  }

  // pernoctas en estaciones sin proveedor contratado (el avion pasa la noche sin asistencia)
  for (const s of stations) {
    if (!s.pernocta || !s.pending) continue;
    const nights = Object.values(s.pernocta_by_month || {}).reduce((a, n) => a + n, 0);
    out.push({
      key: 'pn-' + s.code, severity: 'medium', code: s.code,
      title: `Pernocta en ${s.city} sin proveedor`,
      detail: `${nights} noche${nights === 1 ? '' : 's'} con avión en la temporada`,
      to: `/pernoctas?estacion=${s.code}&tab=pernocta`,
      sort: 20000 - nights,
    });
  }

  return out
    .sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.sort - b.sort)
    .map(({ sort: _sort, ...it }) => it);
}
