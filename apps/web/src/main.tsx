import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
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
import { TreeEventsPage } from './pages/TreeEventsPage';
import { ImportPage } from './pages/ImportPage';
import { IncompletePage } from './pages/IncompletePage';
import { KinshipPage } from './pages/KinshipPage';
import { PhaDoPage } from './pages/PhaDoPage';
import { PhaKyPage } from './pages/PhaKyPage';
import { DuplicatesPage } from './pages/DuplicatesPage';
import { TimelinePage } from './pages/TimelinePage';
import { PublicPersonPage, PublicTreePage } from './pages/PublicTreePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { MyEventsPage } from './pages/MyEventsPage';
import { TreePage } from './pages/TreePage';
import { TreeViewPage } from './pages/TreeViewPage';
import { OFFLINE_CACHE_VERSION, OFFLINE_MAX_AGE_MS, queryPersister, shouldPersistQuery } from './lib/offline-cache';
import { FullPageMessage } from './ui/FullPageMessage';

const queryClient = new QueryClient({
  // gcTime phải không ngắn hơn thời hạn lưu offline, nếu không dữ liệu bị dọn khỏi bộ nhớ trước khi kịp lưu.
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, gcTime: OFFLINE_MAX_AGE_MS } },
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
        <TreeEventsPage />
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
    path: '/gia-pha/:treeId/dong-thoi-gian',
    element: (
      <RequireAuth>
        <TimelinePage />
      </RequireAuth>
    ),
  },
  {
    path: '/gia-pha/:treeId/trung-lap',
    element: (
      <RequireAuth>
        <DuplicatesPage />
      </RequireAuth>
    ),
  },
  {
    path: '/su-kien',
    element: (
      <RequireAuth>
        <MyEventsPage />
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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: OFFLINE_MAX_AGE_MS,
        buster: OFFLINE_CACHE_VERSION,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);

// Service worker: giữ khung ứng dụng để mở được khi mất mạng (chỉ bản build, không chạy khi `pnpm dev`).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
