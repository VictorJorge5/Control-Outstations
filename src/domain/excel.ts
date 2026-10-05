// ---- Excel del horario: replica exacta de la macro V18 ----
// (hoja de listado con cabecera roja Iberia + logo, calendarios mensuales con
//  el vuelo en la celda del dia, mismos colores). ExcelJS se carga solo al exportar.
import logoDataUrl from '@/assets/iberia-logo.png?inline';
import { MONTHS_EN, parseDateStr } from '@/lib/format';
import type { ScheduleRow } from '@/lib/types';
import { SCHEDULE_HEADERS, SUBFLEET_COLOR } from './fleet';

const IB_RED = 'FFC8102E';
const IB_DARK = 'FF231F20';
const IB_LGRAY = 'FFF5F5F5';
const IB_WHITE = 'FFFFFFFF';
const CAL_BLUE = 'FFEFF6FF';

function timeFrac(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60 + m) / 1440;
}
const thinBlack = () => ({ style: 'thin' as const, color: { argb: 'FF000000' } });
const medBlack = () => ({ style: 'medium' as const, color: { argb: 'FF000000' } });

export function scheduleFileName(code: string) {
  return `Iberia Flight Schedule - ${code}.xlsx`;
}

export async function buildScheduleWorkbook(code: string, schedule: ScheduleRow[]): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const logoId = wb.addImage({ base64: logoDataUrl.split(',')[1], extension: 'png' });

  // =========================================================
  // HOJA 1: LISTADO
  // =========================================================
  const sheetName = `IBERIA ${code} SCHEDULE`.slice(0, 31);
  const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', xSplit: 0, ySplit: 2, zoomScale: 90 }] });
  ws.columns = [
    { width: 14.63 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 },
    { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 },
  ];

  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `IBERIA FLIGHT SCHEDULE  -  ${code}  |  UTC TIMES`;
  titleCell.font = { name: 'Calibri', bold: true, size: 13, color: { argb: IB_WHITE } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= 10; c++) ws.getRow(1).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: IB_RED } };
  ws.getRow(1).height = 28;

  ws.addImage(logoId, { tl: { col: 0.05, row: 0.08 }, ext: { width: 126, height: 29 } });

  const headerRow = ws.getRow(2);
  SCHEDULE_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: IB_WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: IB_DARK } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 20;

  schedule.forEach((r, i) => {
    const [date, freq, flt, origin, deptTerm, deptTime, dest, destTerm, arrTime, subfleet] = r;
    const row = ws.getRow(i + 3);
    const rowBg = i % 2 === 0 ? IB_WHITE : IB_LGRAY;
    const values = [parseDateStr(date), freq, flt, origin, deptTerm, timeFrac(deptTime), dest, destTerm, timeFrac(arrTime), subfleet];
    values.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.font = { name: 'Calibri', size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      const isSubfleet = ci === 9;
      const bg = isSubfleet ? (SUBFLEET_COLOR[subfleet] ? 'FF' + SUBFLEET_COLOR[subfleet] : rowBg) : rowBg;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      if (ci === 0) cell.numFmt = 'dd/mmm/yyyy';
      if (ci === 5 || ci === 8) cell.numFmt = 'h:mm';
    });
  });

  // bordes: medio en el contorno, fino entre celdas
  const lastRow = schedule.length + 2;
  for (let R = 1; R <= lastRow; R++) {
    for (let C = 1; C <= 10; C++) {
      ws.getRow(R).getCell(C).border = {
        top: R === 1 ? medBlack() : thinBlack(),
        bottom: R === lastRow ? medBlack() : thinBlack(),
        left: C === 1 ? medBlack() : thinBlack(),
        right: C === 10 ? medBlack() : thinBlack(),
      };
    }
  }

  // =========================================================
  // HOJAS: CALENDARIOS MENSUALES
  // =========================================================
  const byMonth = new Map<string, ScheduleRow[]>();
  schedule.forEach(r => {
    const [, mon, yyyy] = r[0].split('/');
    const key = `${mon}-${yyyy}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(r);
  });
  const monthKeysSorted = [...byMonth.keys()].sort((a, b) => {
    const [ma, ya] = a.split('-');
    const [mb, yb] = b.split('-');
    return (parseInt(ya, 10) - parseInt(yb, 10)) || (MONTHS_EN.indexOf(ma) - MONTHS_EN.indexOf(mb));
  });

  monthKeysSorted.forEach(key => {
    const [mon, yyyy] = key.split('-');
    const monIdx = MONTHS_EN.indexOf(mon);
    const year = parseInt(yyyy, 10);
    const wsCal = wb.addWorksheet(key, { views: [{ zoomScale: 65 }] });
    wsCal.columns = Array(7).fill({ width: 45 });

    wsCal.mergeCells('A1:G1');
    const t = wsCal.getCell('A1');
    t.value = `${mon}-${yyyy}`;
    t.font = { name: 'Calibri', bold: true, size: 16, color: { argb: IB_WHITE } };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= 7; c++) wsCal.getRow(1).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: IB_RED } };
    wsCal.getRow(1).height = 26;

    ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach((d, i) => {
      const cell = wsCal.getRow(2).getCell(i + 1);
      cell.value = d;
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: IB_WHITE } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: IB_DARK } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    wsCal.getRow(2).height = 18;

    const firstOfMonth = new Date(Date.UTC(year, monIdx, 1));
    const daysInMonth = new Date(Date.UTC(year, monIdx + 1, 0)).getUTCDate();
    const firstWeekdayMon = (firstOfMonth.getUTCDay() + 6) % 7; // 0=Mon..6=Sun

    const flightsByDay = new Map<number, ScheduleRow[]>();
    byMonth.get(key)!.forEach(r => {
      const day = parseInt(r[0].split('/')[0], 10);
      if (!flightsByDay.has(day)) flightsByDay.set(day, []);
      flightsByDay.get(day)!.push(r);
    });

    const numCalRows = Math.ceil((firstWeekdayMon + daysInMonth) / 7);
    const maxFlightsPerRow = Array(numCalRows).fill(0);
    for (let d = 1; d <= daysInMonth; d++) {
      const slot = firstWeekdayMon + d - 1;
      const rIdx = Math.floor(slot / 7) + 3;
      const cIdx = (slot % 7) + 1;
      const cell = wsCal.getRow(rIdx).getCell(cIdx);
      const flights = flightsByDay.get(d) || [];
      maxFlightsPerRow[rIdx - 3] = Math.max(maxFlightsPerRow[rIdx - 3], flights.length);
      const richText = [{ font: { name: 'Calibri', bold: true, size: 13, color: { argb: IB_RED } }, text: String(d) }];
      flights.forEach(f => {
        const [, , flt, origin, , deptTime, dest, , arrTime, subfleet] = f;
        richText.push({ font: { name: 'Calibri', size: 10, color: { argb: IB_DARK } } as never, text: `\n${flt} ${origin} ${deptTime} ${dest} ${arrTime} ${subfleet}` });
      });
      cell.value = { richText };
      cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      cell.border = { top: thinBlack(), bottom: thinBlack(), left: thinBlack(), right: thinBlack() };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: flights.length ? CAL_BLUE : IB_WHITE } };
    }
    // altura dinamica por fila: suficiente para el dia con mas vuelos de esa semana, con un minimo de 60
    for (let r = 3; r <= numCalRows + 2; r++) {
      const lines = 1 + maxFlightsPerRow[r - 3];
      wsCal.getRow(r).height = Math.max(60, 18 + lines * 13);
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/octet-stream' });
}

export async function downloadSchedule(code: string, schedule: ScheduleRow[]) {
  const blob = await buildScheduleWorkbook(code, schedule);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = scheduleFileName(code);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
