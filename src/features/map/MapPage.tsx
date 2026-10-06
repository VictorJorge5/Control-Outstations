import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, ArrowRight, Download, FileText, List, Map as MapIcon, Moon, SearchX, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAppData } from '@/lib/queries';
import { useStationNav } from '@/lib/nav';
import { fmtNumber } from '@/lib/format';
import type { AltStation, Station } from '@/lib/types';
import { ALT_COLOR, STATUS_META, stationStatus } from '@/domain/status';
import { Segmented, Switch, Tip } from '@/components/ui/controls';
import { Code, EmptyState, SearchInput, Select } from '@/components/ui/primitives';
import { StationMap, type MapFocus } from './StationMap';

type Mode = 'main' | 'alt';

export default function MapPage() {
  const data = useAppData();
  const { openStation, openAlt } = useStationNav();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('modo') === 'alternativos' ? 'alt' : 'main';
  const provider = params.get('proveedor') || '';

  const [q, setQ] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [pernoctaOnly, setPernoctaOnly] = useState(false);
  const [routes, setRoutes] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');

  const setParam = (k: string, v: string) => setParams(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const setMode = (m: Mode) => {
    setParams(p => { const n = new URLSearchParams(p); n.delete('proveedor'); if (m === 'alt') n.set('modo', 'alternativos'); else n.delete('modo'); return n; }, { replace: true });
    setQ(''); setStationFilter(''); setSelected(null);
  };

  const query = q.trim().toLowerCase();
  const mainList = useMemo(() => data.stations.filter(s => {
    if (stationFilter && s.code !== stationFilter) return false;
    if (provider && !s.providers.includes(provider)) return false;
    if (activeOnly && !s.in_schedule) return false;
    if (pernoctaOnly && !s.pernocta) return false;
    if (query && !`${s.code} ${s.city} ${s.country} ${s.providers.join(' ')}`.toLowerCase().includes(query)) return false;
    return true;
  }), [data.stations, stationFilter, provider, activeOnly, pernoctaOnly, query]);
  const altList = useMemo(() => data.altStations.filter(s => {
    const names = s.providers.map(p => p.supplier);
    if (stationFilter && s.code !== stationFilter) return false;
    if (provider && !names.includes(provider)) return false;
    if (query && !`${s.code} ${s.city} ${s.country} ${names.join(' ')}`.toLowerCase().includes(query)) return false;
    return true;
  }), [data.altStations, stationFilter, provider, query]);

  const visible: (Station | AltStation)[] = mode === 'main' ? mainList : altList;
  const listSorted = useMemo(() => [...visible].sort((a, b) => a.code.localeCompare(b.code)), [visible]);

  const focusOn = (code: string) => {
    const s = (mode === 'main' ? data.stationByCode : data.altByCode).get(code);
    if (!s) return;
    setSelected(code);
    setFocus({ code, lat: s.lat, lon: s.lon, nonce: Date.now() });
    if (window.matchMedia('(max-width: 1023px)').matches) setMobileView('map');
  };
  const open = (code: string) => (mode === 'main' ? openStation(code) : openAlt(code));
  const hasFilters = !!(q || stationFilter || provider || activeOnly || pernoctaOnly);
  const clearFilters = () => { setQ(''); setStationFilter(''); setParam('proveedor', ''); setActiveOnly(false); setPernoctaOnly(false); };

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* selector lista/mapa en movil */}
      <div className="border-b border-ink-150 bg-white p-3 lg:hidden">
        <Segmented layoutId="map-mobile" value={mobileView} onChange={setMobileView} options={[
          { value: 'list', label: <span className="flex items-center justify-center gap-1.5"><List className="size-4" /> Lista</span> },
          { value: 'map', label: <span className="flex items-center justify-center gap-1.5"><MapIcon className="size-4" /> Mapa</span> },
        ]} />
      </div>

      <aside className={cn('flex min-h-0 w-full flex-col border-r border-ink-150 bg-white lg:w-[390px] lg:shrink-0', mobileView === 'map' && 'max-lg:hidden', 'max-lg:flex-1')}>
        <div className="space-y-3 border-b border-ink-100 p-4">
          <Segmented layoutId="map-mode" value={mode} onChange={setMode} options={[
            { value: 'main', label: 'Red contratada' },
            { value: 'alt', label: 'No contratados' },
          ]} />
          <SearchWithSuggestions mode={mode} value={q} onChange={setQ} onPickStation={code => { setStationFilter(code); setParam('proveedor', ''); setQ(''); focusOn(code); }} onPickProvider={p => { setStationFilter(''); setParam('proveedor', p); setQ(''); }} />
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Estación" value={stationFilter} onChange={e => { setStationFilter(e.target.value); if (e.target.value) focusOn(e.target.value); }}>
              <option value="">Todas las estaciones</option>
              {(mode === 'main' ? data.sortedStations : data.sortedAltStations).map(s => <option key={s.code} value={s.code}>{s.code} — {s.city}</option>)}
            </Select>
            <Select aria-label="Proveedor" value={provider} onChange={e => setParam('proveedor', e.target.value)}>
              <option value="">Todos los proveedores</option>
              {(mode === 'main' ? data.providers : data.altProviders).map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          {mode === 'main' && (
            <div className="space-y-2.5 pt-1">
              <Switch checked={activeOnly} onCheckedChange={setActiveOnly} label="Solo con vuelo esta temporada" />
              <Switch checked={pernoctaOnly} onCheckedChange={setPernoctaOnly} label="Solo estaciones de pernocta" />
              <Switch checked={routes} onCheckedChange={setRoutes} label="Rutas desde Madrid" />
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[13px]">
            <Link to="/pernoctas" className="flex items-center gap-1 font-medium text-ink-500 hover:text-brand-600"><Moon className="size-3.5" /> Pernoctas <ArrowRight className="size-3" /></Link>
            <Link to="/actividad" className="flex items-center gap-1 font-medium text-ink-500 hover:text-brand-600"><Activity className="size-3.5" /> Actividad reciente <ArrowRight className="size-3" /></Link>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-ink-500">
          <span className="font-medium uppercase tracking-wider text-ink-400">Estaciones</span>
          <span className="flex items-center gap-2">
            <span data-testid="list-count"><b className="font-semibold text-ink-800 tabular-nums">{listSorted.length}</b> resultado{listSorted.length === 1 ? '' : 's'}</span>
            <Tip content="Descargar esta lista en CSV (Excel)">
              <button onClick={() => downloadCsv(mode, listSorted)} disabled={!listSorted.length} className="grid size-6 place-items-center rounded-md text-ink-400 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30" aria-label="Exportar lista a CSV" data-testid="export-csv"><Download className="size-3.5" /></button>
            </Tip>
            {hasFilters && <button onClick={clearFilters} className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium text-brand-600 hover:bg-brand-50"><X className="size-3" /> Limpiar</button>}
          </span>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3" role="list">
          {listSorted.length === 0 ? (
            <EmptyState icon={<SearchX />} title="Sin resultados">Ninguna estación cumple estos filtros.</EmptyState>
          ) : (
            listSorted.map((s, i) => (
              <StationRow
                key={s.code}
                station={s}
                mode={mode}
                index={i}
                active={selected === s.code}
                onClick={() => focusOn(s.code)}
                onOpen={() => open(s.code)}
              />
            ))
          )}
        </div>
      </aside>

      {/* isolate: las capas de Leaflet (z-index 400-1000) no se salen por encima de la ficha ni del buscador */}
      <div className={cn('relative isolate min-h-0 flex-1', mobileView === 'list' && 'max-lg:hidden')}>
        <StationMap
          mode={mode}
          stations={mainList}
          altStations={altList}
          selected={selected}
          focus={focus}
          onSelect={code => setSelected(code)}
          onOpen={open}
          routes={routes}
        />
        <Legend mode={mode} routes={routes} />
      </div>
    </div>
  );
}

// CSV con ; y BOM: Excel en español lo abre bien con doble clic
function downloadCsv(mode: Mode, list: (Station | AltStation)[]) {
  const esc = (v: unknown) => { const t = String(v ?? ''); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows: unknown[][] = mode === 'main'
    ? [['Código', 'Ciudad', 'País', 'Estado', 'Proveedores', 'Movimientos IB', 'Primer vuelo', 'Pernocta'],
      ...(list as Station[]).map(s => [s.code, s.city, s.country, STATUS_META[stationStatus(s)].label, s.providers.join(' / '), s.in_schedule ? s.flights : 0, s.first_flight || '', s.pernocta ? 'Sí' : 'No'])]
    : [['Código', 'Ciudad', 'País', 'Proveedores no contratados', 'EASA', 'Email', 'Teléfono'],
      ...(list as AltStation[]).map(s => [s.code, s.city, s.country, s.providers.map(p => p.supplier).join(' / '), s.providers.map(p => p.easa || '').filter(Boolean).join(' / '), s.providers.map(p => p.email || '').filter(Boolean).join(' / '), s.providers.map(p => p.phone || '').filter(Boolean).join(' / ')])];
  const csv = '\ufeff' + rows.map(r => r.map(esc).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `estaciones-${mode === 'main' ? 'red' : 'no-contratados'}-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StationRow({ station, mode, index, active, onClick, onOpen }: { station: Station | AltStation; mode: Mode; index: number; active: boolean; onClick: () => void; onOpen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [active]);
  const isMain = mode === 'main';
  const s = station as Station;
  const a = station as AltStation;
  const status = isMain ? stationStatus(s) : null;
  const color = status ? STATUS_META[status].color : ALT_COLOR;
  const provText = isMain
    ? (s.pending ? 'Pendiente de asignar' : s.providers.join(' · ')) + (!s.in_schedule ? ' · sin vuelo esta temporada' : '')
    : a.providers.map(p => p.supplier).join(' · ');

  return (
    <motion.div
      ref={ref}
      role="listitem"
      data-testid="station-row"
      data-code={station.code}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.015, 0.3) }}
      onClick={onClick}
      className={cn('group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors', active ? 'bg-brand-50/70' : 'hover:bg-ink-50')}
    >
      {active && <motion.span layoutId="row-active" className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-600" />}
      <span className="size-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ background: color }} aria-label={status ? STATUS_META[status].label : 'No contratado'} />
      <Code size="sm">{station.code}</Code>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-ink-900">
          {station.city}
          {isMain && s.pernocta && <Moon className="size-3 shrink-0 text-violet-500" aria-label="Pernocta" />}
        </span>
        <span className={cn('block truncate text-xs', isMain && s.pending ? 'font-medium text-amber-700' : 'text-ink-500')}>{provText}</span>
      </span>
      <span className="text-right text-xs tabular-nums text-ink-500">
        {isMain ? (s.in_schedule ? fmtNumber(s.flights) : '—') : a.providers.length}
      </span>
      <Tip content={isMain ? 'Ver ficha de la estación' : 'Ver detalle'}>
        <button
          onClick={e => { e.stopPropagation(); onOpen(); }}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-white hover:text-ink-900 hover:shadow-card"
          aria-label={`Ver ficha de ${station.code}`}
          data-testid="open-station"
        >
          <FileText className="size-4" />
        </button>
      </Tip>
    </motion.div>
  );
}

function Legend({ mode, routes }: { mode: Mode; routes: boolean }) {
  const items = mode === 'main'
    ? (Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map(k => ({ color: STATUS_META[k].color, label: STATUS_META[k].label }))
    : [{ color: ALT_COLOR, label: 'Proveedores no contratados' }];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="pointer-events-none absolute bottom-6 left-4 z-[400] flex flex-wrap gap-x-4 gap-y-1.5 rounded-2xl bg-white/85 px-4 py-2.5 text-xs text-ink-600 shadow-lift ring-1 ring-ink-950/5 backdrop-blur-md">
      {items.map(it => <span key={it.label} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full ring-2 ring-white" style={{ background: it.color }} />{it.label}</span>)}
      {mode === 'main' && <span className="flex items-center gap-1.5"><Moon className="size-3 text-violet-500" /> Pernocta</span>}
      {mode === 'main' && routes && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-ink-400" /> Ruta desde MAD</span>}
    </motion.div>
  );
}

// ---- buscador con sugerencias de estaciones y proveedores (teclado: ↑ ↓ Enter Esc) ----
function SearchWithSuggestions({ mode, value, onChange, onPickStation, onPickProvider }: {
  mode: Mode; value: string; onChange: (v: string) => void; onPickStation: (code: string) => void; onPickProvider: (p: string) => void;
}) {
  const data = useAppData();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const q = value.trim().toLowerCase();

  const items = useMemo(() => {
    if (!q) return [];
    const list = mode === 'main' ? data.sortedStations : data.sortedAltStations;
    const provs = mode === 'main' ? data.providers : data.altProviders;
    const st = list.filter(s => s.code.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.country.toLowerCase().includes(q)).slice(0, 6)
      .map(s => ({ type: 'station' as const, value: s.code, sub: `${s.city}, ${s.country}` }));
    const pr = provs.filter(p => p.toLowerCase().includes(q)).slice(0, 6).map(p => {
      const n = mode === 'main' ? data.stations.filter(s => s.providers.includes(p)).length : data.altStations.filter(s => s.providers.some(x => x.supplier === p)).length;
      return { type: 'provider' as const, value: p, sub: n === 1 ? '1 estación' : `${n} estaciones` };
    });
    return [...st, ...pr];
  }, [q, mode, data]);

  const pick = (i: number) => {
    const it = items[i];
    if (!it) return;
    setOpen(false);
    if (it.type === 'station') onPickStation(it.value); else onPickProvider(it.value);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + items.length) % items.length); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(active); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="relative">
      <SearchInput
        placeholder="Buscar estación o proveedor…"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKey}
        aria-label="Buscar estación o proveedor"
        data-testid="map-search"
      />
      <AnimatePresence>
        {open && q && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-xl bg-white p-1.5 shadow-overlay ring-1 ring-ink-950/5"
            role="listbox"
          >
            {!items.length && <div className="px-3 py-4 text-center text-sm text-ink-500">Sin coincidencias</div>}
            {items.map((it, i) => (
              <div key={it.type + it.value}>
                {(i === 0 || items[i - 1].type !== it.type) && (
                  <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">{it.type === 'station' ? 'Estaciones' : 'Proveedores'}</div>
                )}
                <button
                  role="option"
                  aria-selected={active === i}
                  onMouseDown={e => { e.preventDefault(); pick(i); }}
                  onMouseEnter={() => setActive(i)}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm', active === i ? 'bg-ink-100' : '')}
                >
                  <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', it.type === 'station' ? 'bg-ink-900 text-white' : 'bg-brand-50 text-brand-700')}>{it.type === 'station' ? 'EST' : 'PROV'}</span>
                  <span className="font-medium text-ink-900">{it.value}</span>
                  <span className="ml-auto truncate text-xs text-ink-400">{it.sub}</span>
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
