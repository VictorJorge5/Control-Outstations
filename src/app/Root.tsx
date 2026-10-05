import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { session, useSession } from '@/lib/session';
import { AppDataContext, buildAppData, fetchAppData, queryClient } from '@/lib/queries';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { LoadingScreen } from '@/features/auth/LoadingScreen';

// la app completa (shell, ficha, buscador...) se descarga mientras se cargan los datos, no en el login
const loadShell = () => import('@/components/layout/AppShell');
const AppShell = lazy(() => loadShell().then(m => ({ default: m.AppShell })));

function readResetToken() {
  return new URLSearchParams(window.location.search).get('reset');
}

export function Root() {
  const { token } = useSession();
  const [resetToken, setResetToken] = useState(readResetToken);

  // al cerrar la sesion se olvida todo lo cacheado del usuario anterior
  useEffect(() => { if (!token) queryClient.clear(); }, [token]);

  const showLogin = !token || !!resetToken;
  return (
    <AnimatePresence mode="wait">
      {showLogin ? (
        <motion.div key="login" exit={{ opacity: 0, transition: { duration: 0.2 } }} className="h-full">
          <LoginScreen resetToken={resetToken} onResetDone={() => setResetToken(null)} />
        </motion.div>
      ) : (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.3 } }} className="h-full">
          <DataGate />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Carga estaciones y proveedores (ya autenticado) antes de mostrar la app.
function DataGate() {
  const q = useQuery({ queryKey: ['app-data'], queryFn: fetchAppData, staleTime: Infinity, retry: 1, refetchOnWindowFocus: false });
  const value = useMemo(() => (q.data ? buildAppData(q.data) : null), [q.data]);
  useEffect(() => { loadShell(); }, []); // codigo y datos en paralelo

  useEffect(() => {
    if (q.error && session.get().token) {
      session.end(`No se han podido cargar los datos (${q.error.message}). Vuelve a iniciar sesión.`);
    }
  }, [q.error]);

  return (
    <AnimatePresence mode="wait">
      {value ? (
        <motion.div key="shell" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.35 } }} className="h-full">
          <AppDataContext.Provider value={value}>
            <Suspense fallback={<LoadingScreen />}>
              <AppShell dataUpdatedAt={q.data?.data_updated_at} />
            </Suspense>
          </AppDataContext.Provider>
        </motion.div>
      ) : (
        <motion.div key="loading" exit={{ opacity: 0, transition: { duration: 0.2 } }} className="h-full">
          <LoadingScreen />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
