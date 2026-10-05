// Parte B de la app: se importa dinamicamente desde main.js solo despues del
// login, cuando los datos ya estan cargados en data.js.
import * as L from 'leaflet';
import { STATIONS, ALT_STATIONS, PERNOCTA_MONTHS } from './data.js';
import { app, AUTH_API_URL, AUTH_KEY, AUTH_EMAIL_KEY, canWrite, isAdminRole, appEl, goHome } from './main.js';

const map = L.map('map', {zoomControl:true, worldCopyJump:true, maxZoom:16}).setView([30, 10], 2.4);
window.__map = map;
if (appEl.classList.contains('visible')){
  setTimeout(() => map.invalidateSize(), 100);
}
window.addEventListener('resize', () => map.invalidateSize());

// ---- selector Mapa/Lista para movil ----
const mobileViewToggle = document.getElementById('mobile-view-toggle');
const sidebarEl = document.querySelector('.sidebar');
const mapWrapEl = document.querySelector('.map-wrap');
function setMobileView(view){
  mobileViewToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const showMap = view === 'map';
  sidebarEl.classList.toggle('mobile-hidden', showMap);
  mapWrapEl.classList.toggle('mobile-hidden', !showMap);
  if (showMap) setTimeout(() => map.invalidateSize(), 60);
}
mobileViewToggle.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => setMobileView(btn.dataset.view));
});
// en movil, la lista esta encima del mapa: cuando el usuario elige una estacion
// desde la lista, el desplegable o el buscador, esto la revela automaticamente
function revealMapOnMobile(){
  if (window.matchMedia('(max-width:880px)').matches) setMobileView('map');
}
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  maxZoom: 16
}).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 16
}).addTo(map);

const markers = {};
const rows = {};

function statusColor(s){
  if (s.pending) return '#B4740E';
  if (!s.in_schedule) return '#8B95A0';
  return '#2F6F4E';
}

function makeIcon(s){
  const color = statusColor(s);
  return L.divIcon({
    className:'',
    html:`<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize:[14,14],
    iconAnchor:[7,7]
  });
}

const ICON_BUILDING = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 22V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v18M6 22h14M13 22V9a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v13M9 7h.01M9 11h.01M9 15h.01"/></svg>';

STATIONS.forEach(s => {
  const marker = L.marker([s.lat, s.lon], {icon: makeIcon(s)}).addTo(map);

  const providerBlock = s.pending
    ? `<div class="pcard-provider-block is-pending">
         <span class="pcard-provider-icon">${ICON_BUILDING}</span>
         <div><div class="pcard-provider-label">Proveedor</div><div class="pcard-provider-name">Aún no hay proveedor contratado</div></div>
       </div>`
    : `<div class="pcard-provider-block">
         <span class="pcard-provider-icon">${ICON_BUILDING}</span>
         <div><div class="pcard-provider-label">Proveedor</div><div class="pcard-provider-name">${s.providers.join(' · ')}</div></div>
       </div>`;

  const chips = [];
  if (s.easa && s.easa.length) chips.push(`<span class="pcard-chip">EASA ${s.easa.map(p => p.approval_number).join(' / ')}</span>`);
  if (s.pernocta) chips.push('<span class="pcard-chip moon-chip">☾ Estación con pernocta</span>');
  const chipsRow = chips.length ? `<div class="pcard-chips">${chips.join('')}</div>` : '';

  const html = `<div class="pcard">
    <div class="pcard-top"><span class="popup-code">${s.code}</span></div>
    <div class="popup-city">${s.city}, ${s.country}</div>
    ${providerBlock}
    ${chipsRow}
    <button class="popup-sched-btn" data-code="${s.code}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>
      Ver ficha de la estación
    </button>
  </div>`;

  marker.bindPopup(html, {maxWidth: 280, minWidth: 260});
  marker.on('popupopen', () => {
    const btn = document.querySelector(`.popup-sched-btn[data-code="${s.code}"]`);
    if (btn) btn.addEventListener('click', () => openSchedule(s.code));
  });
  marker.on('click', () => highlightRow(s.code));
  markers[s.code] = marker;
});

// ---- modo "Proveedores no contratados": marcadores (no se añaden al mapa hasta activar el modo) ----
const altMarkers = {};
const ALT_ICON = L.divIcon({
  className:'',
  html:`<div style="width:12px;height:12px;border-radius:50%;background:#6B6560;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
  iconSize:[12,12],
  iconAnchor:[6,6]
});

ALT_STATIONS.forEach(s => {
  const marker = L.marker([s.lat, s.lon], {icon: ALT_ICON});
  const names = s.providers.map(p => p.supplier).join(' · ');
  const html = `<div class="pcard">
    <div class="pcard-top"><span class="popup-code">${s.code}</span></div>
    <div class="popup-city">${s.city}, ${s.country}</div>
    <div class="pcard-provider-block">
      <span class="pcard-provider-icon">${ICON_BUILDING}</span>
      <div><div class="pcard-provider-label">${s.providers.length} proveedor${s.providers.length===1?'':'es'} de respaldo</div><div class="pcard-provider-name">${names}</div></div>
    </div>
    <button class="popup-sched-btn" data-alt-code="${s.code}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>
      Ver detalle
    </button>
  </div>`;
  marker.bindPopup(html, {maxWidth: 280, minWidth: 260});
  marker.on('popupopen', () => {
    const btn = document.querySelector(`.popup-sched-btn[data-alt-code="${s.code}"]`);
    if (btn) btn.addEventListener('click', () => openAltModal(s.code));
  });
  marker.on('click', () => highlightRow(s.code));
  altMarkers[s.code] = marker;
});

// ---- sidebar list ----
const listEl = document.getElementById('list');
const searchEl = document.getElementById('search');
const suggestBox = document.getElementById('suggest-box');
const stationEl = document.getElementById('station-filter');
const providerEl = document.getElementById('provider-filter');
const activeOnlyEl = document.getElementById('active-only');
const pernoctaOnlyEl = document.getElementById('pernocta-only');
const listCount = document.getElementById('list-count').querySelector('b');

const sortedStations = [...STATIONS].sort((a,b) => a.code.localeCompare(b.code));
const allProviders = [...new Set(STATIONS.flatMap(s => s.providers))].sort();
const sortedAltStations = [...ALT_STATIONS].sort((a,b) => a.code.localeCompare(b.code));
const allAltProviders = [...new Set(ALT_STATIONS.flatMap(s => s.providers.map(p => p.supplier)))].sort();

function setStationOptions(list){
  stationEl.innerHTML = '<option value="">Todas las estaciones</option>' +
    list.map(s => `<option value="${s.code}">${s.code} — ${s.city}</option>`).join('');
}
function setProviderOptions(list){
  providerEl.innerHTML = '<option value="">Todos los proveedores</option>' +
    list.map(p => `<option value="${p}">${p}</option>`).join('');
}
setStationOptions(sortedStations);
setProviderOptions(allProviders);

let currentMode = 'main';
const modeToggleEl = document.getElementById('mode-toggle');
const mainOnlyFiltersEl = document.getElementById('main-only-filters');

function doRender(){
  if (currentMode === 'main') render(); else renderAlt();
}

function switchMode(mode){
  if (mode === currentMode) return;
  currentMode = mode;
  modeToggleEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  searchEl.value = '';
  suggestBox.classList.remove('open');
  if (mode === 'alt'){
    Object.values(markers).forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
    mainOnlyFiltersEl.style.display = 'none';
    setStationOptions(sortedAltStations);
    setProviderOptions(allAltProviders);
    document.getElementById('kpi-active-wrap').style.display = 'none';
    document.getElementById('kpi-providers').textContent = allAltProviders.length;
  } else {
    Object.values(altMarkers).forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
    mainOnlyFiltersEl.style.display = '';
    setStationOptions(sortedStations);
    setProviderOptions(allProviders);
    document.getElementById('kpi-active-wrap').style.display = '';
    document.getElementById('kpi-providers').textContent = allProviders.length;
    document.getElementById('kpi-active').textContent = STATIONS.filter(s => s.in_schedule).length;
  }
  stationEl.value = '';
  providerEl.value = '';
  doRender();
}
modeToggleEl.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

function passesFilters(s, q, provFilter, stationFilterVal){
  if (stationFilterVal && s.code !== stationFilterVal) return false;
  if (provFilter && !s.providers.includes(provFilter)) return false;
  if (activeOnlyEl.checked && !s.in_schedule) return false;
  if (pernoctaOnlyEl.checked && !s.pernocta) return false;
  if (q){
    const haystack = (s.code + ' ' + s.city + ' ' + s.country + ' ' + s.providers.join(' ')).toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function passesAltFilters(s, q, provFilter, stationFilterVal){
  if (stationFilterVal && s.code !== stationFilterVal) return false;
  const names = s.providers.map(p => p.supplier);
  if (provFilter && !names.includes(provFilter)) return false;
  if (q){
    const haystack = (s.code + ' ' + s.city + ' ' + s.country + ' ' + names.join(' ')).toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function render(){
  const q = searchEl.value.trim().toLowerCase();
  const provFilter = providerEl.value;
  const stationFilterVal = stationEl.value;
  listEl.innerHTML = '';
  let shown = 0;
  STATIONS.forEach(s => {
    const ok = passesFilters(s, q, provFilter, stationFilterVal);
    const marker = markers[s.code];
    if (ok){ if (!map.hasLayer(marker)) marker.addTo(map); }
    else { if (map.hasLayer(marker)) map.removeLayer(marker); }
    if (!ok) return;
    shown++;
    const row = document.createElement('div');
    row.className = 'row' + (s.pending ? '' : ' assigned');
    row.dataset.code = s.code;
    let dotClass = s.pending ? 'pending' : (s.in_schedule ? '' : 'inactive');
    let provText = s.pending ? 'Pendiente de asignar' : s.providers.join(' · ');
    if (!s.in_schedule) provText += '  ·  sin vuelo esta temporada';
    const flightsTxt = s.in_schedule ? s.flights.toLocaleString('es-ES') : '—';
    row.innerHTML = `
      <span class="dot${dotClass?' '+dotClass:''}"></span>
      <span class="code">${s.code}</span>
      <span class="meta">
        <div class="city">${s.city}${s.pernocta?' <span class=\"moon\">☾</span>':''}</div>
        <div class="prov${s.pending?' pending-txt':''}">${provText}</div>
      </span>
      <span class="flights${s.in_schedule?'':' zero'}">${flightsTxt}</span>
      <button class="row-sched-btn" data-code="${s.code}" title="Ver ficha de la estación"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg></button>`;
    row.querySelector('.row-sched-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openSchedule(s.code);
    });
    row.addEventListener('click', () => {
      map.flyTo([s.lat, s.lon], 6, {duration:0.6});
      markers[s.code].openPopup();
      highlightRow(s.code);
      revealMapOnMobile();
    });
    listEl.appendChild(row);
    rows[s.code] = row;
  });
  listCount.textContent = shown;
  if (shown === 0){
    listEl.innerHTML = '<div class="empty-state">Ninguna estación cumple estos filtros.</div>';
  }
}

function renderAlt(){
  const q = searchEl.value.trim().toLowerCase();
  const provFilter = providerEl.value;
  const stationFilterVal = stationEl.value;
  listEl.innerHTML = '';
  let shown = 0;
  ALT_STATIONS.forEach(s => {
    const ok = passesAltFilters(s, q, provFilter, stationFilterVal);
    const marker = altMarkers[s.code];
    if (ok){ if (!map.hasLayer(marker)) marker.addTo(map); }
    else { if (map.hasLayer(marker)) map.removeLayer(marker); }
    if (!ok) return;
    shown++;
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.code = s.code;
    const names = s.providers.map(p => p.supplier).join(' · ');
    row.innerHTML = `
      <span class="dot inactive"></span>
      <span class="code">${s.code}</span>
      <span class="meta">
        <div class="city">${s.city}</div>
        <div class="prov">${names}</div>
      </span>
      <span class="flights">${s.providers.length}</span>
      <button class="row-sched-btn" data-code="${s.code}" title="Ver detalle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg></button>`;
    row.querySelector('.row-sched-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openAltModal(s.code);
    });
    row.addEventListener('click', () => {
      map.flyTo([s.lat, s.lon], 6, {duration:0.6});
      altMarkers[s.code].openPopup();
      highlightRow(s.code);
      revealMapOnMobile();
    });
    listEl.appendChild(row);
    rows[s.code] = row;
  });
  listCount.textContent = shown;
  if (shown === 0){
    listEl.innerHTML = '<div class="empty-state">Ninguna estación cumple estos filtros.</div>';
  }
}

function highlightRow(code){
  document.querySelectorAll('.row.active').forEach(r => r.classList.remove('active'));
  const r = rows[code];
  if (r){ r.classList.add('active'); r.scrollIntoView({block:'nearest', behavior:'smooth'}); }
}

searchEl.addEventListener('input', () => { doRender(); showSuggestions(); });
searchEl.addEventListener('focus', showSuggestions);
searchEl.addEventListener('blur', () => setTimeout(() => suggestBox.classList.remove('open'), 150));
searchEl.addEventListener('keydown', (e) => {
  if (!suggestBox.classList.contains('open')) return;
  const items = suggestBox.querySelectorAll('.suggest-item');
  if (!items.length) return;
  if (e.key === 'ArrowDown'){
    e.preventDefault();
    setActiveSuggestItem(suggestActiveIndex + 1);
  } else if (e.key === 'ArrowUp'){
    e.preventDefault();
    setActiveSuggestItem(suggestActiveIndex - 1);
  } else if (e.key === 'Enter'){
    if (suggestActiveIndex >= 0){
      e.preventDefault();
      items[suggestActiveIndex].dispatchEvent(new Event('mousedown'));
    }
  } else if (e.key === 'Escape'){
    suggestBox.classList.remove('open');
  }
});
stationEl.addEventListener('change', () => {
  doRender();
  const code = stationEl.value;
  const activeMarkers = currentMode === 'main' ? markers : altMarkers;
  const activeList = currentMode === 'main' ? STATIONS : ALT_STATIONS;
  if (code && activeMarkers[code]){
    const st = activeList.find(s => s.code === code);
    map.flyTo([st.lat, st.lon], 6, {duration:0.6});
    activeMarkers[code].openPopup();
    highlightRow(code);
    revealMapOnMobile();
  }
});
providerEl.addEventListener('change', doRender);
activeOnlyEl.addEventListener('change', doRender);
pernoctaOnlyEl.addEventListener('change', doRender);

let suggestActiveIndex = -1;

function showSuggestions(){
  suggestActiveIndex = -1;
  const q = searchEl.value.trim().toLowerCase();
  if (!q){ suggestBox.classList.remove('open'); suggestBox.innerHTML=''; return; }

  const activeStationsList = currentMode === 'main' ? sortedStations : sortedAltStations;
  const activeProvidersList = currentMode === 'main' ? allProviders : allAltProviders;

  const stationMatches = activeStationsList.filter(s =>
    s.code.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.country.toLowerCase().includes(q)
  ).slice(0, 6);

  const providerMatches = activeProvidersList.filter(p => p.toLowerCase().includes(q)).slice(0, 6);

  if (!stationMatches.length && !providerMatches.length){
    suggestBox.innerHTML = '<div class="suggest-empty">Sin coincidencias</div>';
    suggestBox.classList.add('open');
    return;
  }

  let idx = 0;
  let html = '';
  if (stationMatches.length){
    html += '<div class="suggest-group-label">Estaciones</div>';
    stationMatches.forEach(s => {
      html += `<div class="suggest-item" data-index="${idx++}" data-type="station" data-value="${s.code}">
        <span class="suggest-tag station">EST</span>
        <span class="main">${s.code}</span>
        <span class="sub">${s.city}, ${s.country}</span>
      </div>`;
    });
  }
  if (providerMatches.length){
    html += '<div class="suggest-group-label">Proveedores</div>';
    providerMatches.forEach(p => {
      const count = currentMode === 'main'
        ? STATIONS.filter(s => s.providers.includes(p)).length
        : ALT_STATIONS.filter(s => s.providers.some(pr => pr.supplier === p)).length;
      html += `<div class="suggest-item" data-index="${idx++}" data-type="provider" data-value="${p}">
        <span class="suggest-tag provider">PROV</span>
        <span class="main">${p}</span>
        <span class="sub">${count} estación${count===1?'':'es'}</span>
      </div>`;
    });
  }
  suggestBox.innerHTML = html;
  suggestBox.classList.add('open');

  function commitSuggestion(item){
    const type = item.dataset.type;
    const value = item.dataset.value;
    searchEl.value = '';
    suggestBox.classList.remove('open');
    if (type === 'station'){
      providerEl.value = '';
      stationEl.value = value;
      stationEl.dispatchEvent(new Event('change'));
    } else {
      stationEl.value = '';
      providerEl.value = value;
      doRender();
    }
  }

  const items = suggestBox.querySelectorAll('.suggest-item');
  items.forEach(item => {
    item.addEventListener('mousedown', (e) => { e.preventDefault(); commitSuggestion(item); });
    item.addEventListener('mouseenter', () => setActiveSuggestItem(parseInt(item.dataset.index)));
  });
}

function setActiveSuggestItem(idx){
  const items = suggestBox.querySelectorAll('.suggest-item');
  if (!items.length) return;
  suggestActiveIndex = ((idx % items.length) + items.length) % items.length;
  items.forEach(item => item.classList.toggle('active', parseInt(item.dataset.index) === suggestActiveIndex));
  items[suggestActiveIndex].scrollIntoView({block:'nearest'});
}

render();

document.getElementById('kpi-active').textContent = STATIONS.filter(s => s.in_schedule).length;
document.getElementById('kpi-providers').textContent = allProviders.length;

refreshUncoveredBadge();
refreshFcamoBadge();

// ---- schedule modal ----
const modalOverlay = document.getElementById('modal-overlay');
const modalCode = document.getElementById('modal-code');
const modalCity = document.getElementById('modal-city');
const modalSub = document.getElementById('modal-sub');
const schedTbody = document.getElementById('sched-rows');
const schedHeadEl = document.getElementById('sched-head');
schedTbody.addEventListener('scroll', () => { schedHeadEl.scrollLeft = schedTbody.scrollLeft; });
const btnClose = document.getElementById('btn-close-modal');
const btnDownload = document.getElementById('btn-download-xlsx');
const easaBadge = document.getElementById('easa-badge');
const tabOverview = document.getElementById('tab-overview');
const tabContacts = document.getElementById('tab-contacts');
const tabAltprov = document.getElementById('tab-altprov');
const tabPernocta = document.getElementById('tab-pernocta');
const modalTabs = document.getElementById('modal-tabs');
let currentSchedStation = null;

const SUBFLEET_COLOR = {
  'A319 CEO':  'FFF3CD',
  'A320 CEO':  'CFE2FF',
  'A320 NEO':  'C6EFCE',
  'A321 CEO':  'FFDCB3',
  'A321 XLR':  'E1CCFF',
  'A330 CF6':  'FFC7CE',
  'A330 RR700':'FFDAB9',
  'A350':      'C6FFF8',
};
const MESES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

const FLEET_COLS = [
  { key:'CFM56',      grp:'A320',     label:'CFM56' },
  { key:'LEAP1A',     grp:'A320',     label:'LEAP 1A' },
  { key:'PW1100',     grp:'A320',     label:'PW1100' },
  { key:'CFMLEAP1A',  grp:'A321 XLR', label:'CFM LEAP - 1A' },
  { key:'CF6',        grp:'A330',     label:'CF6' },
  { key:'RRT700',     grp:'A330',     label:'RRT700' },
  { key:'RRTRENTXWB', grp:'A350',     label:'RR TRENT XWB' },
];

function fleetTableHtml(s){
  if (!s.easa || !s.easa.length){
    return '<div class="ov-empty-inline">Sin datos de cobertura de flota (proveedor sin aprobación EASA registrada).</div>';
  }
  let html = '';
  s.easa.forEach(p => {
    const groups = [];
    let last = null;
    FLEET_COLS.forEach(c => {
      if (c.grp !== last){ groups.push({grp:c.grp, span:1}); last = c.grp; }
      else groups[groups.length-1].span++;
    });
    html += `<div class="fleet-wrap">
      <table class="fleet-table">
        <thead>
          <tr>${groups.map(g => `<th class="grp" colspan="${g.span}">${g.grp}</th>`).join('')}</tr>
          <tr>${FLEET_COLS.map(c => `<th class="sub">${c.label}</th>`).join('')}</tr>
        </thead>
        <tbody>
          <tr>${FLEET_COLS.map(c => `<td class="${p.fleet[c.key] ? 'check' : 'nocheck'}">${p.fleet[c.key] ? '✓' : '—'}</td>`).join('')}</tr>
        </tbody>
      </table>
    </div>`;
  });
  return html;
}

const ICON_PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
const ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';

const ALT_FLEET_COLS = [
  { key:'CFM56',   grp:'A320', label:'CFM56' },
  { key:'LEAP1A',  grp:'A320', label:'LEAP 1A' },
  { key:'PW1100',  grp:'A320', label:'PW1100' },
  { key:'A330CF6', grp:'A330', label:'CF6' },
  { key:'A330RR',  grp:'A330', label:'RR' },
  { key:'A350RR',  grp:'A350', label:'RR' },
];

function altFleetTableHtml(fleet){
  const groups = [];
  let last = null;
  ALT_FLEET_COLS.forEach(c => {
    if (c.grp !== last){ groups.push({grp:c.grp, span:1}); last = c.grp; }
    else groups[groups.length-1].span++;
  });
  return `<table class="fleet-table">
    <thead>
      <tr>${groups.map(g => `<th class="grp" colspan="${g.span}">${g.grp}</th>`).join('')}</tr>
      <tr>${ALT_FLEET_COLS.map(c => `<th class="sub">${c.label}</th>`).join('')}</tr>
    </thead>
    <tbody>
      <tr>${ALT_FLEET_COLS.map(c => `<td class="${fleet[c.key] ? 'check' : 'nocheck'}">${fleet[c.key] ? '✓' : '—'}</td>`).join('')}</tr>
    </tbody>
  </table>`;
}

function providerCardsHtml(providers){
  if (!providers || !providers.length){
    return '<div class="no-data">No hay proveedores alternativos registrados para esta estación en el listado de backup.</div>';
  }
  let html = '';
  providers.forEach(p => {
    html += `<div class="altprov-card">
      <div class="altprov-head">
        <div class="altprov-name">${p.supplier}</div>
        <div class="altprov-appr">${p.easa ? 'EASA ' + p.easa : ''}</div>
      </div>
      ${altFleetTableHtml(p.fleet)}
      <div class="altprov-contact">
        ${p.email ? `<span>${ICON_MAIL} ${p.email}</span>` : ''}
        ${p.phone ? `<span>${ICON_PHONE} ${p.phone}</span>` : ''}
        ${p.hours ? `<span>${ICON_CLOCK} ${p.hours}</span>` : ''}
      </div>
      ${p.comments ? `<div class="altprov-comments">${p.comments}</div>` : ''}
    </div>`;
  });
  return html;
}

function renderPernoctaTab(s){
  if (!s.pernocta_by_month || !Object.keys(s.pernocta_by_month).length){
    tabPernocta.innerHTML = '<div class="no-data">Esta estación no tiene pernocta detectada en el horario IB 26/27.</div>';
    return;
  }
  tabPernocta.innerHTML = pernoctaMatrixHtml([s]);
  bindPmatrixCells(tabPernocta, (code, monthKey) => {
    tabPernocta.innerHTML = pcalBackHtml('Volver al resumen mensual') + pcalTitleHtml(s, monthKey) + pernoctaCalendarHtml(s, monthKey);
    tabPernocta.querySelector('.pcal-back').addEventListener('click', () => renderPernoctaTab(s));
  });
}

function renderAltProvidersTab(s){
  const alts = s.alt_providers || [];
  if (!alts.length){
    tabAltprov.innerHTML = '<div class="no-data">No hay proveedores alternativos registrados para esta estación en el listado de backup.</div>';
    return;
  }
  tabAltprov.innerHTML = '<div class="altprov-intro">Proveedores de respaldo para usar si el proveedor contratado no puede dar cobertura en esta estación.</div>' + providerCardsHtml(alts);
}

function renderContactsTab(s){
  if (!s.easa || !s.easa.length){
    tabContacts.innerHTML = '<div class="no-data">Sin contactos registrados para esta estación.</div>';
    return;
  }
  let html = '';
  s.easa.forEach(p => {
    if (s.easa.length > 1) html += `<div class="fleet-caption"><b>${p.vendor.replace('_','-')}</b></div>`;
    if (!p.contacts.length){
      html += '<div class="no-data">Sin contactos registrados.</div>';
    } else {
      html += '<div class="contacts-grid">';
      p.contacts.forEach(c => {
        const isEmail = c.number.includes('@');
        html += `<div class="contact-card${c.main?' is-main':''}">
          <span class="icon">${isEmail ? ICON_MAIL : ICON_PHONE}</span>
          <span class="txt"><div class="num">${c.number}${c.main?' <span class=\"main-badge\">Principal</span>':''}</div><div class="desc">${c.description}</div></span>
        </div>`;
      });
      html += '</div>';
    }
  });
  tabContacts.innerHTML = html;
}

function switchTab(tab){
  modalTabs.querySelectorAll('.modal-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('tab-overview').style.display = tab === 'overview' ? '' : 'none';
  document.getElementById('tab-sched').style.display = tab === 'sched' ? '' : 'none';
  document.getElementById('tab-contacts').style.display = tab === 'contacts' ? '' : 'none';
  document.getElementById('tab-altprov').style.display = tab === 'altprov' ? '' : 'none';
  document.getElementById('tab-pernocta').style.display = tab === 'pernocta' ? '' : 'none';
  btnDownload.style.display = tab === 'sched' ? '' : 'none';
  modalSub.style.display = tab === 'sched' ? '' : 'none';
}
modalTabs.querySelectorAll('.modal-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function renderOverviewTab(s){
  let html = '';

  // proveedor + cobertura de flota, lado a lado
  html += '<div class="ov-section"><div class="ov-row">';

  html += '<div class="ov-col"><div class="ov-section-title">Proveedor</div>';
  if (s.easa && s.easa.length){
    s.easa.forEach(p => {
      html += `<div class="ov-provider-card">
        <div><div class="name">${s.providers.join(' · ')}</div><div class="approval">EASA ${p.approval_number}</div></div>
      </div>`;
    });
  } else if (s.pending){
    html += `<div class="ov-provider-card pending"><div><div class="name">Aún no hay proveedor contratado</div></div></div>`;
  } else {
    html += `<div class="ov-provider-card"><div><div class="name">${s.providers.join(' · ')}</div><div class="approval">Sin datos EASA en el listado de aprobaciones</div></div></div>`;
  }
  html += '</div>';

  html += '<div class="ov-col"><div class="ov-section-title">Cobertura de flota</div>';
  html += '<div class="ov-fleet-scroll">' + fleetTableHtml(s) + '</div>';
  html += '</div>';

  html += '</div></div>';

  // estado operativo + contactos, lado a lado
  html += '<div class="ov-section"><div class="ov-row">';

  html += '<div class="ov-col"><div class="ov-section-title">Estado operativo</div>';
  html += `<div class="ov-status-card">
    <div class="ov-status-row"><span class="ov-status-lbl">Vuelo esta temporada</span><span class="ov-status-val${s.in_schedule?'':' warn'}">${s.in_schedule?'Sí':'No'}</span></div>
    <div class="ov-status-row"><span class="ov-status-lbl">Pernocta</span><span class="ov-status-val moon-val">${s.pernocta?'Sí':'No'}</span></div>
  </div>`;
  html += '</div>';

  html += '<div class="ov-col"><div class="ov-section-title">Contactos principales</div>';
  const allContacts = (s.easa || []).flatMap(p => p.contacts);
  const mainContacts = allContacts.filter(c => c.main);
  const previewContacts = mainContacts.length ? mainContacts : allContacts.slice(0, 3);
  if (previewContacts.length){
    html += '<div class="ov-contacts-preview">';
    previewContacts.forEach(c => {
      const isEmail = c.number.includes('@');
      html += `<div class="contact-card${c.main?' is-main':''}">
        <span class="icon">${isEmail ? ICON_MAIL : ICON_PHONE}</span>
        <span class="txt"><div class="num">${c.number}</div><div class="desc">${c.description}</div></span>
      </div>`;
    });
    html += '</div>';
    if (allContacts.length > previewContacts.length){
      html += `<button class="ov-see-all" data-goto="contacts">Ver los ${allContacts.length} contactos <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>`;
    }
  } else {
    html += '<div class="ov-empty-inline">Sin contactos registrados.</div>';
  }
  html += '</div>';

  html += '</div></div>';

  tabOverview.innerHTML = html;
  const seeAllBtn = tabOverview.querySelector('.ov-see-all');
  if (seeAllBtn) seeAllBtn.addEventListener('click', () => switchTab('contacts'));
}

function openSchedule(code){
  const s = STATIONS.find(x => x.code === code);
  if (!s) return;
  currentSchedStation = s;
  modalCode.textContent = s.code;
  modalCity.textContent = `${s.city}, ${s.country}`;
  modalSub.textContent = `Horario IB 26/27 (15 sep 2026 – 27 mar 2027) · hora UTC · ${s.schedule.length.toLocaleString('es-ES')} movimientos`;
  if (s.easa && s.easa.length){
    easaBadge.textContent = 'EASA ' + s.easa.map(p => p.approval_number).join(' / ');
    easaBadge.style.display = '';
  } else {
    easaBadge.style.display = 'none';
  }
  renderOverviewTab(s);
  renderContactsTab(s);
  renderAltProvidersTab(s);
  renderPernoctaTab(s);
  switchTab('overview');
  schedTbody.innerHTML = '';
  if (!s.schedule.length){
    schedTbody.innerHTML = '<div class="sched-empty">Sin vuelos programados en este periodo.</div>';
  } else {
    const frag = document.createDocumentFragment();
    s.schedule.forEach(r => {
      const [date, freq, flt, origin, deptTerm, deptTime, dest, destTerm, arrTime, subfleet] = r;
      const row = document.createElement('div');
      row.className = 'sg-row';
      const bg = SUBFLEET_COLOR[subfleet];
      row.innerHTML = `<div class="sg-c">${date}</div><div class="sg-c">${freq}</div><div class="sg-c">${flt}</div><div class="sg-c">${origin}</div><div class="sg-c">${deptTerm}</div><div class="sg-c">${deptTime}</div><div class="sg-c">${dest}</div><div class="sg-c">${destTerm}</div><div class="sg-c">${arrTime}</div>
        <div class="sg-c"${bg?` style="background:#${bg}"`:''}>${subfleet}</div>`;
      frag.appendChild(row);
    });
    schedTbody.appendChild(frag);
  }
  modalOverlay.classList.add('open');
}

function closeSchedule(){
  modalOverlay.classList.remove('open');
  currentSchedStation = null;
}

btnClose.addEventListener('click', closeSchedule);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeSchedule(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSchedule(); closeAltModal(); closePernoctaOverview(); closeFcamoOverview(); } });

// ---- modal de detalle para "Proveedores no contratados" ----
const altModalOverlay = document.getElementById('altmodal-overlay');
const altModalCode = document.getElementById('altmodal-code');
const altModalCity = document.getElementById('altmodal-city');
const altModalBody = document.getElementById('altmodal-body');
const btnCloseAltModal = document.getElementById('btn-close-altmodal');

function openAltModal(code){
  const s = ALT_STATIONS.find(x => x.code === code);
  if (!s) return;
  altModalCode.textContent = s.code;
  altModalCity.textContent = `${s.city}, ${s.country}`;
  altModalBody.innerHTML = '<div class="altprov-intro">Proveedores no contratados con cobertura en esta estación (solo se muestra la flota que operamos).</div>' + providerCardsHtml(s.providers);
  altModalOverlay.classList.add('open');
  highlightRow(code);
}

function closeAltModal(){
  altModalOverlay.classList.remove('open');
}

btnCloseAltModal.addEventListener('click', closeAltModal);
altModalOverlay.addEventListener('click', (e) => { if (e.target === altModalOverlay) closeAltModal(); });

// ---- panel general de pernoctas: matriz estacion x mes ----
const pernoctaOverviewOverlay = document.getElementById('pernocta-overview-overlay');
const pernoctaOverviewBody = document.getElementById('pernocta-overview-body');
const openPernoctaOverviewBtn = document.getElementById('open-pernocta-overview');
const btnClosePernoctaOverview = document.getElementById('btn-close-pernocta-overview');

const MESES_ES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS_ES = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'];

function monthLabel(monthKey){
  const [y, m] = monthKey.split('-');
  return `${MESES_ES[parseInt(m) - 1]} ${y}`;
}

function pernoctaMatrixHtml(stationsArr){
  if (!stationsArr.length){
    return '<div class="no-data">No hay estaciones con pernocta detectada.</div>';
  }
  let html = '<div class="pmatrix-wrap"><table class="pmatrix">';
  html += '<thead><tr><th class="pmatrix-station">ESTACIÓN</th>' +
    PERNOCTA_MONTHS.map(m => `<th>${monthLabel(m)}</th>`).join('') + '</tr></thead><tbody>';
  stationsArr.forEach(s => {
    html += `<tr><td class="pmatrix-station"><span class="code">${s.code}</span></td>` +
      PERNOCTA_MONTHS.map(m => {
        const n = (s.pernocta_by_month || {})[m];
        return n
          ? `<td><button class="pmatrix-cell" data-code="${s.code}" data-month="${m}">${n}</button></td>`
          : `<td class="pmatrix-empty">—</td>`;
      }).join('') + '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function bindPmatrixCells(container, onCellClick){
  container.querySelectorAll('.pmatrix-cell').forEach(btn => {
    btn.addEventListener('click', () => onCellClick(btn.dataset.code, btn.dataset.month));
  });
}

function pcalBackHtml(label){
  return `<button class="pcal-back">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
    ${label}
  </button>`;
}
function pcalTitleHtml(s, monthKey){
  return `<div class="pcal-title"><span class="code">${s.code}</span> ${s.city}, ${s.country} · ${monthLabel(monthKey)}</div>`;
}

function pernoctaCalendarHtml(s, monthKey){
  const [year, month] = monthKey.split('-').map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekdayMon = (firstOfMonth.getUTCDay() + 6) % 7; // 0=Lun..6=Dom
  const byDate = s.pernocta_by_date || {};

  let html = '<div class="pcal-scroll"><div class="pcal-grid">' + DIAS_ES.map(d => `<div class="pcal-dow">${d}</div>`).join('');
  for (let i = 0; i < firstWeekdayMon; i++) html += '<div class="pcal-cell pcal-blank"></div>';
  for (let d = 1; d <= daysInMonth; d++){
    const dateIso = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const occs = byDate[dateIso];
    if (occs && occs.length){
      html += `<div class="pcal-cell pcal-has">
        <div class="pcal-day">${d}</div>
        ${occs.map(o => `
          <div class="pcal-flight"><b>${o.arr_flight}</b> ${o.arr_from} ${o.arr_from_time} → ${o.arr_to} ${o.arr_to_time}</div>
          <div class="pcal-flight"><b>${o.dep_flight}</b> ${o.dep_from} ${o.dep_from_time} → ${o.dep_to} ${o.dep_to_time}</div>
        `).join('')}
      </div>`;
    } else {
      html += `<div class="pcal-cell"><div class="pcal-day pcal-day-off">${d}</div></div>`;
    }
  }
  html += '</div></div>';
  return html;
}

function renderPernoctaMatrix(){
  const withPernocta = STATIONS.filter(s => s.pernocta_by_month && Object.keys(s.pernocta_by_month).length)
    .sort((a, b) => a.code.localeCompare(b.code));
  pernoctaOverviewBody.innerHTML = pernoctaMatrixHtml(withPernocta);
  bindPmatrixCells(pernoctaOverviewBody, (code, monthKey) => {
    const s = STATIONS.find(x => x.code === code);
    pernoctaOverviewBody.innerHTML = pcalBackHtml('Todas las estaciones') + pcalTitleHtml(s, monthKey) + pernoctaCalendarHtml(s, monthKey);
    pernoctaOverviewBody.querySelector('.pcal-back').addEventListener('click', renderPernoctaMatrix);
  });
}

function openPernoctaOverview(){
  renderPernoctaMatrix();
  pernoctaOverviewOverlay.classList.add('open');
}
function closePernoctaOverview(){
  pernoctaOverviewOverlay.classList.remove('open');
}
openPernoctaOverviewBtn.addEventListener('click', openPernoctaOverview);
btnClosePernoctaOverview.addEventListener('click', closePernoctaOverview);
pernoctaOverviewOverlay.addEventListener('click', (e) => { if (e.target === pernoctaOverviewOverlay) closePernoctaOverview(); });

// ---- F-CAMO-IBE-14: checklists compartidas ----
const FCAMO_REASONS = [
  { value:'opening', label:'New Maintenance Organization / Station opening' },
  { value:'update', label:'Maintenance Organization or Station feature update' },
];
const FCAMO_STATION_TYPES = ['ETOPS', 'Overnight', 'On call'];
const FCAMO_FLEET_SCOPE = ['A320 FAMILY', 'A321 XLR', 'A330', 'A350'];
const FCAMO_SECTIONS = [
  { key:'amos', label:'AMOS', items:[
    {id:'amos_org_setup', label:'Maintenance Organization set up (APN 2207)'},
    {id:'amos_contacts', label:'Station contacts created / updated (APN 53)'},
    {id:'amos_store_address', label:'Store address created / updated (APN 53)'},
  ]},
  { key:'aviatar', label:'AVIATAR (Logbook central)', items:[
    {id:'aviatar_can', label:'Company Approval Numbers set up'},
    {id:'aviatar_rts', label:'Release to Service Workflows validated'},
  ]},
  { key:'staff', label:'Certifying and general staff', hideIfOnCall:true, items:[
    {id:'staff_credentials', label:'Credentials Provisioning (IB Domain)'},
    {id:'staff_apps', label:'IB apps access granted'},
    {id:'staff_lshm', label:'LSHM / NTO05 course'},
    {id:'staff_etlb_course', label:'AMOS mobile / E-TLB course'},
  ]},
  { key:'docs', label:'Maintenance Organization documentation', items:[
    {id:'docs_form3', label:'EASA Form 3'},
    {id:'docs_moe', label:'MOE (scope at the station)'},
    {id:'docs_ssar', label:'SSAR fulfilled'},
    {id:'docs_sgha', label:'SGHA signed'},
    {id:'docs_tpaa', label:'Third Party Application Access Agreement (if not existing)'},
  ]},
  { key:'materials', label:'Materials Management', items:[
    {id:'mat_iatp', label:'IATP Pool or MBK'},
    {id:'mat_flightkit', label:'Flight Kit operation'},
    {id:'mat_fluids', label:'Fluids (OIL/HYD) stock'},
    {id:'mat_oss', label:'OSS consumables sent (if applicable)'},
    {id:'mat_parts_alerts', label:'Parts alerts parametrization done (APN 313)'},
    {id:'mat_store_locations', label:'Store locations created (APN 2409)'},
  ]},
  { key:'addition', label:'Addition', hideIfOnCall:true, items:[
    {id:'add_etlb_keys', label:'E-TLB padlock keys sent'},
  ]},
];
function fcamoAllItems(stationTypes){
  const onCall = (stationTypes || []).includes('On call');
  return FCAMO_SECTIONS.filter(s => !(s.hideIfOnCall && onCall)).flatMap(s => s.items);
}
// los datos de F-CAMO los escribe cualquier usuario: nunca se fia uno de su formato ni se pintan sin escapar
function fcamoSafeJson(str, fallback){
  try {
    const v = JSON.parse(str);
    const ok = Array.isArray(fallback) ? Array.isArray(v) : (v && typeof v === 'object' && !Array.isArray(v));
    return ok ? v : fallback;
  } catch (e) { return fallback; }
}
const fcamoStatusOf = item => item.status === 'completed' ? 'completed' : 'pending';
function fcamoProgress(item){
  const types = fcamoSafeJson(item.station_types, []);
  const state = fcamoSafeJson(item.items_state, {});
  const all = fcamoAllItems(types);
  const done = all.filter(it => state[it.id]).length;
  return { done, total: all.length, pct: all.length ? Math.round(done / all.length * 100) : 0 };
}

function updateFcamoPendingBadge(items){
  const n = items.filter(i => i.status !== 'completed').length;
  document.getElementById('fcamo-pending-count').textContent = n;
  document.getElementById('open-fcamo-header-panel').style.display = 'flex';
  window.homeData.fcamo = items;
  renderHomeStats();
}
async function refreshFcamoBadge(){
  try {
    const { items } = await fcamoApi('', { method: 'GET' });
    updateFcamoPendingBadge(items);
  } catch (err){ /* si falla, se reintentara la proxima vez que se abra el panel */ }
}
document.getElementById('open-fcamo-header-panel').addEventListener('click', openFcamoOverview);

const fcamoOverviewOverlay = document.getElementById('fcamo-overview-overlay');
const fcamoOverviewBody = document.getElementById('fcamo-overview-body');
const btnNewFcamo = document.getElementById('btn-new-fcamo');
const btnFcamoTrash = document.getElementById('btn-fcamo-trash');
const btnCloseFcamoOverview = document.getElementById('btn-close-fcamo-overview');
btnCloseFcamoOverview.addEventListener('click', closeFcamoOverview);
fcamoOverviewOverlay.addEventListener('click', (e) => { if (e.target === fcamoOverviewOverlay) closeFcamoOverview(); });
btnNewFcamo.addEventListener('click', () => renderFcamoForm());
btnFcamoTrash.addEventListener('click', openFcamoTrash);
let fcamoShowCompleted = false;

async function fcamoApi(path, options){
  const token = localStorage.getItem(AUTH_KEY);
  const res = await fetch(`${AUTH_API_URL}/api/fcamo${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(options && options.headers) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de conexión');
  return data;
}

async function openFcamoOverview(){
  btnNewFcamo.style.display = canWrite() ? '' : 'none';
  btnFcamoTrash.style.display = isAdminRole() ? '' : 'none';
  fcamoShowCompleted = false;
  fcamoOverviewBody.innerHTML = '<div class="no-data">Cargando…</div>';
  fcamoOverviewOverlay.classList.add('open');
  try {
    const { items } = await fcamoApi('', { method: 'GET' });
    renderFcamoListView(items);
  } catch (err){
    fcamoOverviewBody.innerHTML = `<div class="no-data">No se ha podido conectar con el servidor (${err.message}).</div>`;
  }
}
function closeFcamoOverview(){
  fcamoOverviewOverlay.classList.remove('open');
}

function renderFcamoListView(items){
  btnNewFcamo.style.display = canWrite() ? '' : 'none';
  btnFcamoTrash.style.display = isAdminRole() ? '' : 'none';
  updateFcamoPendingBadge(items);
  if (!items.length){
    fcamoOverviewBody.innerHTML = '<div class="no-data">Todavía no hay ningún F-CAMO-IBE-14 abierto. Pulsa "Nuevo F-CAMO-IBE-14" para empezar uno.</div>';
    return;
  }
  const completedCount = items.filter(i => fcamoStatusOf(i) === 'completed').length;
  const visible = fcamoShowCompleted ? items : items.filter(i => fcamoStatusOf(i) !== 'completed');

  let html = '';
  if (completedCount > 0){
    html += `<button type="button" class="ov-see-all" id="fcamo-toggle-completed" style="margin-bottom:14px;">
      ${fcamoShowCompleted ? 'Ocultar completados' : `Ver completados (${completedCount})`}
    </button>`;
  }
  if (!visible.length){
    html += '<div class="no-data">No hay F-CAMO-IBE-14 pendientes ahora mismo.</div>';
  } else {
    html += visible.map(item => {
      const st = STATIONS.find(s => s.code === item.station_code);
      const { done, total, pct } = fcamoProgress(item);
      const reasonLabel = escHtml((FCAMO_REASONS.find(r => r.value === item.reason) || {}).label || item.reason);
      const firstFlight = (st && st.schedule && st.schedule.length) ? st.schedule[0][0] : null;
      const status = fcamoStatusOf(item);
      return `<div class="fcamo-list-item" data-id="${Number(item.id)}">
        <span class="fcamo-list-code">${escHtml(item.station_code)}</span>
        <span class="fcamo-list-meta">
          <div class="fcamo-list-reason">${reasonLabel}</div>
          <div class="fcamo-list-sub">${st ? escHtml(st.city + ', ' + st.country) : ''} · abierto por ${escHtml(item.created_by)}${firstFlight ? ' · primer vuelo ' + escHtml(firstFlight) : ''}</div>
        </span>
        <span class="fcamo-status-pill ${status}">${status === 'completed' ? 'COMPLETADO' : 'PENDIENTE'}</span>
        <span class="fcamo-progress-wrap">
          <div class="fcamo-progress-bar"><div class="fcamo-progress-fill" style="width:${pct}%"></div></div>
          <div class="fcamo-progress-txt">${done}/${total}</div>
        </span>
      </div>`;
    }).join('');
  }
  fcamoOverviewBody.innerHTML = html;

  const toggleBtn = document.getElementById('fcamo-toggle-completed');
  if (toggleBtn) toggleBtn.addEventListener('click', () => { fcamoShowCompleted = !fcamoShowCompleted; renderFcamoListView(items); });

  fcamoOverviewBody.querySelectorAll('.fcamo-list-item').forEach(el => {
    el.addEventListener('click', async () => {
      fcamoOverviewBody.innerHTML = '<div class="no-data">Cargando…</div>';
      try {
        const { item } = await fcamoApi(`/${el.dataset.id}`, { method: 'GET' });
        renderFcamoDetailView(item);
      } catch (err){
        fcamoOverviewBody.innerHTML = `<div class="no-data">No se ha podido cargar (${err.message}).</div>`;
      }
    });
  });
}

async function openFcamoTrash(){
  btnNewFcamo.style.display = 'none';
  btnFcamoTrash.style.display = 'none';
  fcamoOverviewBody.innerHTML = '<div class="no-data">Cargando…</div>';
  try {
    const { items } = await fcamoApi('/trash', { method: 'GET' });
    renderFcamoTrashView(items);
  } catch (err){
    fcamoOverviewBody.innerHTML = `<div class="no-data">No se ha podido cargar la papelera (${err.message}).</div>`;
  }
}

function renderFcamoTrashView(items){
  let html = `<button class="fcamo-back" id="fcamo-trash-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Todos los F-CAMO-IBE-14</button>
    <div class="fcamo-detail-title" style="margin-bottom:14px;">Papelera</div>`;
  if (!items.length){
    html += '<div class="no-data">No hay F-CAMO-IBE-14 eliminados.</div>';
  } else {
    html += items.map(item => {
      const st = STATIONS.find(s => s.code === item.station_code);
      return `<div class="fcamo-list-item" data-id="${Number(item.id)}" style="cursor:default;">
        <span class="fcamo-list-code">${escHtml(item.station_code)}</span>
        <span class="fcamo-list-meta">
          <div class="fcamo-list-reason">${st ? escHtml(st.city + ', ' + st.country) : ''}</div>
          <div class="fcamo-list-sub">eliminado por ${escHtml(item.deleted_by)}, ${timeAgo(item.deleted_at)}</div>
        </span>
        <button class="fcamo-restore-btn" data-id="${Number(item.id)}">Restaurar</button>
      </div>`;
    }).join('');
  }
  fcamoOverviewBody.innerHTML = html;
  document.getElementById('fcamo-trash-back').addEventListener('click', openFcamoOverview);
  fcamoOverviewBody.querySelectorAll('[data-id] .fcamo-restore-btn, .fcamo-list-item button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.closest('.fcamo-list-item').dataset.id;
      try {
        await fcamoApi(`/${id}/restore`, { method: 'POST' });
        openFcamoTrash();
        refreshFcamoBadge();
      } catch (err){
        alert('No se ha podido restaurar: ' + err.message);
      }
    });
  });
}

function renderFcamoForm(){
  btnNewFcamo.style.display = 'none';
  const stationOptions = sortedStations.map(s => `<option value="${s.code}">${s.code} — ${s.city}</option>`).join('');
  fcamoOverviewBody.innerHTML = `
    <button class="fcamo-back" id="fcamo-form-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Todos los F-CAMO-IBE-14</button>
    <div class="fcamo-detail-title" style="margin-bottom:18px;">Nuevo F-CAMO-IBE-14</div>
    <div class="fcamo-section-title">Reason of F-CAMO-IBE-14</div>
    ${FCAMO_REASONS.map((r,i) => `<label class="fcamo-checkrow"><input type="radio" name="fcamo-reason" value="${r.value}" ${i===0?'checked':''}>${r.label}</label>`).join('')}
    <div class="fcamo-section-title">Station info</div>
    <div class="fcamo-form-grid">
      <div class="fcamo-form-field"><label>IATA Code</label><select id="fcamo-f-station">${stationOptions}</select></div>
    </div>
    <label style="font-size:11px;font-weight:600;color:var(--muted-2);display:block;margin-bottom:6px;">Station Type</label>
    ${FCAMO_STATION_TYPES.map(t => `<label class="fcamo-checkrow"><input type="checkbox" class="fcamo-f-stationtype" value="${t}">${t}</label>`).join('')}
    <div class="fcamo-section-title">Main organization data</div>
    <div class="fcamo-form-grid">
      <div class="fcamo-form-field"><label>Company name</label><input type="text" id="fcamo-f-company"></div>
      <div class="fcamo-form-field"><label>EASA approval reference</label><input type="text" id="fcamo-f-easaref"></div>
      <div class="fcamo-form-field"><label>Last EASA approval date</label><input type="text" id="fcamo-f-easadate" placeholder="dd-MM-yyyy"></div>
    </div>
    <label style="font-size:11px;font-weight:600;color:var(--muted-2);display:block;margin-bottom:6px;">Scope / Approved Fleet</label>
    ${FCAMO_FLEET_SCOPE.map(f => `<label class="fcamo-checkrow"><input type="checkbox" class="fcamo-f-fleet" value="${f}">${f}</label>`).join('')}
    <button class="login-btn" id="fcamo-f-submit" style="margin-top:20px;width:auto;padding:11px 22px;">Crear F-CAMO-IBE-14</button>
  `;
  document.getElementById('fcamo-form-back').addEventListener('click', openFcamoOverview);
  document.getElementById('fcamo-f-submit').addEventListener('click', async () => {
    const station_code = document.getElementById('fcamo-f-station').value;
    const reason = document.querySelector('input[name="fcamo-reason"]:checked').value;
    const station_types = [...document.querySelectorAll('.fcamo-f-stationtype:checked')].map(el => el.value);
    const company_name = document.getElementById('fcamo-f-company').value.trim();
    const easa_ref = document.getElementById('fcamo-f-easaref').value.trim();
    const easa_date = document.getElementById('fcamo-f-easadate').value.trim();
    const fleet_scope = [...document.querySelectorAll('.fcamo-f-fleet:checked')].map(el => el.value);
    try {
      const { item } = await fcamoApi('', { method:'POST', body: JSON.stringify({station_code, reason, station_types, company_name, easa_ref, easa_date, fleet_scope}) });
      renderFcamoDetailView(item);
      refreshFcamoBadge();
    } catch (err){
      alert('No se ha podido crear: ' + err.message);
    }
  });
}

function renderFcamoDetailView(item){
  btnNewFcamo.style.display = 'none';
  const st = STATIONS.find(s => s.code === item.station_code);
  const types = fcamoSafeJson(item.station_types, []).map(String);
  const fleet = fcamoSafeJson(item.fleet_scope, []).map(String);
  const state = fcamoSafeJson(item.items_state, {});
  const status = fcamoStatusOf(item);
  const writable = canWrite(), canDelete = isAdminRole();
  const reasonLabel = escHtml((FCAMO_REASONS.find(r => r.value === item.reason) || {}).label || item.reason);
  const onCall = types.includes('On call');
  const sections = FCAMO_SECTIONS.filter(s => !(s.hideIfOnCall && onCall));
  const { done, total, pct } = fcamoProgress(item);

  fcamoOverviewBody.innerHTML = `
    <button class="fcamo-back" id="fcamo-detail-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Todos los F-CAMO-IBE-14</button>
    <div class="fcamo-detail-head">
      <div>
        <div class="fcamo-detail-title"><span class="fcamo-list-code">${escHtml(item.station_code)}</span> ${st ? escHtml(st.city + ', ' + st.country) : ''}</div>
        <div class="fcamo-detail-sub">${reasonLabel} · abierto por ${escHtml(item.created_by)} · ${escHtml(types.join(', ')) || 'sin tipo de estación indicado'}${item.company_name ? ' · ' + escHtml(item.company_name) : ''}${fleet.length ? ' · ' + escHtml(fleet.join(', ')) : ''}</div>
      </div>
      <span class="fcamo-status-pill ${status}" id="fcamo-status-pill">${status === 'completed' ? 'COMPLETADO' : 'PENDIENTE'}</span>
    </div>
    <div class="fcamo-progress-bar" style="width:100%;margin-bottom:4px;"><div class="fcamo-progress-fill" id="fcamo-detail-fill" style="width:${pct}%"></div></div>
    <div class="fcamo-progress-txt" id="fcamo-detail-progress-txt" style="text-align:left;margin-bottom:18px;">${done}/${total} completados <span class="fcamo-save-note" id="fcamo-save-note">Guardado</span></div>
    ${sections.map(sec => `
      <div class="fcamo-section-title">${sec.label}</div>
      ${sec.items.map(it => `<label class="fcamo-checkrow"><input type="checkbox" class="fcamo-item-check" data-id="${it.id}" ${state[it.id] ? 'checked' : ''} ${writable ? '' : 'disabled'}>${it.label}</label>`).join('')}
    `).join('')}
    ${canDelete ? '<button class="fcamo-delete-btn" id="fcamo-delete-btn" style="margin-top:18px;">Eliminar este F-CAMO-IBE-14</button>' : ''}
    ${writable ? '' : '<div style="margin-top:14px;font-size:12px;color:var(--amber);">Solo consulta: no puedes modificar este checklist.</div>'}
  `;

  document.getElementById('fcamo-detail-back').addEventListener('click', openFcamoOverview);

  let saveTimer = null;
  function scheduleSave(patch){
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const { item: updated } = await fcamoApi(`/${item.id}`, { method:'PATCH', body: JSON.stringify(patch) });
        Object.assign(item, updated);
        if (patch.status !== undefined) refreshFcamoBadge();
        const note = document.getElementById('fcamo-save-note');
        if (note){ note.classList.add('show'); setTimeout(() => note.classList.remove('show'), 1500); }
      } catch (err){ /* si falla el guardado, se reintentara en el siguiente cambio */ }
    }, 500);
  }

  fcamoOverviewBody.querySelectorAll('.fcamo-item-check').forEach(cb => {
    cb.addEventListener('change', () => {
      state[cb.dataset.id] = cb.checked;
      const allItems = fcamoAllItems(types);
      const doneNow = allItems.filter(it => state[it.id]).length;
      const pctNow = Math.round(doneNow / allItems.length * 100);
      document.getElementById('fcamo-detail-fill').style.width = pctNow + '%';
      document.getElementById('fcamo-detail-progress-txt').firstChild.textContent = `${doneNow}/${allItems.length} completados `;
      const newStatus = doneNow === allItems.length ? 'completed' : 'pending';
      const pill = document.getElementById('fcamo-status-pill');
      pill.className = 'fcamo-status-pill ' + newStatus;
      pill.textContent = newStatus === 'completed' ? 'COMPLETADO' : 'PENDIENTE';
      scheduleSave({ items_state: state, status: newStatus });
    });
  });
  const deleteBtn = document.getElementById('fcamo-delete-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', async () => {
    if (!confirm('¿Seguro que quieres eliminar este F-CAMO-IBE-14? No se puede deshacer.')) return;
    try {
      await fcamoApi(`/${item.id}`, { method:'DELETE' });
      openFcamoOverview();
    } catch (err){
      alert('No se ha podido eliminar: ' + err.message);
    }
  });
}

// ---- estaciones sin proveedor: notas compartidas con candado de edicion + historial ----
async function notesApi(path, options){
  const token = localStorage.getItem(AUTH_KEY);
  const res = await fetch(`${AUTH_API_URL}/api/notes${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(options && options.headers) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok){
    const err = new Error(data.error || 'Error de conexión');
    err.locked_by = data.locked_by;
    throw err;
  }
  return data;
}

function uncoveredStationCodes(){
  return STATIONS.filter(s => s.pending && s.in_schedule).map(s => s.code);
}

function timeAgo(unixSeconds){
  if (!unixSeconds) return '';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  return `hace ${days} día${days === 1 ? '' : 's'}`;
}

async function refreshUncoveredBadge(){
  try {
    const { items } = await notesApi('', { method: 'GET' });
    window.homeData.notes = items;
    renderHomeStats();
  } catch (err){ /* se reintentara al volver al inicio */ }
}

async function openFcamoDetailById(id){
  btnNewFcamo.style.display = 'none';
  btnFcamoTrash.style.display = 'none';
  fcamoOverviewBody.innerHTML = '<div class="no-data">Cargando…</div>';
  fcamoOverviewOverlay.classList.add('open');
  try {
    const { item } = await fcamoApi(`/${id}`, { method: 'GET' });
    renderFcamoDetailView(item);
  } catch (err){
    fcamoOverviewBody.innerHTML = `<div class="no-data">No se ha podido cargar (${err.message}).</div>`;
  }
}

// ==== SEGUIMIENTO: INICIO ====
// Estaciones con vuelo y sin proveedor contratado. Por cada estacion solo importan tres cosas:
// a quien hemos contactado, a quien hemos elegido y en que situacion esta la estacion.
// Los proveedores que pueden cubrirla salen de los datos de proveedores no contratados. Si hace falta
// se puede apuntar otro solo para esa estacion; eso vive unicamente aqui (no toca esos datos).

const TRK_STAGES = [
  { v:'none',      label:'Sin gestionar',        hint:'Todavía no hemos contactado con ningún proveedor.' },
  { v:'searching', label:'En búsqueda',          hint:'Estamos contactando proveedores.' },
  { v:'selected',  label:'Proveedor elegido',    hint:'Ya hay proveedor elegido; falta cerrar el contrato.' },
  { v:'interim',   label:'Solución provisional', hint:'Cubierta temporalmente por otra vía.' },
  { v:'covered',   label:'Cubierta',             hint:'Ya tiene proveedor contratado; sale del seguimiento.' },
];
function trkStageLabel(v){ return (TRK_STAGES.find(s => s.v === v) || TRK_STAGES[0]).label; }
// las fases del sistema anterior (contactado / negociando) cuentan como "en busqueda"
function trkNormStage(v){
  if (v === 'contacted' || v === 'negotiating') return 'searching';
  return TRK_STAGES.some(s => s.v === v) ? v : 'none';
}
// estado de un proveedor: pendiente | contactado | elegido (los antiguos offer/negotiating = contactado)
function trkCandState(status){
  if (status === 'selected') return 'selected';
  if (status === 'contacted' || status === 'offer' || status === 'negotiating') return 'contacted';
  return 'identified';
}
function trkCandLabel(status){
  return ({ selected:'Elegido', contacted:'Contactado', identified:'Pendiente', offer:'Oferta recibida', negotiating:'Negociando', discarded:'Descartado' })[status] || 'Pendiente';
}

const TRK = {
  notes:{}, cands:{}, fcamo:{},
  loaded:false, loading:false, error:null, active:false,
  filter:'all', q:'',
  code:null, timer:null,
};

// ---------- utilidades ----------
function trkToday(){ const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function trkWho(email){ return String(email || '').split('@')[0]; }
function trkToast(msg, isErr){
  let t = document.getElementById('trk-toast');
  if (!t){ t = document.createElement('div'); t.id = 'trk-toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'trk-toast show' + (isErr ? ' err' : '');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 3800);
}

// primer vuelo de la estacion y cuantos dias faltan (para ordenar por urgencia)
function trkFlight(code){
  const s = STATIONS.find(x => x.code === code);
  let first = null;
  if (s && s.schedule){
    for (const r of s.schedule){
      const d = parseDateStr(r[0]);
      if (!isNaN(d) && (!first || d < first)) first = d;
    }
  }
  const t = trkToday();
  const days = first ? Math.round((first.getTime() - Date.UTC(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000) : null;
  return {
    first, days, operating: days !== null && days <= 0,
    movements: s ? (s.flights || (s.schedule || []).length) : 0,
    city: s ? s.city : '', country: s ? s.country : '',
  };
}
function trkFlightText(f){
  if (!f.first) return 'Sin vuelos programados';
  const d = f.first.toLocaleDateString('es-ES', { day:'numeric', month:'short', timeZone:'UTC' });
  if (f.days <= 0) return `Ya opera desde el ${d}`;
  if (f.days === 1) return `Primer vuelo mañana (${d})`;
  return `Primer vuelo en ${f.days} días (${d})`;
}
function trkUrgency(code, stage){
  if (stage === 'interim' || stage === 'covered') return '';
  const f = trkFlight(code);
  if (!f.first) return '';
  return f.operating ? 'crit' : (f.days <= 14 ? 'high' : '');
}

function trkNote(code){ return TRK.notes[code] || { station_code:code, stage:'none', note:'', updated_by:'', updated_at:null }; }
function trkStageOf(code){ return trkNormStage(trkNote(code).stage); }

// proveedores que pueden cubrir la estacion (datos de proveedores no contratados)
function trkSuggestions(code){
  const out = [], seen = new Set();
  const add = p => {
    const name = String(p.supplier || '').trim();
    const k = name.toLowerCase();
    if (!name || seen.has(k)) return;
    seen.add(k);
    out.push({ name, easa:p.easa || '', email:p.email || '', phone:p.phone || '' });
  };
  const alt = ALT_STATIONS.find(x => x.code === code);
  if (alt) (alt.providers || []).forEach(add);
  const s = STATIONS.find(x => x.code === code);
  if (s) (s.alt_providers || []).forEach(add);
  return out;
}
// una fila por proveedor del listado + los apuntados que no estan en el listado (a mano, o porque
// se actualizaron los datos): se siguen mostrando para no perder el seguimiento
function trkProviderRows(code){
  const stored = TRK.cands[code] || [];
  const byName = new Map(stored.map(c => [c.provider_name.trim().toLowerCase(), c]));
  const rows = [];
  const used = new Set();
  trkSuggestions(code).forEach(s => {
    const c = byName.get(s.name.toLowerCase());
    if (c) used.add(c.id);
    rows.push({ name:s.name, easa:s.easa, email:s.email, phone:s.phone, cand:c || null, orphan:false });
  });
  stored.forEach(c => { if (!used.has(c.id)) rows.push({ name:c.provider_name, easa:'', email:'', phone:'', cand:c, orphan:true }); });
  const rank = r => { const st = r.cand ? trkCandState(r.cand.status) : 'identified'; return st === 'selected' ? 0 : st === 'contacted' ? 1 : 2; };
  return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'));
}
function trkSummary(code){
  const st = (TRK.cands[code] || []).map(c => ({ name:c.provider_name, state:trkCandState(c.status) }));
  return {
    chosen: st.find(c => c.state === 'selected') || null,
    contacted: st.filter(c => c.state !== 'identified'),
  };
}

function trkItems(){
  return uncoveredStationCodes().map(code => ({
    code, stage:trkStageOf(code), note:trkNote(code), flight:trkFlight(code), sum:trkSummary(code),
  }));
}
function trkCounts(){
  const c = { all:0, none:0, searching:0, selected:0, interim:0, covered:0 };
  trkItems().forEach(it => { c[it.stage]++; if (it.stage !== 'covered') c.all++; });
  return c;
}
function trkVisibleItems(){
  let items = trkItems();
  const f = TRK.filter;
  items = f === 'all' ? items.filter(i => i.stage !== 'covered') : items.filter(i => i.stage === f);
  const q = TRK.q.trim().toLowerCase();
  if (q){
    items = items.filter(i => [i.code, i.flight.city, i.flight.country, ...i.sum.contacted.map(c => c.name)].join(' ').toLowerCase().includes(q));
  }
  // los que ya operan primero (mas movimientos antes); despues, por fecha de primer vuelo
  return items.sort((a, b) => {
    if (a.flight.operating !== b.flight.operating) return a.flight.operating ? -1 : 1;
    if (a.flight.operating) return b.flight.movements - a.flight.movements;
    return (a.flight.first ? a.flight.first.getTime() : Infinity) - (b.flight.first ? b.flight.first.getTime() : Infinity);
  });
}

async function trkApi(path, options){
  const token = localStorage.getItem(AUTH_KEY);
  const res = await fetch(`${AUTH_API_URL}/api/tracking${path}`, {
    ...options,
    headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}`, ...(options && options.headers) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok){ const e = new Error(data.error || 'Error de conexión'); e.status = res.status; throw e; }
  return data;
}

// ---------- carga ----------
function trkSyncHome(){
  window.homeData.notes = Object.values(TRK.notes);
  if (typeof renderHomeStats === 'function') renderHomeStats();
}
async function trkLoad(){
  if (TRK.loading) return;
  TRK.loading = true;
  try {
    const [data, fc] = await Promise.all([
      trkApi('', { method:'GET' }),
      fcamoApi('', { method:'GET' }).catch(() => ({ items:[] })),
    ]);
    TRK.notes = {}; data.notes.forEach(n => { TRK.notes[n.station_code] = n; });
    TRK.cands = {}; data.candidates.forEach(c => { (TRK.cands[c.station_code] = TRK.cands[c.station_code] || []).push(c); });
    TRK.fcamo = {};
    fc.items.forEach(f => {
      const cur = TRK.fcamo[f.station_code];
      if (!cur || (cur.status === 'completed' && f.status !== 'completed')) TRK.fcamo[f.station_code] = f;
    });
    TRK.loaded = true; TRK.error = null;
    trkSyncHome();
  } catch (err){
    if (err.status !== 401) TRK.error = err.message;
  }
  TRK.loading = false;
  if (TRK.active && !TRK.code) trkRender();
  else if (TRK.active && TRK.code) trkRenderDetail();
}

// ---------- lista de estaciones ----------
function trkPill(stage){ return `<span class="trk-pill trk-st-${stage}">${escHtml(trkStageLabel(stage))}</span>`; }

function trkRowHtml(it){
  const urg = trkUrgency(it.code, it.stage);
  const contacted = it.sum.contacted.length;
  return `<div class="trk-row ${urg ? 'u-' + urg : ''}" data-act="open" data-code="${it.code}" role="button" tabindex="0">
    <span class="trk-code">${it.code}</span>
    <div class="trk-row-main">
      <div class="trk-city">${escHtml(it.flight.city)}${it.flight.country ? ', ' + escHtml(it.flight.country) : ''}</div>
      <div class="trk-flight ${urg}">${escHtml(trkFlightText(it.flight))}</div>
    </div>
    <div class="trk-row-prov">
      <div><span class="trk-k">Contactados</span> ${contacted ? `<b>${contacted}</b>` : '<span class="trk-none">ninguno</span>'}</div>
      <div><span class="trk-k">Elegido</span> ${it.sum.chosen ? `<b>${escHtml(it.sum.chosen.name)}</b>` : '<span class="trk-none">sin elegir</span>'}</div>
    </div>
    ${trkPill(it.stage)}
  </div>`;
}

function trkRender(){
  const content = document.getElementById('trk-content');
  if (!content) return;
  const head = document.getElementById('trk-list-head');
  if (TRK.code){
    head.style.display = 'none';
    content.innerHTML = trkDetailHtml(TRK.code);
    return;
  }
  head.style.display = '';
  const c = trkCounts();
  const chip = (f, label, n) => `<button type="button" class="trk-chip ${TRK.filter === f ? 'on' : ''}" data-act="filter" data-filter="${f}">${label} <b>${n}</b></button>`;
  document.getElementById('trk-chips').innerHTML = chip('all', 'Todas', c.all) + chip('none', 'Sin gestionar', c.none) + chip('searching', 'En búsqueda', c.searching)
    + chip('selected', 'Proveedor elegido', c.selected) + chip('interim', 'Provisional', c.interim) + chip('covered', 'Cubiertas', c.covered);

  if (!TRK.loaded){
    content.innerHTML = TRK.error
      ? `<div class="trk-empty">No se ha podido cargar el seguimiento (${escHtml(TRK.error)}). <button type="button" class="trk-link" data-act="retry">Reintentar</button></div>`
      : '<div class="trk-empty">Cargando…</div>';
    return;
  }
  if (!uncoveredStationCodes().length){
    content.innerHTML = '<div class="trk-empty">No hay estaciones con vuelo y sin proveedor ahora mismo.</div>';
    return;
  }
  const items = trkVisibleItems();
  content.innerHTML = items.length
    ? '<div class="trk-list">' + items.map(trkRowHtml).join('') + '</div>'
    : '<div class="trk-empty">Ninguna estación coincide.</div>';
}

// ---------- estacion ----------
function trkProviderHtml(r){
  const state = r.cand ? trkCandState(r.cand.status) : 'identified';
  const chosen = state === 'selected';
  const ro = !canWrite();
  const contact = [r.email, r.phone].filter(Boolean).map(escHtml).join(' · ');
  const key = escHtml(r.name);
  return `<div class="trk-prov ${chosen ? 'is-chosen' : ''}">
    <div class="trk-prov-main">
      <div class="trk-prov-name">${escHtml(r.name)}${r.easa ? `<span class="trk-easa">EASA ${escHtml(r.easa)}</span>` : ''}${chosen ? '<span class="trk-tag">ELEGIDO</span>' : ''}</div>
      ${contact ? `<div class="trk-prov-contact">${contact}</div>` : (r.orphan ? '<div class="trk-prov-contact">Fuera del listado de proveedores no contratados</div>' : '')}
    </div>
    <label class="trk-contacted ${chosen ? 'is-locked' : ''}">
      <input type="checkbox" data-act="contacted" data-name="${key}" ${state !== 'identified' ? 'checked' : ''} ${(chosen || ro) ? 'disabled' : ''}>
      Contactado
    </label>
    ${ro ? '' : (chosen
      ? `<button type="button" class="trk-btn" data-act="unchoose" data-name="${key}">Quitar elección</button>`
      : `<button type="button" class="trk-btn choose" data-act="choose" data-name="${key}">Elegir</button>`)}
    ${!ro && r.orphan && r.cand ? `<button type="button" class="trk-x" data-act="remove" data-name="${key}" title="Quitar de la lista" aria-label="Quitar ${key} de la lista">✕</button>` : ''}
  </div>`;
}

function trkDetailHtml(code){
  const note = trkNote(code), stage = trkStageOf(code);
  const f = trkFlight(code);
  const sum = trkSummary(code);
  const rows = trkProviderRows(code);
  const fc = TRK.fcamo[code];
  const def = TRK_STAGES.find(s => s.v === stage);
  const contactedNames = sum.contacted.map(c => escHtml(c.name)).join(', ');
  const ro = !canWrite();            // consulta: solo ver
  const adm = isAdminRole();         // solo un administrador cierra o reabre una estacion ("Cubierta")

  return `
  <button type="button" class="trk-back" data-act="back">← Todas las estaciones</button>
  ${ro ? '<div class="trk-ro">Solo consulta: puedes ver el seguimiento, pero no modificarlo.</div>' : ''}
  <div class="trk-dhead">
    <span class="trk-code big">${code}</span>
    <div>
      <div class="trk-dcity">${escHtml(f.city)}${f.country ? ', ' + escHtml(f.country) : ''}</div>
      <div class="trk-flight ${trkUrgency(code, stage)}">${escHtml(trkFlightText(f))}${f.movements ? ` · ${f.movements.toLocaleString('es-ES')} movimientos` : ''}</div>
    </div>
  </div>

  <div class="trk-summary">
    <div><span class="trk-k">Estado</span>${trkPill(stage)}</div>
    <div><span class="trk-k">Contactados</span><b>${contactedNames || '<span class="trk-none">ninguno todavía</span>'}</b></div>
    <div><span class="trk-k">Elegido</span><b>${sum.chosen ? escHtml(sum.chosen.name) : '<span class="trk-none">ninguno todavía</span>'}</b></div>
  </div>

  <section class="trk-sec">
    <h3>Estado de la estación</h3>
    <div class="trk-seg-ctl" role="group" aria-label="Estado de la estación">
      ${TRK_STAGES.map(s => {
        const adminOnly = (s.v === 'covered' || stage === 'covered') && s.v !== stage; // cerrar o reabrir
        const blocked = ro || (adminOnly && !adm);
        const why = ro ? 'Solo consulta' : (blocked ? 'Solo los administradores pueden cerrar o reabrir una estación' : '');
        return `<button type="button" class="trk-st-${s.v} ${s.v === stage ? 'on' : ''}" data-act="stage" data-v="${s.v}" ${blocked ? `disabled title="${why}"` : ''}>${escHtml(s.label)}</button>`;
      }).join('')}
    </div>
    <p class="trk-hint">${escHtml(def.hint)} <span>${ro ? '' : (adm ? 'Cambia solo al marcar contactados o elegir; «Provisional» y «Cubierta» las marcas tú.' : 'Cambia solo al marcar contactados o elegir; «Provisional» la marcas tú y «Cubierta» la marca un administrador.')}</span></p>
  </section>

  <section class="trk-sec">
    <h3>Proveedores que pueden cubrirla <span class="trk-count">${rows.length}</span></h3>
    ${rows.length ? rows.map(trkProviderHtml).join('') : '<div class="trk-empty small">No hay proveedores en el listado para esta estación. Puedes apuntar uno abajo.</div>'}
    ${ro ? '' : `<div class="trk-add">
      <input type="text" id="trk-add-name" data-keep placeholder="¿Otro proveedor que pueda cubrirla? Escribe su nombre…" maxlength="120" autocomplete="off">
      <button type="button" class="trk-btn primary" data-act="add">Añadir</button>
    </div>`}
  </section>

  <section class="trk-sec">
    <h3>Notas</h3>
    <textarea id="trk-note" data-keep rows="4" maxlength="2000" ${ro ? 'readonly' : ''} placeholder="${ro ? '' : 'Cualquier cosa que convenga recordar de esta estación…'}">${escHtml(note.note || '')}</textarea>
    <div class="trk-btnrow">${ro ? '' : '<button type="button" class="trk-btn primary" data-act="save-note">Guardar notas</button>'}
      <span class="trk-updated">${note.updated_at ? `Última actualización ${timeAgo(note.updated_at)} · ${escHtml(trkWho(note.updated_by))}` : ''}</span></div>
  </section>

  ${fc ? `<section class="trk-sec"><h3>F-CAMO-IBE-14</h3>
    <button type="button" class="trk-fcamo" data-act="fcamo-open" data-id="${fc.id}">📋 ${fc.status === 'completed' ? 'Completado' : 'Abierto'} para esta estación (${fcamoProgress(fc).done}/${fcamoProgress(fc).total}) →</button></section>` : ''}`;
}

function trkRenderDetail(){
  const content = document.getElementById('trk-content');
  if (!content || !TRK.code) return;
  const keep = [...content.querySelectorAll('[data-keep]')].map(n => ({ id:n.id, v:n.value, f:n === document.activeElement }));
  const view = document.getElementById('tracking-view');
  const scroll = view.scrollTop;
  content.innerHTML = trkDetailHtml(TRK.code);
  keep.forEach(k => { const n = document.getElementById(k.id); if (n){ n.value = k.v; if (k.f) n.focus(); } });
  view.scrollTop = scroll;
}

// ---------- navegacion (la URL guarda la estacion: #seguimiento/ABC) ----------
function trkOpen(code){ location.hash = '#seguimiento/' + code; }
function trkClose(){ location.hash = '#seguimiento'; }

function trkEnter(code){
  if (!TRK.active){
    TRK.active = true;
    trkLoad();
    TRK.timer = setInterval(() => { if (TRK.active && !TRK.code && !document.hidden) trkLoad(); }, 60000);
  }
  if (code && !STATIONS.some(s => s.code === code)){
    trkToast('Esa estación no existe', true);
    history.replaceState(null, '', '#seguimiento');
    code = null;
  }
  TRK.code = code || null;
  document.getElementById('tracking-view').scrollTop = 0;
  trkRender();
}
function trkLeave(){
  TRK.active = false;
  TRK.code = null;
  clearInterval(TRK.timer); TRK.timer = null;
}

// aplica un cambio en el servidor y repinta
function trkApply(code, snap){
  if (snap.note) TRK.notes[code] = snap.note;
  if (snap.candidates) TRK.cands[code] = snap.candidates;
  trkSyncHome();
}
async function trkMutate(code, fn, okMsg){
  try {
    const snap = await fn();
    trkApply(code, snap);
    if (okMsg) trkToast(okMsg);
    if (TRK.code === code) trkRenderDetail(); else if (TRK.active) trkRender();
    return snap;
  } catch (err){
    if (err.status !== 401) trkToast(err.message, true);
    if (TRK.code === code) trkRenderDetail();
    return null;
  }
}
const trkCandOf = (code, name) => (TRK.cands[code] || []).find(c => c.provider_name.trim().toLowerCase() === name.trim().toLowerCase());
// pone a un proveedor en un estado, creandolo si todavia no estaba apuntado
function trkSetProvider(code, name, status){
  const cand = trkCandOf(code, name);
  return trkMutate(code, async () => {
    const snap = cand
      ? await trkApi(`/candidates/${cand.id}`, { method:'PATCH', body: JSON.stringify({ status }) })
      : await trkApi(`/${code}/candidates`, { method:'POST', body: JSON.stringify({ provider_name:name, status }) });
    if (status === 'selected'){
      trkToast(snap.replaced && snap.replaced.length ? `${name} elegido (sustituye a ${snap.replaced.join(', ')})` : `${name} elegido`);
    }
    return snap;
  });
}

// ---------- eventos ----------
(function trkWire(){
  const root = document.getElementById('tracking-view');
  if (!root) return;

  document.getElementById('trk-back-home').addEventListener('click', () => goHome());
  document.getElementById('trk-search').addEventListener('input', e => { TRK.q = e.target.value; trkRender(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && TRK.active && TRK.code && !document.querySelector('.modal-overlay.open')) trkClose();
  });

  root.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const act = el.dataset.act, code = TRK.code;
    if (act === 'filter'){ TRK.filter = (TRK.filter === el.dataset.filter) ? 'all' : el.dataset.filter; trkRender(); return; }
    if (act === 'retry'){ trkLoad(); return; }
    if (act === 'open'){ trkOpen(el.dataset.code); return; }
    if (act === 'back'){ trkClose(); return; }
    if (act === 'fcamo-open'){ openFcamoDetailById(parseInt(el.dataset.id, 10)); return; }
    if (!code) return;
    if (!canWrite()){ trkToast('Tu usuario es de solo consulta.', true); return; }

    if (act === 'stage'){
      const v = el.dataset.v;
      if (v === trkStageOf(code)) return;
      if ((v === 'covered' || trkStageOf(code) === 'covered') && !isAdminRole()){ trkToast('Solo los administradores pueden cerrar o reabrir una estación.', true); return; }
      if (v === 'covered' && !confirm(`¿Marcar ${code} como cubierta? Saldrá de la lista (podrás verla en el filtro «Cubiertas»).`)) return;
      trkMutate(code, () => trkApi(`/${code}`, { method:'PATCH', body: JSON.stringify({ stage:v }) }));
    } else if (act === 'choose'){
      trkSetProvider(code, el.dataset.name, 'selected');
    } else if (act === 'unchoose'){
      trkSetProvider(code, el.dataset.name, 'contacted');
    } else if (act === 'remove'){
      const c = trkCandOf(code, el.dataset.name);
      if (!c || !confirm(`¿Quitar a ${c.provider_name} de la lista de ${code}?`)) return;
      trkMutate(code, () => trkApi(`/candidates/${c.id}`, { method:'DELETE' }), 'Proveedor quitado');
    } else if (act === 'add'){
      const input = document.getElementById('trk-add-name');
      const name = input.value.trim();
      if (!name){ trkToast('Escribe el nombre del proveedor', true); input.focus(); return; }
      if (trkCandOf(code, name) || trkSuggestions(code).some(s => s.name.toLowerCase() === name.toLowerCase())){
        trkToast('Ese proveedor ya está en la lista', true); return;
      }
      trkMutate(code, () => trkApi(`/${code}/candidates`, { method:'POST', body: JSON.stringify({ provider_name:name }) }), 'Proveedor añadido a esta estación')
        .then(snap => { if (snap){ const n = document.getElementById('trk-add-name'); if (n){ n.value = ''; n.focus(); } } });
    } else if (act === 'save-note'){
      const text = document.getElementById('trk-note').value;
      trkMutate(code, () => trkApi(`/${code}`, { method:'PATCH', body: JSON.stringify({ note:text }) }), 'Notas guardadas');
    }
  });

  root.addEventListener('change', e => {
    const el = e.target.closest('input[data-act="contacted"]');
    if (!el || !TRK.code) return;
    if (!canWrite()){ el.checked = !el.checked; return; }
    trkSetProvider(TRK.code, el.dataset.name, el.checked ? 'contacted' : 'identified');
  });

  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('[data-act="open"]')){ e.preventDefault(); trkOpen(e.target.dataset.code); }
    else if (e.key === 'Enter' && e.target.id === 'trk-add-name'){ e.preventDefault(); root.querySelector('[data-act="add"]').click(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && TRK.active && !TRK.code) trkLoad(); });
})();
// ==== SEGUIMIENTO: FIN ====

// ---- actividad reciente: notas + F-CAMO combinados ----
const activityOverlay = document.getElementById('activity-overlay');
const activityBody = document.getElementById('activity-body');
document.getElementById('open-activity-overview').addEventListener('click', openActivityOverview);
document.getElementById('btn-close-activity').addEventListener('click', () => activityOverlay.classList.remove('open'));
activityOverlay.addEventListener('click', (e) => { if (e.target === activityOverlay) activityOverlay.classList.remove('open'); });

const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const ICON_FCAMO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg>';

function activityText(entry){
  if (entry.type === 'note'){
    if (entry.action === 'covered'){
      return `<b>${escHtml(entry.changed_by)}</b> marcó <b>${escHtml(entry.station_code)}</b> como ${entry.value === 'true' ? 'cubierta' : 'pendiente'}`;
    }
    const who = `<b>${escHtml(entry.changed_by)}</b>`, st = `<b>${escHtml(entry.station_code)}</b>`;
    const val = String(entry.value || '');
    const cut = (t, n) => escHtml(t.length > n ? t.slice(0, n) + '…' : t);
    const split = v => { const k = v.lastIndexOf('|'); return k < 0 ? [v, ''] : [v.slice(0, k), v.slice(k + 1)]; };
    switch (entry.action){
      case 'stage': return `${who} cambió la situación de ${st} a <b>${escHtml(trkStageLabel(trkNormStage(val)))}</b>`;
      case 'log': return `${who} añadió a la bitácora de ${st}: "${cut(val, 90)}"`;
      case 'cand_add': return `${who} añadió a <b>${escHtml(val)}</b> como proveedor candidato en ${st}`;
      case 'cand_status': { const [n, s] = split(val); return `${who} movió a <b>${escHtml(n)}</b> a «${escHtml(trkCandLabel(s))}» en ${st}`; }
      case 'cand_edit': return `${who} editó los datos de <b>${escHtml(val)}</b> en ${st}`;
      case 'cand_remove': return `${who} quitó a <b>${escHtml(val)}</b> de la lista de ${st}`;
      case 'next_action': return `${who} actualizó la próxima acción de ${st}`;
      case 'candidate_provider': return `${who} ${val ? 'propuso como candidato a <b>' + escHtml(val) + '</b> en' : 'quitó el proveedor candidato de'} ${st}`;
    }
    return `${who} escribió una nota en ${st}: "${cut(val, 90)}"`;
  }
  const labels = { created:'abrió un F-CAMO-IBE-14 para', completed:'completó el checklist de', reopened:'reabrió el checklist de', deleted:'eliminó el F-CAMO-IBE-14 de', restored:'restauró el F-CAMO-IBE-14 de' };
  return `<b>${escHtml(entry.changed_by)}</b> ${escHtml(labels[entry.action] || entry.action)} <b>${escHtml(entry.station_code)}</b>`;
}

async function openActivityOverview(){
  activityBody.innerHTML = '<div class="no-data">Cargando…</div>';
  activityOverlay.classList.add('open');
  try {
    const token = localStorage.getItem(AUTH_KEY);
    const res = await fetch(`${AUTH_API_URL}/api/activity`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error de conexión');
    if (!data.items.length){
      activityBody.innerHTML = '<div class="no-data">Todavía no hay actividad registrada.</div>';
      return;
    }
    activityBody.innerHTML = data.items.map(entry => `
      <div class="activity-item">
        <span class="activity-icon ${entry.type === 'note' ? 'is-note' : 'is-fcamo'}">${entry.type === 'note' ? ICON_NOTE : ICON_FCAMO}</span>
        <span>
          <div class="activity-text">${activityText(entry)}</div>
          <div class="activity-time">${timeAgo(entry.changed_at)}</div>
        </span>
      </div>`).join('');
  } catch (err){
    activityBody.innerHTML = `<div class="no-data">No se ha podido conectar con el servidor (${err.message}).</div>`;
  }
}

// ---- gestion de usuarios (solo visible/operativo para admin; el Worker
// vuelve a comprobar is_admin en cada llamada, esto es solo la interfaz) ----
const usersOverlay = document.getElementById('users-overlay');
const usersBody = document.getElementById('users-body');
const btnNewUser = document.getElementById('btn-new-user');
const btnCloseUsers = document.getElementById('btn-close-users');
document.getElementById('open-users-panel').addEventListener('click', openUsersPanel);
btnCloseUsers.addEventListener('click', () => usersOverlay.classList.remove('open'));
usersOverlay.addEventListener('click', (e) => { if (e.target === usersOverlay) usersOverlay.classList.remove('open'); });
btnNewUser.addEventListener('click', renderNewUserForm);
const btnUsersAudit = document.getElementById('btn-users-audit');
btnUsersAudit.addEventListener('click', openUsersAudit);

function escHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const ROLE_LABELS = { admin:'Administrador', user:'Usuario', viewer:'Consulta' };
const roleName = r => ROLE_LABELS[r] || 'Usuario';

const AUDIT_TEXT = {
  created:                 (t, d) => `dio de alta a <b>${t}</b>${ROLE_LABELS[d] ? ' con el rol <b>' + ROLE_LABELS[d] + '</b>' : ''}`,
  role_changed:            (t, d) => { const [from, to] = String(d || '').split('>'); return `cambió el rol de <b>${t}</b>${ROLE_LABELS[from] ? ' de ' + ROLE_LABELS[from] : ''} a <b>${roleName(to)}</b>`; },
  made_admin:              t => `dio permisos de administrador a <b>${t}</b>`,
  removed_admin:           t => `quitó los permisos de administrador a <b>${t}</b>`,
  badge_on:                t => `activó el aviso de datos a <b>${t}</b>`,
  badge_off:               t => `desactivó el aviso de datos a <b>${t}</b>`,
  password_reset_by_admin: t => `reseteó la contraseña de <b>${t}</b>`,
  deleted:                 t => `eliminó la cuenta de <b>${t}</b>`,
  password_changed:        (t, d) => `cambió su contraseña${d === 'tras contraseña temporal' ? ' (tras la temporal)' : ''}`,
  login_locked:            t => `bloqueó el acceso de <b>${t}</b> 15 min por demasiados intentos fallidos`,
};

async function openUsersAudit(){
  btnNewUser.style.display = 'none';
  btnUsersAudit.style.display = 'none';
  usersBody.innerHTML = '<div class="no-data">Cargando…</div>';
  try {
    const { items } = await usersApi('/audit', { method: 'GET' });
    const rows = items.length ? items.map(a => {
      const fn = AUDIT_TEXT[a.action];
      const who = a.changed_by === 'sistema' ? 'El sistema' : `<b>${escHtml(a.changed_by)}</b>`;
      const text = fn ? fn(escHtml(a.target_email), a.detail) : `${escHtml(a.action)} · <b>${escHtml(a.target_email)}</b>`;
      return `<div class="activity-item"><div class="activity-text">${who} ${text}</div><div class="activity-time">${timeAgo(a.changed_at)}</div></div>`;
    }).join('') : '<div class="no-data">Todavía no hay cambios registrados.</div>';
    usersBody.innerHTML = `
      <button class="fcamo-back" id="users-audit-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Todos los usuarios</button>
      <div class="fcamo-detail-title" style="margin-bottom:14px;">Historial de gestión de usuarios</div>
      ${rows}`;
    document.getElementById('users-audit-back').addEventListener('click', openUsersPanel);
  } catch (err){
    usersBody.innerHTML = `<div class="no-data">No se ha podido cargar (${escHtml(err.message)}).</div>`;
  }
}

async function usersApi(path, options){
  const token = localStorage.getItem(AUTH_KEY);
  const res = await fetch(`${AUTH_API_URL}/api/admin-users${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(options && options.headers) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de conexión');
  return data;
}

async function openUsersPanel(){
  btnNewUser.style.display = '';
  btnUsersAudit.style.display = '';
  usersBody.innerHTML = '<div class="no-data">Cargando…</div>';
  usersOverlay.classList.add('open');
  try {
    const { items } = await usersApi('', { method: 'GET' });
    renderUsersListView(items);
  } catch (err){
    usersBody.innerHTML = `<div class="no-data">No se ha podido conectar con el servidor (${err.message}).</div>`;
  }
}

function renderUsersListView(items){
  btnNewUser.style.display = '';
  btnUsersAudit.style.display = '';
  const me = localStorage.getItem(AUTH_EMAIL_KEY) || '';
  usersBody.innerHTML = items.map(u => `
    <div class="fcamo-list-item" style="cursor:default;flex-wrap:wrap;gap:10px 18px;">
      <span class="fcamo-list-code" style="min-width:200px;">${escHtml(u.email)}${u.email === me ? ' <span style="font-weight:500;color:var(--muted-2);font-size:11px;">(tú)</span>' : ''}</span>
      <span class="fcamo-list-meta" style="flex:1;">
        <div class="fcamo-list-sub">Alta ${new Date(u.created_at * 1000).toLocaleDateString('es-ES')}${u.updated_at ? ' · última actualización ' + timeAgo(u.updated_at) : ''}${u.must_change_password ? ' · <b style="color:var(--amber);">pendiente de elegir contraseña</b>' : ''}</div>
      </span>
      <select class="user-role-select" data-email="${escHtml(u.email)}" aria-label="Rol de ${escHtml(u.email)}" ${u.email === me ? 'disabled title="No puedes cambiar tu propio rol"' : ''} style="padding:7px 9px;border:1px solid var(--line);border-radius:var(--radius-sm);font:600 12px 'IBM Plex Sans',sans-serif;background:var(--surface);color:var(--ink);">
        ${['admin', 'user', 'viewer'].map(r => `<option value="${r}" ${(u.role || (u.is_admin ? 'admin' : 'user')) === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('')}
      </select>
      <label class="switch-row" style="margin:0;width:auto;">
        <span class="switch"><input type="checkbox" class="user-toggle-badge" data-email="${escHtml(u.email)}" ${u.show_data_badge ? 'checked' : ''}><span class="track"></span><span class="thumb"></span></span>
        <span class="label-text">Aviso datos</span>
      </label>
      <button type="button" class="ov-see-all user-reset-btn" data-email="${escHtml(u.email)}" ${u.email === me ? 'disabled title="Para cambiar tu contraseña usa el botón «Contraseña» de la cabecera" style="margin:0;opacity:.35;cursor:not-allowed;"' : 'style="margin:0;"'}>Resetear contraseña</button>
      <button type="button" class="fcamo-delete-btn user-delete-btn" data-email="${escHtml(u.email)}" ${u.email === me ? 'disabled style="opacity:.35;cursor:not-allowed;"' : ''}>Eliminar</button>
    </div>`).join('');

  usersBody.querySelectorAll('.user-role-select').forEach(sel => {
    const previous = sel.value;
    sel.addEventListener('change', async () => {
      try {
        await usersApi(`/${encodeURIComponent(sel.dataset.email)}`, { method:'PATCH', body: JSON.stringify({ role: sel.value }) });
        openUsersPanel(); // se recarga la lista para mostrar lo que ha guardado el servidor
      } catch (err){
        sel.value = previous;
        alert('No se ha podido cambiar el rol: ' + err.message);
      }
    });
  });
  usersBody.querySelectorAll('.user-toggle-badge').forEach(cb => {
    cb.addEventListener('change', async () => {
      const wasChecked = !cb.checked;
      try {
        await usersApi(`/${encodeURIComponent(cb.dataset.email)}`, { method:'PATCH', body: JSON.stringify({ show_data_badge: cb.checked }) });
      } catch (err){
        cb.checked = wasChecked;
        alert('No se ha podido cambiar: ' + err.message);
      }
    });
  });
  usersBody.querySelectorAll('.user-reset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`¿Generar una contraseña temporal nueva para ${btn.dataset.email}? La anterior dejará de funcionar.`)) return;
      try {
        const { temp_password } = await usersApi(`/${encodeURIComponent(btn.dataset.email)}`, { method:'PATCH', body: JSON.stringify({ reset_password: true }) });
        prompt(`Contraseña temporal para ${btn.dataset.email}. Cópiala y pásasela: no se volverá a mostrar. Al entrar tendrá que elegir una propia, y sus sesiones abiertas se han cerrado.`, temp_password);
      } catch (err){
        alert('No se ha podido resetear: ' + err.message);
      }
    });
  });
  usersBody.querySelectorAll('.user-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      if (!confirm(`¿Eliminar la cuenta ${btn.dataset.email}? No se puede deshacer.`)) return;
      try {
        await usersApi(`/${encodeURIComponent(btn.dataset.email)}`, { method:'DELETE' });
        const { items } = await usersApi('', { method: 'GET' });
        renderUsersListView(items);
      } catch (err){
        alert('No se ha podido eliminar: ' + err.message);
      }
    });
  });
}

function renderNewUserForm(){
  btnNewUser.style.display = 'none';
  btnUsersAudit.style.display = 'none';
  usersBody.innerHTML = `
    <button class="fcamo-back" id="user-form-back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Todos los usuarios</button>
    <div class="fcamo-detail-title" style="margin-bottom:18px;">Nuevo usuario</div>
    <div class="fcamo-form-grid">
      <div class="fcamo-form-field"><label>Email @iberia.es</label><input type="text" id="user-f-email" placeholder="nombre.apellido@iberia.es"></div>
    </div>
    <div class="fcamo-form-grid">
      <div class="fcamo-form-field"><label>Rol</label>
        <select id="user-f-role">
          <option value="user">Usuario — trabajo diario: F-CAMO y seguimiento</option>
          <option value="viewer">Consulta — puede verlo todo, no modificar nada</option>
          <option value="admin">Administrador — además gestiona usuarios y datos</option>
        </select>
      </div>
    </div>
    <label class="fcamo-checkrow"><input type="checkbox" id="user-f-badge">Ve el aviso de "datos actualizados"</label>
    <button class="login-btn" id="user-f-submit" style="margin-top:20px;width:auto;padding:11px 22px;">Crear usuario</button>
  `;
  document.getElementById('user-form-back').addEventListener('click', openUsersPanel);
  document.getElementById('user-f-submit').addEventListener('click', async () => {
    const emailVal = document.getElementById('user-f-email').value.trim().toLowerCase();
    const role = document.getElementById('user-f-role').value;
    const show_data_badge = document.getElementById('user-f-badge').checked;
    try {
      const { temp_password } = await usersApi('', { method:'POST', body: JSON.stringify({ email: emailVal, role, show_data_badge }) });
      alert(`Usuario creado. Contraseña temporal para ${emailVal} (cópiala y pásasela; no se volverá a mostrar). Al entrar tendrá que elegir una propia:\n\n${temp_password}`);
      openUsersPanel();
    } catch (err){
      alert('No se ha podido crear: ' + err.message);
    }
  });
}

// ---- pagina de inicio: contadores y resumenes de cada tarjeta ----
function renderHomeStats(){
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const hd = window.homeData;

  set('home-c-contracted', allProviders.length);
  set('home-s-contracted', `${STATIONS.filter(s => s.in_schedule).length} estaciones con vuelo IB 26/27`);
  set('home-c-alt', allAltProviders.length);
  set('home-s-alt', `${ALT_STATIONS.length} estaciones con alternativas`);

  const per = STATIONS.filter(s => s.pernocta);
  const perSin = per.filter(s => s.pending).length;
  set('home-c-pernocta', per.length);
  set('home-s-pernocta', perSin ? `${perSin} sin proveedor contratado` : 'Todas con proveedor');

  if (hd.fcamo){
    const pending = hd.fcamo.filter(i => i.status !== 'completed').length;
    const done = hd.fcamo.length - pending;
    set('home-c-fcamo', pending);
    set('home-s-fcamo', hd.fcamo.length ? `${done} completados · ${pending} pendientes` : 'Ninguno abierto todavía');
  }

  if (hd.notes){
    const byCode = {};
    hd.notes.forEach(n => { byCode[n.station_code] = n; });
    const pend = uncoveredStationCodes().filter(c => !(byCode[c] && byCode[c].covered));
    const cnt = { none:0, searching:0, selected:0, interim:0 };
    pend.forEach(c => {
      const n = byCode[c];
      const st = trkNormStage(n && n.stage);
      if (st in cnt) cnt[st]++;
    });
    const labels = { none:'sin gestionar', searching:'en búsqueda', selected:'con proveedor elegido', interim:'provisional' };
    const parts = Object.keys(cnt).filter(k => cnt[k] > 0).map(k => `${cnt[k]} ${labels[k]}`);
    set('home-c-uncov', pend.length);
    set('home-s-uncov', pend.length ? parts.join(' · ') : 'Todas las estaciones cubiertas');
  }

  if (hd.users){
    const count = r => hd.users.filter(u => (u.role || (u.is_admin ? 'admin' : 'user')) === r).length;
    const admins = count('admin'), viewers = count('viewer');
    set('home-c-users', hd.users.length);
    set('home-s-users', `${admins} administrador${admins === 1 ? '' : 'es'}` + (viewers ? ` · ${viewers} de consulta` : ''));
  }

  if (hd.activity){
    const now = Math.floor(Date.now() / 1000);
    const n24 = hd.activity.filter(a => now - a.changed_at < 86400).length;
    set('home-c-activity', (n24 >= 50) ? '50+' : n24);
    set('home-s-activity', hd.activity.length ? `cambios en 24 h · último ${timeAgo(hd.activity[0].changed_at)}` : 'Sin actividad registrada');
  }
}

// vuelve a pedir los datos de las tarjetas cada vez que se entra en el inicio
async function refreshHomeExtras(){
  const tasks = [refreshFcamoBadge(), refreshUncoveredBadge()];
  tasks.push(
    fetch(`${AUTH_API_URL}/api/activity`, { headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_KEY)}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d){ window.homeData.activity = d.items; renderHomeStats(); } })
      .catch(() => {})
  );
  if (isAdminRole()){
    tasks.push(
      usersApi('', { method: 'GET' })
        .then(d => { window.homeData.users = d.items; renderHomeStats(); })
        .catch(() => {})
    );
  }
  await Promise.all(tasks);
}

// ---- Excel export: replica exacta de la macro V18 ----
// (hoja de listado con cabecera roja Iberia + logo, calendarios
//  mensuales con el vuelo en la celda del dia, mismos colores)
const IB_RED = 'FFC8102E';
const IB_DARK = 'FF231F20';
const IB_LGRAY = 'FFF5F5F5';
const IB_WHITE = 'FFFFFFFF';
const CAL_BLUE = 'FFEFF6FF';

function parseDateStr(d){
  // d = "15/SEP/2026"
  const [dd, mon, yyyy] = d.split('/');
  const m = MESES.indexOf(mon);
  return new Date(Date.UTC(parseInt(yyyy), m, parseInt(dd)));
}
function timeFrac(hhmm){
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60 + m) / 1440;
}
function thinBlack(){ return { style:'thin', color:{argb:'FF000000'} }; }
function medBlack(){ return { style:'medium', color:{argb:'FF000000'} }; }

btnDownload.addEventListener('click', async () => {
  if (!currentSchedStation) return;
  const s = currentSchedStation;
  btnDownload.disabled = true;
  const originalLabel = btnDownload.innerHTML;
  btnDownload.textContent = 'Generando…';
  try {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();

    // logo en base64, reutilizado de la cabecera de la pagina
    const logoSrc = document.querySelector('.logo').src;
    const logoBase64 = logoSrc.split(',')[1];
    const logoId = wb.addImage({ base64: logoBase64, extension: 'png' });

    // =========================================================
    // HOJA 1: LISTADO
    // =========================================================
    const headers = ['DATE','FREQ','FLT NUMBER','ORIGIN','DEPT TERMINAL','DEPT TIME','DESTINATION','DEST TERMINAL','ARRIVAL TIME','SUBFLEET'];
    const sheetName = `IBERIA ${s.code} SCHEDULE`.slice(0, 31);
    const ws = wb.addWorksheet(sheetName, { views: [{ state:'frozen', xSplit:0, ySplit:2, zoomScale:90 }] });

    ws.columns = [
      { width: 14.63 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 },
      { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 },
    ];

    ws.mergeCells('A1:J1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `IBERIA FLIGHT SCHEDULE  -  ${s.code}  |  UTC TIMES`;
    titleCell.font = { name:'Calibri', bold:true, size:13, color:{argb:IB_WHITE} };
    titleCell.alignment = { horizontal:'center', vertical:'middle' };
    for (let c = 1; c <= 10; c++) ws.getRow(1).getCell(c).fill = { type:'pattern', pattern:'solid', fgColor:{argb:IB_RED} };
    ws.getRow(1).height = 28;

    ws.addImage(logoId, { tl:{ col:0.05, row:0.08 }, ext:{ width:126, height:29 } });

    const headerRow = ws.getRow(2);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name:'Calibri', bold:true, size:10, color:{argb:IB_WHITE} };
      cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:IB_DARK} };
      cell.alignment = { horizontal:'center', vertical:'middle' };
    });
    headerRow.height = 20;

    s.schedule.forEach((r, i) => {
      const [date, freq, flt, origin, deptTerm, deptTime, dest, destTerm, arrTime, subfleet] = r;
      const row = ws.getRow(i + 3);
      const rowBg = (i % 2 === 0) ? IB_WHITE : IB_LGRAY;
      const values = [parseDateStr(date), freq, flt, origin, deptTerm, timeFrac(deptTime), dest, destTerm, timeFrac(arrTime), subfleet];
      values.forEach((v, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = v;
        cell.font = { name:'Calibri', size:11 };
        cell.alignment = { horizontal:'center', vertical:'middle' };
        const isSubfleet = ci === 9;
        const bg = isSubfleet ? (SUBFLEET_COLOR[subfleet] ? 'FF'+SUBFLEET_COLOR[subfleet] : rowBg) : rowBg;
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
        if (ci === 0) cell.numFmt = 'dd/mmm/yyyy';
        if (ci === 5 || ci === 8) cell.numFmt = 'h:mm';
      });
    });

    // bordes: medio en el contorno, fino entre celdas
    const lastRow = s.schedule.length + 2;
    for (let R = 1; R <= lastRow; R++){
      for (let C = 1; C <= 10; C++){
        const cell = ws.getRow(R).getCell(C);
        cell.border = {
          top:    R === 1 ? medBlack() : thinBlack(),
          bottom: R === lastRow ? medBlack() : thinBlack(),
          left:   C === 1 ? medBlack() : thinBlack(),
          right:  C === 10 ? medBlack() : thinBlack(),
        };
      }
    }

    // =========================================================
    // HOJAS: CALENDARIOS MENSUALES
    // =========================================================
    const byMonth = new Map();
    s.schedule.forEach(r => {
      const [dd, mon, yyyy] = r[0].split('/');
      const key = `${mon}-${yyyy}`;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(r);
    });
    const monthKeysSorted = [...byMonth.keys()].sort((a, b) => {
      const [ma, ya] = a.split('-'); const [mb, yb] = b.split('-');
      return (parseInt(ya) - parseInt(yb)) || (MESES.indexOf(ma) - MESES.indexOf(mb));
    });

    monthKeysSorted.forEach(key => {
      const [mon, yyyy] = key.split('-');
      const monIdx = MESES.indexOf(mon);
      const year = parseInt(yyyy);
      const wsCal = wb.addWorksheet(key, { views: [{ zoomScale:65 }] });
      wsCal.columns = Array(7).fill({ width: 45 });

      wsCal.mergeCells('A1:G1');
      const t = wsCal.getCell('A1');
      t.value = `${mon}-${yyyy}`;
      t.font = { name:'Calibri', bold:true, size:16, color:{argb:IB_WHITE} };
      t.alignment = { horizontal:'center', vertical:'middle' };
      for (let c = 1; c <= 7; c++) wsCal.getRow(1).getCell(c).fill = { type:'pattern', pattern:'solid', fgColor:{argb:IB_RED} };
      wsCal.getRow(1).height = 26;

      const dayNames = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
      dayNames.forEach((d, i) => {
        const cell = wsCal.getRow(2).getCell(i + 1);
        cell.value = d;
        cell.font = { name:'Calibri', bold:true, size:10, color:{argb:IB_WHITE} };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:IB_DARK} };
        cell.alignment = { horizontal:'center', vertical:'middle' };
      });
      wsCal.getRow(2).height = 18;

      const firstOfMonth = new Date(Date.UTC(year, monIdx, 1));
      const daysInMonth = new Date(Date.UTC(year, monIdx + 1, 0)).getUTCDate();
      const firstWeekdayMon = (firstOfMonth.getUTCDay() + 6) % 7; // 0=Mon..6=Sun

      const flightsByDay = new Map();
      byMonth.get(key).forEach(r => {
        const day = parseInt(r[0].split('/')[0]);
        if (!flightsByDay.has(day)) flightsByDay.set(day, []);
        flightsByDay.get(day).push(r);
      });

      const lastSlot = firstWeekdayMon + daysInMonth;
      const numCalRows = Math.ceil(lastSlot / 7);
      const maxFlightsPerRow = Array(numCalRows).fill(0);
      for (let d = 1; d <= daysInMonth; d++){
        const slot = firstWeekdayMon + d - 1;
        const rIdx = Math.floor(slot / 7) + 3;
        const cIdx = (slot % 7) + 1;
        const cell = wsCal.getRow(rIdx).getCell(cIdx);
        const flights = flightsByDay.get(d) || [];
        maxFlightsPerRow[rIdx - 3] = Math.max(maxFlightsPerRow[rIdx - 3], flights.length);
        const richText = [{ font:{name:'Calibri', bold:true, size:13, color:{argb:IB_RED}}, text: String(d) }];
        flights.forEach(f => {
          const [, , flt, origin, , deptTime, dest, , arrTime, subfleet] = f;
          richText.push({ font:{name:'Calibri', size:10, color:{argb:IB_DARK}}, text: `\n${flt} ${origin} ${deptTime} ${dest} ${arrTime} ${subfleet}` });
        });
        cell.value = { richText };
        cell.alignment = { horizontal:'left', vertical:'top', wrapText:true };
        cell.border = { top:thinBlack(), bottom:thinBlack(), left:thinBlack(), right:thinBlack() };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb: flights.length ? CAL_BLUE : IB_WHITE} };
      }
      // altura dinamica por fila: suficiente para el dia con mas vuelos de esa semana,
      // con un minimo de 60 (dias sin vuelos ocupan menos que antes)
      for (let r = 3; r <= numCalRows + 2; r++){
        const lines = 1 + maxFlightsPerRow[r - 3]; // linea del numero de dia + una por vuelo
        wsCal.getRow(r).height = Math.max(60, 18 + lines * 13);
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Iberia Flight Schedule - ${s.code}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err){
    console.error(err);
    alert('No se ha podido generar el Excel: ' + err.message);
  } finally {
    btnDownload.disabled = false;
    btnDownload.innerHTML = originalLabel;
  }
});

// lo que main.js necesita de esta parte (rutas, cambio de rol, avisos)
Object.assign(app, { switchMode, TRK, trkToast, trkRender, trkEnter, trkLeave, renderHomeStats, refreshHomeExtras });
