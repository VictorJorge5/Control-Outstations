import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

// La ficha de estacion (?estacion=LHR) y el detalle de proveedores no contratados (?alt=BOS) se abren
// encima de cualquier pantalla y la URL se puede compartir.
export function useStationNav() {
  const [params, setParams] = useSearchParams();
  const openStation = useCallback((code: string) => {
    setParams(p => { const n = new URLSearchParams(p); n.delete('alt'); n.set('estacion', code); return n; });
  }, [setParams]);
  const openAlt = useCallback((code: string) => {
    setParams(p => { const n = new URLSearchParams(p); n.delete('estacion'); n.set('alt', code); return n; });
  }, [setParams]);
  const close = useCallback(() => {
    setParams(p => { const n = new URLSearchParams(p); n.delete('estacion'); n.delete('alt'); n.delete('tab'); return n; });
  }, [setParams]);
  return { stationCode: params.get('estacion'), altCode: params.get('alt'), openStation, openAlt, close };
}
