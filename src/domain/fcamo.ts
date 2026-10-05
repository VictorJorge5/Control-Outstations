import type { FcamoItem } from '@/lib/types';

// F-CAMO-IBE-14: checklist de apertura / actualizacion de estacion (mantener en sintonia con el Worker).

export const FCAMO_REASONS = [
  { value: 'opening', label: 'New Maintenance Organization / Station opening' },
  { value: 'update', label: 'Maintenance Organization or Station feature update' },
];
export const FCAMO_STATION_TYPES = ['ETOPS', 'Overnight', 'On call'];
export const FCAMO_FLEET_SCOPE = ['A320 FAMILY', 'A321 XLR', 'A330', 'A350'];

export interface FcamoSection { key: string; label: string; hideIfOnCall?: boolean; items: { id: string; label: string }[] }

export const FCAMO_SECTIONS: FcamoSection[] = [
  { key: 'amos', label: 'AMOS', items: [
    { id: 'amos_org_setup', label: 'Maintenance Organization set up (APN 2207)' },
    { id: 'amos_contacts', label: 'Station contacts created / updated (APN 53)' },
    { id: 'amos_store_address', label: 'Store address created / updated (APN 53)' },
  ] },
  { key: 'aviatar', label: 'AVIATAR (Logbook central)', items: [
    { id: 'aviatar_can', label: 'Company Approval Numbers set up' },
    { id: 'aviatar_rts', label: 'Release to Service Workflows validated' },
  ] },
  { key: 'staff', label: 'Certifying and general staff', hideIfOnCall: true, items: [
    { id: 'staff_credentials', label: 'Credentials Provisioning (IB Domain)' },
    { id: 'staff_apps', label: 'IB apps access granted' },
    { id: 'staff_lshm', label: 'LSHM / NTO05 course' },
    { id: 'staff_etlb_course', label: 'AMOS mobile / E-TLB course' },
  ] },
  { key: 'docs', label: 'Maintenance Organization documentation', items: [
    { id: 'docs_form3', label: 'EASA Form 3' },
    { id: 'docs_moe', label: 'MOE (scope at the station)' },
    { id: 'docs_ssar', label: 'SSAR fulfilled' },
    { id: 'docs_sgha', label: 'SGHA signed' },
    { id: 'docs_tpaa', label: 'Third Party Application Access Agreement (if not existing)' },
  ] },
  { key: 'materials', label: 'Materials Management', items: [
    { id: 'mat_iatp', label: 'IATP Pool or MBK' },
    { id: 'mat_flightkit', label: 'Flight Kit operation' },
    { id: 'mat_fluids', label: 'Fluids (OIL/HYD) stock' },
    { id: 'mat_oss', label: 'OSS consumables sent (if applicable)' },
    { id: 'mat_parts_alerts', label: 'Parts alerts parametrization done (APN 313)' },
    { id: 'mat_store_locations', label: 'Store locations created (APN 2409)' },
  ] },
  { key: 'addition', label: 'Addition', hideIfOnCall: true, items: [
    { id: 'add_etlb_keys', label: 'E-TLB padlock keys sent' },
  ] },
];

export function fcamoSections(stationTypes: string[]) {
  const onCall = stationTypes.includes('On call');
  return FCAMO_SECTIONS.filter(s => !(s.hideIfOnCall && onCall));
}
export function fcamoAllItems(stationTypes: string[]) {
  return fcamoSections(stationTypes).flatMap(s => s.items);
}

// los datos de F-CAMO los escribe cualquier usuario: nunca se fia uno de su formato
export function safeJson<T extends unknown[] | Record<string, unknown>>(str: string | null | undefined, fallback: T): T {
  try {
    const v = JSON.parse(String(str));
    const ok = Array.isArray(fallback) ? Array.isArray(v) : (v && typeof v === 'object' && !Array.isArray(v));
    return ok ? v : fallback;
  } catch {
    return fallback;
  }
}

export const fcamoTypes = (item: FcamoItem) => safeJson<string[]>(item.station_types, []).map(String);
export const fcamoFleet = (item: FcamoItem) => safeJson<string[]>(item.fleet_scope, []).map(String);
export const fcamoState = (item: FcamoItem) => safeJson<Record<string, boolean>>(item.items_state, {});
export const fcamoStatus = (item: FcamoItem): 'completed' | 'pending' => (item.status === 'completed' ? 'completed' : 'pending');
export const fcamoReasonLabel = (reason: string) => FCAMO_REASONS.find(r => r.value === reason)?.label || reason;

export function fcamoProgress(item: FcamoItem, state = fcamoState(item)) {
  const all = fcamoAllItems(fcamoTypes(item));
  const done = all.filter(it => state[it.id]).length;
  return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
}
