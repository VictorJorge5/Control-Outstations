// Forma de los datos que sirve el Worker (worker/src/index.js).

export type Role = 'admin' | 'user' | 'viewer';

/** Fila del horario: [fecha "15/SEP/2026", frecuencia, vuelo, origen, terminal salida, hora salida,
 *  destino, terminal llegada, hora llegada, subflota] */
export type ScheduleRow = [string, string, string, string, string, string, string, string, string, string];

export interface Contact {
  number: string;
  description: string;
  main?: boolean;
}

export interface EasaApproval {
  approval_number: string;
  vendor: string;
  fleet: Record<string, boolean>;
  contacts: Contact[];
}

export interface AltProvider {
  supplier: string;
  easa?: string;
  email?: string;
  phone?: string;
  hours?: string;
  comments?: string;
  fleet: Record<string, boolean>;
}

export interface PernoctaOccurrence {
  arr_flight: string; arr_from: string; arr_from_time: string; arr_to: string; arr_to_time: string;
  dep_flight: string; dep_from: string; dep_from_time: string; dep_to: string; dep_to_time: string;
}

export interface Station {
  code: string;
  city: string;
  country: string;
  name?: string;
  lat: number;
  lon: number;
  providers: string[];
  easa?: EasaApproval[];
  alt_providers?: AltProvider[];
  in_schedule: boolean;
  pending: boolean;
  flights: number;
  pernocta: boolean;
  pernocta_by_month?: Record<string, number>;
  /** Solo en la version completa de /api/data (Worker antiguo) o tras pedir /api/station/:code */
  schedule?: ScheduleRow[];
  pernocta_by_date?: Record<string, PernoctaOccurrence[]>;
  /** Version lite de /api/data: primer vuelo ya calculado ("15/SEP/2026") */
  first_flight?: string | null;
}

export interface AltStation {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  providers: AltProvider[];
}

export interface AppData {
  stations: Station[];
  alt_stations: AltStation[];
  pernocta_months: string[];
  /** Ultima carga de datos (segundos unix); null con un Worker antiguo */
  data_updated_at?: number | null;
}

export interface StationDetails {
  schedule: ScheduleRow[];
  pernocta_by_date: Record<string, PernoctaOccurrence[]>;
}

export interface FcamoItem {
  id: number;
  station_code: string;
  reason: string;
  station_types: string;   // JSON
  company_name: string;
  easa_ref: string;
  easa_date: string;
  fleet_scope: string;     // JSON
  items_state: string;     // JSON
  approved_by: string;
  approved_date: string;
  status: string;
  created_by: string;
  created_at: number;
  updated_at: number | null;
  deleted?: number;
  deleted_by?: string;
  deleted_at?: number | null;
}

export interface StationNote {
  station_code: string;
  note: string;
  covered: number;
  stage: string;
  updated_by: string;
  updated_at: number | null;
}

export interface Candidate {
  id: number;
  station_code: string;
  provider_name: string;
  status: string;
  created_by: string;
  created_at: number;
  updated_by: string;
  updated_at: number;
}

export interface TrackingSnapshot {
  ok?: boolean;
  note?: StationNote | null;
  candidates?: Candidate[];
  replaced?: string[];
}

export interface ActivityEntry {
  type: 'note' | 'fcamo';
  station_code: string;
  action: string;
  value?: string;
  fcamo_id?: number;
  changed_by: string;
  changed_at: number;
}

export interface User {
  email: string;
  role: Role;
  is_admin: boolean;
  show_data_badge: number;
  must_change_password: number;
  created_at: number;
  updated_at: number | null;
}

export interface AuditEntry {
  id: number;
  target_email: string;
  action: string;
  detail: string;
  changed_by: string;
  changed_at: number;
}

export interface LoginResponse {
  token?: string;
  email?: string;
  role?: Role;
  is_admin?: boolean;
  show_data_badge?: boolean;
  must_change?: boolean;
  error?: string;
}
