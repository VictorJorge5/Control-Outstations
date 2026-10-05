import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Building2, FileText, Moon } from 'lucide-react';
import type { AltStation, Station } from '@/lib/types';
import { ALT_COLOR, STATUS_META, stationStatus } from '@/domain/status';
import { Badge, Code } from '@/components/ui/primitives';

const TILE_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_REF = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';

function icon(color: string, opts: { active?: boolean; pulse?: boolean; delay?: number; size?: number }) {
  const size = opts.size ?? 16;
  return L.divIcon({
    className: '',
    html: `<div class="st-marker${opts.active ? ' is-active' : ''}" style="width:${size}px;height:${size}px">`
      + (opts.pulse ? `<span class="ring" style="background:${color}"></span>` : '')
      + `<span class="dot" style="background:${color};animation-delay:${opts.delay ?? 0}ms"></span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });
}

export interface MapFocus { code: string; lat: number; lon: number; nonce: number }

/** Vuela a la estacion seleccionada y abre su popup */
function FocusController({ focus, markers }: { focus: MapFocus | null; markers: React.RefObject<Map<string, L.Marker>> }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lon], Math.max(map.getZoom(), 6), { duration: 0.8 });
    const t = setTimeout(() => markers.current?.get(focus.code)?.openPopup(), 850);
    return () => clearTimeout(t);
  }, [focus, map, markers]);
  return null;
}

/** Recalcula el tamaño del mapa cuando cambia su contenedor (movil: lista/mapa) */
function ResizeController() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export function StationMap({ mode, stations, altStations, selected, focus, onSelect, onOpen }: {
  mode: 'main' | 'alt';
  stations: Station[];
  altStations: AltStation[];
  selected: string | null;
  focus: MapFocus | null;
  onSelect: (code: string) => void;
  onOpen: (code: string) => void;
}) {
  const markers = useRef(new Map<string, L.Marker>());
  // cache de iconos: al seleccionar una estacion solo cambian su icono y el de la anterior
  const icons = useRef(new Map<string, L.DivIcon>());
  const order = useMemo(() => new Map([...stations, ...altStations].map((s, i) => [s.code, i])), [stations, altStations]);
  const getIcon = (key: string, color: string, active: boolean, extra: { pulse?: boolean; size?: number }) => {
    const k = `${key}|${active ? 1 : 0}`;
    let ic = icons.current.get(k);
    if (!ic) {
      ic = icon(color, { ...extra, active, delay: active ? 0 : Math.min((order.get(key.replace('alt-', '')) ?? 0) * (extra.size ? 2 : 10), 600) });
      icons.current.set(k, ic);
    }
    return ic;
  };

  return (
    <MapContainer center={[30, 10]} zoom={2.4} zoomSnap={0.1} minZoom={2} maxZoom={16} worldCopyJump className="h-full w-full" zoomControl={false} attributionControl>
      <TileLayer url={TILE_BASE} attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ" maxZoom={16} />
      <TileLayer url={TILE_REF} maxZoom={16} />
      <ZoomControl />
      <ResizeController />
      <FocusController focus={focus} markers={markers} />

      {mode === 'main' && stations.map(s => (
        <Marker
          key={s.code}
          position={[s.lat, s.lon]}
          icon={getIcon(s.code, STATUS_META[stationStatus(s)].color, s.code === selected, { pulse: stationStatus(s) === 'pending' })}
          ref={m => { if (m) markers.current.set(s.code, m); else markers.current.delete(s.code); }}
          eventHandlers={{ click: () => onSelect(s.code) }}
        >
          <Popup closeButton>
            <StationPopup station={s} onOpen={() => onOpen(s.code)} />
          </Popup>
        </Marker>
      ))}
      {mode === 'alt' && altStations.map(s => (
        <Marker
          key={'alt-' + s.code}
          position={[s.lat, s.lon]}
          icon={getIcon('alt-' + s.code, ALT_COLOR, s.code === selected, { size: 13 })}
          ref={m => { if (m) markers.current.set(s.code, m); else markers.current.delete(s.code); }}
          eventHandlers={{ click: () => onSelect(s.code) }}
        >
          <Popup closeButton>
            <AltPopup station={s} onOpen={() => onOpen(s.code)} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

function ZoomControl() {
  const map = useMap();
  useEffect(() => {
    const c = L.control.zoom({ position: 'topright' });
    c.addTo(map);
    return () => { c.remove(); };
  }, [map]);
  return null;
}

function PopupShell({ code, city, children, onOpen, cta }: { code: string; city: string; children: React.ReactNode; onOpen: () => void; cta: string }) {
  return (
    <div className="p-4 font-sans">
      <Code size="lg">{code}</Code>
      <div className="mt-2 text-[15px] font-semibold text-ink-900">{city}</div>
      <div className="mt-3 space-y-2">{children}</div>
      <button onClick={onOpen} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ink-900 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-ink-800">
        <FileText className="size-4" /> {cta}
      </button>
    </div>
  );
}

function StationPopup({ station: s, onOpen }: { station: Station; onOpen: () => void }) {
  const st = stationStatus(s);
  return (
    <PopupShell code={s.code} city={`${s.city}, ${s.country}`} onOpen={onOpen} cta="Ver ficha de la estación">
      <div className={`flex items-center gap-3 rounded-xl p-3 ${s.pending ? 'bg-amber-50 ring-1 ring-inset ring-amber-200' : 'bg-ink-50 ring-1 ring-inset ring-ink-150'}`}>
        <Building2 className={`size-4 shrink-0 ${s.pending ? 'text-amber-700' : 'text-ink-500'}`} />
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-ink-500">Proveedor</div>
          <div className={`truncate text-[13px] font-semibold ${s.pending ? 'text-amber-800' : 'text-ink-900'}`}>{s.pending ? 'Aún no hay proveedor contratado' : s.providers.join(' · ')}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={st === 'assigned' ? 'success' : st === 'pending' ? 'warning' : 'neutral'} dot>{STATUS_META[st].short}</Badge>
        {s.easa && s.easa.length > 0 && <Badge>EASA {s.easa.map(p => p.approval_number).join(' / ')}</Badge>}
        {s.pernocta && <Badge tone="violet"><Moon className="size-3" /> Pernocta</Badge>}
      </div>
    </PopupShell>
  );
}

function AltPopup({ station: s, onOpen }: { station: AltStation; onOpen: () => void }) {
  return (
    <PopupShell code={s.code} city={`${s.city}, ${s.country}`} onOpen={onOpen} cta="Ver detalle">
      <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 ring-1 ring-inset ring-ink-150">
        <Building2 className="size-4 shrink-0 text-ink-500" />
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-ink-500">{s.providers.length} proveedor{s.providers.length === 1 ? '' : 'es'} de respaldo</div>
          <div className="text-[13px] font-semibold text-ink-900">{s.providers.map(p => p.supplier).join(' · ')}</div>
        </div>
      </div>
    </PopupShell>
  );
}
