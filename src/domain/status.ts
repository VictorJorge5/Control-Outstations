import type { Station } from '@/lib/types';

// Estado de una estacion de la red contratada. Colores validados con el validador de paleta
// (dataviz): siempre van acompañados de etiqueta, nunca solo color.
export type StationStatus = 'assigned' | 'pending' | 'inactive';

export const STATUS_META: Record<StationStatus, { label: string; color: string; short: string }> = {
  assigned: { label: 'Asignada · con vuelo', short: 'Asignada', color: '#16865A' },
  pending: { label: 'Sin proveedor', short: 'Sin proveedor', color: '#D48C0F' },
  inactive: { label: 'Sin vuelo esta temporada', short: 'Sin vuelo', color: '#98A1AD' },
};
export const ALT_COLOR = '#6B7583';

export function stationStatus(s: Station): StationStatus {
  if (s.pending) return 'pending';
  if (!s.in_schedule) return 'inactive';
  return 'assigned';
}
