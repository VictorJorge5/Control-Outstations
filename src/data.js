// Datos que devuelve el Worker tras el login (/api/data). main.js los guarda
// aqui antes de importar app.js, que los lee como constantes.
export let STATIONS = [];
export let ALT_STATIONS = [];
export let PERNOCTA_MONTHS = [];

export function setAppData(stations, altStations, pernoctaMonths){
  STATIONS = stations;
  ALT_STATIONS = altStations;
  PERNOCTA_MONTHS = pernoctaMonths;
}
