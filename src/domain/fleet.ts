// Flotas y subflotas: columnas de las tablas de cobertura y colores del horario (mismos que el Excel V18).

export const SUBFLEET_COLOR: Record<string, string> = {
  'A319 CEO': 'FFF3CD',
  'A320 CEO': 'CFE2FF',
  'A320 NEO': 'C6EFCE',
  'A321 CEO': 'FFDCB3',
  'A321 XLR': 'E1CCFF',
  'A330 CF6': 'FFC7CE',
  'A330 RR700': 'FFDAB9',
  'A350': 'C6FFF8',
};

export interface FleetCol { key: string; grp: string; label: string }

/** Cobertura de flota del proveedor contratado (aprobacion EASA) */
export const FLEET_COLS: FleetCol[] = [
  { key: 'CFM56', grp: 'A320', label: 'CFM56' },
  { key: 'LEAP1A', grp: 'A320', label: 'LEAP 1A' },
  { key: 'PW1100', grp: 'A320', label: 'PW1100' },
  { key: 'CFMLEAP1A', grp: 'A321 XLR', label: 'CFM LEAP-1A' },
  { key: 'CF6', grp: 'A330', label: 'CF6' },
  { key: 'RRT700', grp: 'A330', label: 'RRT700' },
  { key: 'RRTRENTXWB', grp: 'A350', label: 'RR Trent XWB' },
];

/** Cobertura de flota de los proveedores no contratados */
export const ALT_FLEET_COLS: FleetCol[] = [
  { key: 'CFM56', grp: 'A320', label: 'CFM56' },
  { key: 'LEAP1A', grp: 'A320', label: 'LEAP 1A' },
  { key: 'PW1100', grp: 'A320', label: 'PW1100' },
  { key: 'A330CF6', grp: 'A330', label: 'CF6' },
  { key: 'A330RR', grp: 'A330', label: 'RR' },
  { key: 'A350RR', grp: 'A350', label: 'RR' },
];

export function fleetGroups(cols: FleetCol[]) {
  const groups: { grp: string; span: number }[] = [];
  for (const c of cols) {
    const last = groups[groups.length - 1];
    if (last && last.grp === c.grp) last.span++;
    else groups.push({ grp: c.grp, span: 1 });
  }
  return groups;
}

export const SCHEDULE_HEADERS = ['DATE', 'FREQ', 'FLT NUMBER', 'ORIGIN', 'DEPT TERMINAL', 'DEPT TIME', 'DESTINATION', 'DEST TERMINAL', 'ARRIVAL TIME', 'SUBFLEET'];
