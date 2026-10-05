// Enlaces de la version anterior (#inicio, #mapa, #seguimiento/ABC) -> rutas nuevas.
// Se importa el primero en main.tsx: el router lee la URL en cuanto se crea.
const legacy = /^#(inicio|mapa|seguimiento)(?:\/([A-Za-z0-9]{3,4}))?$/.exec(location.hash);
if (legacy) {
  const path = legacy[1] === 'inicio' ? '/' : `/${legacy[1]}${legacy[2] ? '/' + legacy[2].toUpperCase() : ''}`;
  history.replaceState(null, '', path + location.search);
}

export {};
