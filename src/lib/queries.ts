import { createContext, useContext } from 'react';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { api } from './api';
import { usePermissions } from './session';
import type { ActivityEntry, AltStation, AppData, AuditEntry, Candidate, FcamoItem, Station, StationDetails, StationNote, User } from './types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => count < 2 && !(err && 'status' in err && [401, 403, 404].includes((err as { status: number }).status)),
      refetchOnWindowFocus: true,
    },
  },
});

// ---- datos base (estaciones, alternativos, meses de pernocta): se cargan una vez tras el login ----

export async function fetchAppData(): Promise<AppData> {
  // lite=1: sin horarios ni pernoctas por dia (se piden al abrir cada ficha); un Worker antiguo lo ignora
  return api<AppData>('/api/data?lite=1');
}

export interface AppDataValue {
  stations: Station[];
  altStations: AltStation[];
  months: string[];
  sortedStations: Station[];
  sortedAltStations: AltStation[];
  providers: string[];
  altProviders: string[];
  stationByCode: Map<string, Station>;
  altByCode: Map<string, AltStation>;
}

export function buildAppData(d: AppData): AppDataValue {
  const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);
  return {
    stations: d.stations,
    altStations: d.alt_stations,
    months: d.pernocta_months,
    sortedStations: [...d.stations].sort(byCode),
    sortedAltStations: [...d.alt_stations].sort(byCode),
    providers: [...new Set(d.stations.flatMap(s => s.providers))].sort(),
    altProviders: [...new Set(d.alt_stations.flatMap(s => s.providers.map(p => p.supplier)))].sort(),
    stationByCode: new Map(d.stations.map(s => [s.code, s])),
    altByCode: new Map(d.alt_stations.map(s => [s.code, s])),
  };
}

export const AppDataContext = createContext<AppDataValue | null>(null);
export function useAppData(): AppDataValue {
  const v = useContext(AppDataContext);
  if (!v) throw new Error('useAppData fuera de AppDataContext');
  return v;
}

// ---- detalle pesado de una estacion (horario y pernoctas dia a dia) ----

export function useStationDetails(station: Station | undefined) {
  const legacy = station?.schedule ? { schedule: station.schedule, pernocta_by_date: station.pernocta_by_date || {} } : undefined;
  return useQuery({
    queryKey: ['station', station?.code],
    queryFn: async () => {
      const d = await api<StationDetails>(`/api/station/${encodeURIComponent(station!.code)}`);
      return { schedule: d.schedule || [], pernocta_by_date: d.pernocta_by_date || {} };
    },
    enabled: !!station && !legacy,
    staleTime: Infinity,
    initialData: legacy,
  });
}

// ---- F-CAMO ----

export const useFcamoList = () => useQuery({
  queryKey: ['fcamo'],
  queryFn: () => api<{ items: FcamoItem[] }>('/api/fcamo').then(d => d.items),
});
export const useFcamoItem = (id: number | null) => useQuery({
  queryKey: ['fcamo', 'item', id],
  queryFn: () => api<{ item: FcamoItem }>(`/api/fcamo/${id}`).then(d => d.item),
  enabled: id !== null && Number.isInteger(id),
});
export const useFcamoTrash = (enabled: boolean) => useQuery({
  queryKey: ['fcamo', 'trash'],
  queryFn: () => api<{ items: FcamoItem[] }>('/api/fcamo/trash').then(d => d.items),
  enabled,
});

// ---- seguimiento ----

export const useTrackingRaw = (opts: { poll?: boolean } = {}) => useQuery({
  queryKey: ['tracking'],
  queryFn: () => api<{ notes: StationNote[]; candidates: Candidate[] }>('/api/tracking'),
  refetchInterval: opts.poll ? 60_000 : false,
  refetchIntervalInBackground: false,
});

export const useNotes = () => useQuery({
  queryKey: ['notes'],
  queryFn: () => api<{ items: StationNote[] }>('/api/notes').then(d => d.items),
});

// ---- actividad ----

export const useActivity = () => useQuery({
  queryKey: ['activity'],
  queryFn: () => api<{ items: ActivityEntry[] }>('/api/activity').then(d => d.items),
});

// ---- usuarios (solo admin) ----

export function useUsers() {
  const { isAdmin } = usePermissions();
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api<{ items: User[] }>('/api/admin-users').then(d => d.items),
    enabled: isAdmin,
  });
}
export const useAudit = () => useQuery({
  queryKey: ['users', 'audit'],
  queryFn: () => api<{ items: AuditEntry[] }>('/api/admin-users/audit').then(d => d.items),
});
