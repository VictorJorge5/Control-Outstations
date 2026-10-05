// Fechas, meses y textos relativos.

export const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const WEEKDAYS_ES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

/** "15/SEP/2026" -> Date (UTC) */
export function parseDateStr(d: string): Date {
  const [dd, mon, yyyy] = d.split('/');
  return new Date(Date.UTC(parseInt(yyyy, 10), MONTHS_EN.indexOf(mon), parseInt(dd, 10)));
}

/** "2026-10" -> "oct 2026" */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${MONTHS_ES[parseInt(m, 10) - 1]} ${y}`;
}

/** Segundos unix -> "hace 5 min" */
export function timeAgo(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return '';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  return `hace ${days} día${days === 1 ? '' : 's'}`;
}

export const fmtNumber = (n: number) => n.toLocaleString('es-ES');

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "nombre.apellido@iberia.es" -> "nombre.apellido" */
export const who = (email: string | null | undefined) => String(email || '').split('@')[0];
