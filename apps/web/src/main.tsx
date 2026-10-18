import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import './index.css';
import { CalendarPage } from './pages/CalendarPage';
import { LoginPage } from './pages/LoginPage';
import { MyTreesPage } from './pages/MyTreesPage';
import { PersonPage } from './pages/PersonPage';
import { EventsPage } from './pages/EventsPage';
import { ImportPage } from './pages/ImportPage';
import { IncompletePage } from './pages/IncompletePage';
import { KinshipPage } from './pages/KinshipPage';
import { PhaDoPage } from './pages/PhaDoPage';
import { PhaKyPage } from './pages/PhaKyPage';
import { UpcomingPage } from './pages/UpcomingPage';
import { PublicPersonPage, PublicTreePage } from './pages/PublicTreePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { TreePage } from './pages/TreePage';
import { TreeViewPage } from './pages/TreeViewPage';
import { FullPageMessage } from './ui/FullPageMessage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/gia-pha" replace /> },
  { path: '/dang-nhap', element: <LoginPage /> },
  { path: '/dat-lai-mat-khau', element: <ResetPasswordPage /> },
  { path: '/lich', element: <CalendarPage /> },
  {
    path: '/gia-pha',
    element: (
      <RequireAuth>
        <MyTreesPage />
      </RequireAuth>
    ),
  },
  { path: '/p/:token', element: <PublicTreePage /> },
  { path: '/p/:token/nguoi/:personId', element: <PublicPersonPage /> },
  {
    path: '/gia-pha/nhap-excel',
    element: (
      <RequireAuth>
        <ImportPage />
      </RequireAuth>
    ),
  },
  {
    path: '/gia-pha/:treeId',
    element: (
      <RequireAuth>
        <TreePage />
      </RequireAuth>
    ),
  },
  {
    path: '/gia-pha/:treeId/pha-do',
    element: (
      <RequireAuth>
        <PhaDoPage />
      </RequireAuth>
    ),
  },
  {
    path: '/gia-pha/:treeId/pha-ky',
    element: (
      <RequireAuth>
        <PhaKyPage />
      </RequireAuth>
    ),
  },
  {
    path: '/gia-pha/:treeId/su-kien',
    element: (
      <RequireAuth>
        <EventsPage />
      </RequireAuth>
    ),
  },
  {
    path: '/gia-pha/:treeId/quan-he',
    element: (
      <RequireAuth>
        <KinshipPage />
      </RequireAuth>
    ),
  },
  {
    path: '/gia-pha/:treeId/thieu-thong-tin',
    element: (
      <RequireAuth>
        <IncompletePage />
      </RequireAuth>
    ),
  },
  {
    path: '/sap-toi',
    element: (
      <RequireAuth>
        <UpcomingPage />
      </RequireAuth>
    ),
  },
  {
    path: '/gia-pha/:treeId/cay',
    element: (
      <RequireAuth>
        <TreeViewPage />
      </RequireAuth>
    ),
  },
  {
    path: '/gia-pha/:treeId/nguoi/:personId',
    element: (
      <RequireAuth>
        <PersonPage />
      </RequireAuth>
    ),
  },
  { path: '*', element: <FullPageMessage>Không tìm thấy trang này.</FullPageMessage> },
]);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Không tìm thấy phần tử #root.');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
