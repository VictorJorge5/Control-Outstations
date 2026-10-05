import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/queries';
import { ConfirmProvider } from '@/components/ui/overlay';
import { TooltipProvider } from '@/components/ui/controls';
import { Root } from './Root';
import { PageFallback } from './PageFallback';
import { UpdateBanner } from './UpdateBanner';

// Cada pantalla en su propio chunk: el login no descarga el mapa ni el resto de la app.
const HomePage = lazy(() => import('@/features/home/HomePage'));
const MapPage = lazy(() => import('@/features/map/MapPage'));
const TrackingPage = lazy(() => import('@/features/tracking/TrackingPage'));
const TrackingDetailPage = lazy(() => import('@/features/tracking/TrackingDetailPage'));
const FcamoListPage = lazy(() => import('@/features/fcamo/FcamoListPage'));
const FcamoNewPage = lazy(() => import('@/features/fcamo/FcamoNewPage'));
const FcamoTrashPage = lazy(() => import('@/features/fcamo/FcamoTrashPage'));
const FcamoDetailPage = lazy(() => import('@/features/fcamo/FcamoDetailPage'));
const PernoctasPage = lazy(() => import('@/features/pernocta/PernoctasPage'));
const ActivityPage = lazy(() => import('@/features/activity/ActivityPage'));
const UsersPage = lazy(() => import('@/features/users/UsersPage'));
const NewUserPage = lazy(() => import('@/features/users/NewUserPage'));
const AuditPage = lazy(() => import('@/features/users/AuditPage'));

const page = (C: React.ComponentType) => <Suspense fallback={<PageFallback />}><C /></Suspense>;

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: page(HomePage) },
      { path: 'mapa', element: page(MapPage) },
      { path: 'seguimiento', element: page(TrackingPage) },
      { path: 'seguimiento/:code', element: page(TrackingDetailPage) },
      { path: 'fcamo', element: page(FcamoListPage) },
      { path: 'fcamo/nuevo', element: page(FcamoNewPage) },
      { path: 'fcamo/papelera', element: page(FcamoTrashPage) },
      { path: 'fcamo/:id', element: page(FcamoDetailPage) },
      { path: 'pernoctas', element: page(PernoctasPage) },
      { path: 'actividad', element: page(ActivityPage) },
      { path: 'usuarios', element: page(UsersPage) },
      { path: 'usuarios/nuevo', element: page(NewUserPage) },
      { path: 'usuarios/historial', element: page(AuditPage) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          <ConfirmProvider>
            <RouterProvider router={router} />
            <UpdateBanner />
            <Toaster position="bottom-right" offset={20} toastOptions={{ className: 'font-sans' }} richColors closeButton />
          </ConfirmProvider>
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
