// fuentes servidas desde el propio dominio (sin Google Fonts); solo latin y latin-ext
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-ext-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-ext-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-sans/latin-ext-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-ext-600.css';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { setAppData } from './data.js';

// ---- acceso ----
// Marca de version: la pone Vite en cada build (ver vite.config.js), que ademas
// publica /version.json con el mismo valor para que las pestañas abiertas
// detecten que hay una version mas reciente.
const APP_BUILD = __APP_BUILD__;

// Funciones de la parte B (mapa, seguimiento...) que se registran aqui cuando
// se carga tras el login; hasta entonces el objeto esta vacio.
export const app = {};

// ---- aviso de version nueva disponible ----
// Cada pocos minutos pide /version.json (sin cache) y compara su build con
// el de la version cargada; si son distintos, se ha publicado una version
// mas reciente y avisamos para que se recargue.
const updateBanner = document.getElementById('update-banner');
document.getElementById('update-reload-btn').addEventListener('click', () => window.location.reload());
document.getElementById('update-dismiss-btn').addEventListener('click', () => updateBanner.classList.remove('open'));

async function checkForNewVersion(){
  try {
    const res = await fetch('/version.json?_=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json();
    if (build && build !== APP_BUILD){
      updateBanner.classList.add('open');
    }
  } catch (e){ /* sin red o pagina no accesible: no hacemos nada */ }
}
setInterval(checkForNewVersion, 5 * 60 * 1000); // cada 5 minutos
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForNewVersion();
});

// URL del Worker (API). Se puede cambiar por entorno con VITE_API_URL (ver README.md).
export const AUTH_API_URL = (import.meta.env.VITE_API_URL || 'https://control-estaciones-auth.victorjjm5.workers.dev').replace(/\/+$/, '');
window.homeData = {};

// Si el Worker responde 401 con la app abierta (cuenta dada de baja o token
// caducado), se cierra la sesion y se vuelve al login en vez de dejar la app rota.
// Se excluyen las rutas de login/reset, donde un 401 es una respuesta normal.
const _origFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const res = await _origFetch(input, init);
  try {
    const url = typeof input === 'string' ? input : input.url;
    if (res.status === 401 && url.startsWith(AUTH_API_URL)
        && !['/api/login','/api/request-reset','/api/reset-password'].some(r => url.includes(r))
        && appEl.classList.contains('visible')){
      forceLogout('Tu sesión ya no es válida (cuenta dada de baja o sesión caducada). Vuelve a iniciar sesión.');
    }
  } catch (e) { /* nunca romper la peticion original */ }
  return res;
};
// roles: admin (todo) | user (trabajo diario) | viewer (solo consulta). El servidor es quien manda;
// esto solo decide que botones se muestran.
function currentRole(){
  const r = localStorage.getItem(AUTH_ROLE_KEY);
  if (r === 'admin' || r === 'user' || r === 'viewer') return r;
  return localStorage.getItem(AUTH_ADMIN_KEY) === '1' ? 'admin' : 'user';
}
export const canWrite = () => currentRole() !== 'viewer';
export const isAdminRole = () => currentRole() === 'admin';
function storeRole(role){
  const r = (role === 'admin' || role === 'viewer') ? role : 'user';
  localStorage.setItem(AUTH_ROLE_KEY, r);
  localStorage.setItem(AUTH_ADMIN_KEY, r === 'admin' ? '1' : '0');
}
function clearSession(){
  localStorage.removeItem(AUTH_ROLE_KEY);
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_BADGE_KEY);
  localStorage.removeItem(AUTH_ADMIN_KEY);
  localStorage.removeItem(AUTH_EMAIL_KEY);
}
function forceLogout(message){
  document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
  clearSession();
  showLogin();
  if (message){
    loginError.textContent = message;
    loginError.style.display = 'block';
  }
}
export const AUTH_KEY = 'ib_control_estaciones_auth';
const AUTH_BADGE_KEY = 'ib_control_estaciones_badge';
const AUTH_ADMIN_KEY = 'ib_control_estaciones_admin';
export const AUTH_EMAIL_KEY = 'ib_control_estaciones_email';
const AUTH_ROLE_KEY = 'ib_control_estaciones_role';

function updateDataBadge(){
  const show = localStorage.getItem(AUTH_BADGE_KEY) === '1';
  document.getElementById('data-update-badge').style.display = show ? 'flex' : 'none';
}

const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPass = document.getElementById('login-pass');
const loginError = document.getElementById('login-error');
export const appEl = document.querySelector('.app');
const logoutBtn = document.getElementById('logout-btn');

// cambio de contraseña: obligatorio tras una temporal (forced) o voluntario desde la cabecera
const changeForm = document.getElementById('change-form');
const changeCurrent = document.getElementById('change-current');
const changeCurrentWrap = document.getElementById('change-current-wrap');
const changePass1 = document.getElementById('change-pass1');
const changePass2 = document.getElementById('change-pass2');
const changeError = document.getElementById('change-error');
const changeSub = document.getElementById('change-sub');
const changeCancelBtn = document.getElementById('change-cancel');
const loginTitleEl = document.getElementById('login-title');
const PASSWORD_MIN = 10;
let pwChange = null; // { forced, token, current } mientras el formulario de cambio esta abierto

const resetForm = document.getElementById('reset-form');
const resetPass1 = document.getElementById('reset-pass1');
const resetPass2 = document.getElementById('reset-pass2');
const resetError = document.getElementById('reset-error');
const loginLoading = document.getElementById('login-loading');

function applyRoleUI(){
  const role = currentRole();
  appEl.dataset.role = role;
  const admin = role === 'admin';
  const usersBtn = document.getElementById('open-users-panel');
  if (usersBtn) usersBtn.style.display = admin ? '' : 'none';
  const usersTile = document.getElementById('home-t-users');
  if (usersTile) usersTile.style.display = admin ? '' : 'none';
  const note = document.getElementById('home-role');
  if (note){
    note.textContent = role === 'viewer' ? 'Tu acceso es de solo consulta: puedes verlo todo, pero no modificar datos.' : '';
    note.style.display = role === 'viewer' ? '' : 'none';
  }
}
// pregunta al servidor el rol actual (por si un administrador lo ha cambiado) y ajusta la pantalla
async function refreshMe(){
  try {
    const res = await fetch(`${AUTH_API_URL}/api/me`, { headers: { 'Authorization': `Bearer ${localStorage.getItem(AUTH_KEY)}` } });
    if (!res.ok) return;
    const data = await res.json();
    const before = currentRole();
    storeRole(data.role);
    applyRoleUI();
    if (before !== currentRole() && app.trkRender && app.TRK.active) app.trkRender();
  } catch (e) { /* sin conexion: se queda con el rol guardado */ }
}

function showApp(){
  loginOverlay.style.display = 'none';
  appEl.classList.add('visible');
  applyRoleUI();
  refreshMe();
  applyRoute();
}

// ---- pagina de inicio tras el login, con rutas #inicio / #mapa ----
function refreshHomeCounts(){
  if (app.renderHomeStats) app.renderHomeStats();
}
function enterHome(){
  appEl.classList.remove('tracking-mode');
  if (app.trkLeave) app.trkLeave();
  appEl.classList.add('home-mode');
  refreshHomeCounts();
  if (app.refreshHomeExtras) app.refreshHomeExtras();
}
function enterTracking(code){
  appEl.classList.remove('home-mode');
  appEl.classList.add('tracking-mode');
  if (app.trkEnter) app.trkEnter(code);
}
function enterMap(){
  if (app.trkLeave) app.trkLeave();
  appEl.classList.remove('home-mode', 'tracking-mode');
  if (window.__map){
    setTimeout(() => window.__map.invalidateSize(), 50);
  }
}
export function goHome(){ if (location.hash !== '#inicio') location.hash = '#inicio'; else enterHome(); }
function goTracking(){ if (location.hash !== '#seguimiento') location.hash = '#seguimiento'; else enterTracking(null); }
function goMap(){ if (location.hash !== '#mapa') location.hash = '#mapa'; else enterMap(); }
function applyRoute(){
  if (!appEl.classList.contains('visible')) return;
  const track = /^#seguimiento(?:\/([A-Za-z0-9]{3,4}))?$/.exec(location.hash);
  if (location.hash === '#mapa') enterMap();
  else if (track) enterTracking(track[1] ? track[1].toUpperCase() : null);
  else {
    if (location.hash !== '#inicio') history.replaceState(null, '', '#inicio');
    enterHome();
  }
}
window.addEventListener('hashchange', applyRoute);
const headerLogo = document.querySelector('header .logo');
headerLogo.title = 'Ir al inicio';
headerLogo.addEventListener('click', goHome);
document.getElementById('home-t-contracted').addEventListener('click', () => { goMap(); app.switchMode('main'); });
document.getElementById('home-t-uncov').addEventListener('click', goTracking);
document.getElementById('home-t-alt').addEventListener('click', () => { goMap(); app.switchMode('alt'); });
[
  ['home-t-fcamo', 'open-fcamo-header-panel'],
  ['home-t-pernocta', 'open-pernocta-overview'],
  ['home-t-users', 'open-users-panel'],
  ['home-t-activity', 'open-activity-overview'],
].forEach(([tile, target]) => {
  document.getElementById(tile).addEventListener('click', () => document.getElementById(target).click());
});
function showLoginView(view){
  loginForm.style.display = view === 'login' ? '' : 'none';
  changeForm.style.display = view === 'change' ? '' : 'none';
  resetForm.style.display = view === 'reset' ? '' : 'none';
  loginLoading.style.display = view === 'loading' ? '' : 'none';
  loginTitleEl.textContent = view === 'change' ? (pwChange && pwChange.forced ? 'Elige tu contraseña' : 'Cambiar contraseña')
    : view === 'reset' ? 'Nueva contraseña' : 'Iniciar sesión';
}
function showLogin(){
  appEl.classList.remove('visible');
  loginOverlay.style.display = 'flex';
  loginPass.value = '';
  showLoginView('login');
  setTimeout(() => loginEmail.focus(), 50);
}

// ---- carga de datos (horario, contactos, proveedores) tras iniciar sesion:
// se piden al Worker ya autenticado y despues se carga el resto de la app
// (src/app.js, en un chunk aparte), en vez de venir escritos en el HTML publico ----
let appPartBLoaded = false;
async function loadAppPartB(stations, altStations, pernoctaMonths){
  setAppData(stations, altStations, pernoctaMonths);
  await import('./app.js');
}
async function loadAppAndShow(){
  if (appPartBLoaded){ showApp(); return; }
  showLoginView('loading');
  loginOverlay.style.display = 'flex';
  const token = localStorage.getItem(AUTH_KEY);
  try {
    // lite=1: sin horarios ni pernoctas por dia (se piden al abrir cada ficha); un Worker antiguo lo ignora
    const res = await fetch(`${AUTH_API_URL}/api/data?lite=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No se han podido cargar los datos');
    await loadAppPartB(data.stations, data.alt_stations, data.pernocta_months);
    appPartBLoaded = true;
    showApp();
  } catch (err){
    localStorage.removeItem(AUTH_KEY);
    showLoginView('login');
    loginOverlay.style.display = 'flex';
    loginError.textContent = 'No se han podido cargar los datos (' + err.message + '). Vuelve a iniciar sesión.';
    loginError.style.display = 'block';
  }
}

// ---- si la URL trae ?reset=<token>, mostramos directamente el formulario de nueva contraseña ----
const urlParams = new URLSearchParams(window.location.search);
const resetToken = urlParams.get('reset');

const savedToken = localStorage.getItem(AUTH_KEY);
if (resetToken){
  loginOverlay.style.display = 'flex';
  showLoginView('reset');
} else if (savedToken){
  updateDataBadge();
  loadAppAndShow();
} else {
  showLogin();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPass.value;
  try {
    const res = await fetch(`${AUTH_API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok && data.must_change && data.token){
      // contraseña temporal: hay que elegir una propia antes de entrar (el token restringido no se guarda)
      loginPass.value = '';
      openChangePassword(true, data.token, password);
      return;
    }
    if (res.ok && data.token){
      localStorage.setItem(AUTH_KEY, data.token);
      localStorage.setItem(AUTH_BADGE_KEY, data.show_data_badge ? '1' : '0');
      storeRole(data.role || (data.is_admin ? 'admin' : 'user'));
      localStorage.setItem(AUTH_EMAIL_KEY, data.email || '');
      updateDataBadge();
      loadAppAndShow();
    } else {
      loginError.textContent = data.error || 'Usuario o contraseña incorrectos.';
      loginError.style.display = 'block';
    }
  } catch (err){
    loginError.textContent = 'No se ha podido conectar con el servidor de acceso. Inténtalo de nuevo.';
    loginError.style.display = 'block';
  }
});

function openChangePassword(forced, token, current){
  pwChange = { forced, token, current };
  changeError.style.display = 'none';
  changeCurrent.value = ''; changePass1.value = ''; changePass2.value = '';
  changeCurrentWrap.style.display = forced ? 'none' : '';
  changeSub.textContent = forced
    ? 'Has entrado con una contraseña temporal. Elige la tuya para continuar.'
    : 'Escribe tu contraseña actual y la nueva. Se cerrarán tus otras sesiones abiertas.';
  loginOverlay.style.display = 'flex';
  showLoginView('change');
  setTimeout(() => (forced ? changePass1 : changeCurrent).focus(), 50);
}
function closeChangePassword(){
  const wasForced = !!(pwChange && pwChange.forced);
  pwChange = null;
  changeCurrent.value = ''; changePass1.value = ''; changePass2.value = '';
  if (wasForced) showLogin();
  else { loginOverlay.style.display = 'none'; showLoginView('login'); }
}
changeCancelBtn.addEventListener('click', closeChangePassword);
document.getElementById('change-pass-btn').addEventListener('click', () => {
  openChangePassword(false, localStorage.getItem(AUTH_KEY), null);
});

changeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!pwChange) return;
  changeError.style.display = 'none';
  const fail = (msg) => { changeError.textContent = msg; changeError.style.display = 'block'; };
  const current = pwChange.forced ? pwChange.current : changeCurrent.value;
  if (!current) return fail('Escribe tu contraseña actual.');
  if (changePass1.value.length < PASSWORD_MIN) return fail(`La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres.`);
  if (changePass1.value !== changePass2.value) return fail('Las dos contraseñas nuevas no coinciden.');
  try {
    const res = await fetch(`${AUTH_API_URL}/api/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pwChange.token}` },
      body: JSON.stringify({ current_password: current, new_password: changePass1.value }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token){
      const wasForced = pwChange.forced;
      pwChange = null;
      changeCurrent.value = ''; changePass1.value = ''; changePass2.value = '';
      localStorage.setItem(AUTH_KEY, data.token);
      localStorage.setItem(AUTH_BADGE_KEY, data.show_data_badge ? '1' : '0');
      storeRole(data.role || (data.is_admin ? 'admin' : 'user'));
      localStorage.setItem(AUTH_EMAIL_KEY, data.email || '');
      if (wasForced){ updateDataBadge(); loadAppAndShow(); }
      else {
        loginOverlay.style.display = 'none';
        showLoginView('login');
        if (app.trkToast) app.trkToast('Contraseña cambiada. Se han cerrado tus otras sesiones.');
      }
    } else if (res.status === 401){
      const wasForced = pwChange.forced;
      if (wasForced){
        closeChangePassword();
        loginError.textContent = 'Ha caducado el tiempo para elegir la contraseña. Vuelve a iniciar sesión con la temporal.';
        loginError.style.display = 'block';
      } else {
        fail('Tu sesión ya no es válida. Vuelve a iniciar sesión.');
      }
    } else {
      fail(data.error || 'No se ha podido cambiar la contraseña.');
    }
  } catch (err){
    fail('No se ha podido conectar con el servidor. Inténtalo de nuevo.');
  }
});

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  resetError.style.display = 'none';
  if (resetPass1.value.length < PASSWORD_MIN){
    resetError.textContent = `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
    resetError.style.display = 'block';
    return;
  }
  if (resetPass1.value !== resetPass2.value){
    resetError.textContent = 'Las dos contraseñas no coinciden.';
    resetError.style.display = 'block';
    return;
  }
  try {
    const res = await fetch(`${AUTH_API_URL}/api/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password: resetPass1.value }),
    });
    const data = await res.json();
    if (res.ok && data.ok){
      window.history.replaceState({}, '', window.location.pathname);
      showLoginView('login');
      loginError.style.display = 'none';
    } else {
      resetError.textContent = data.error || 'No se ha podido guardar la nueva contraseña.';
      resetError.style.display = 'block';
    }
  } catch (err){
    resetError.textContent = 'No se ha podido conectar con el servidor. Inténtalo de nuevo.';
    resetError.style.display = 'block';
  }
});

logoutBtn.addEventListener('click', () => {
  document.querySelectorAll('.modal-overlay.open').forEach(el => el.classList.remove('open'));
  clearSession();
  showLogin();
});

// ---- FIN PARTE A: todo el codigo de la app (mapa, listas, fichas, excel,
// F-CAMO...) vive en src/app.js, que solo se carga despues de iniciar sesion
// y de recibir los datos reales (ver loadAppPartB). Asi el HTML publico no
// contiene vuelos, contactos ni datos de proveedores en texto plano.
