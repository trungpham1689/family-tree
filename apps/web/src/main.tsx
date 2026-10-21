import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import { RequireSuperadmin } from './auth/RequireSuperadmin';
import { AdminPage } from './pages/AdminPage';
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
import { TimelinePage } from './pages/TimelinePage';
import { PublicPersonPage, PublicTreePage } from './pages/PublicTreePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { MyEventsPage } from './pages/MyEventsPage';
import { TreePage } from './pages/TreePage';
import { TreeViewPage } from './pages/TreeViewPage';
import './lib/install-prompt';
import { OFFLINE_CACHE_VERSION, OFFLINE_MAX_AGE_MS, queryPersister, shouldPersistQuery } from './lib/offline-cache';
import { FullPageMessage } from './ui/FullPageMessage';
import { Root, type RouteHandle } from './ui/Root';

const queryClient = new QueryClient({
  // gcTime phải không ngắn hơn thời hạn lưu offline, nếu không dữ liệu bị dọn khỏi bộ nhớ trước khi kịp lưu.
  // Không tải lại khi quay về tab: dữ liệu đã có thì giữ, thao tác ghi tự làm mới đúng truy vấn liên quan (xem query-keys.ts).
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, gcTime: OFFLINE_MAX_AGE_MS, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Navigate to="/gia-pha" replace /> },
      { path: '/dang-nhap', handle: { title: 'Đăng nhập' } satisfies RouteHandle, element: <LoginPage /> },
      { path: '/dat-lai-mat-khau', handle: { title: 'Đặt lại mật khẩu' } satisfies RouteHandle, element: <ResetPasswordPage /> },
      { path: '/lich', handle: { title: 'Lịch' } satisfies RouteHandle, element: <CalendarPage /> },
      {
        path: '/gia-pha',
        handle: { title: 'Gia phả của tôi' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <MyTreesPage />
          </RequireAuth>
        ),
      },
      { path: '/p/:token', handle: { title: 'Gia phả chia sẻ' } satisfies RouteHandle, element: <PublicTreePage /> },
      { path: '/p/:token/nguoi/:personId', handle: { title: 'Hồ sơ người' } satisfies RouteHandle, element: <PublicPersonPage /> },
      {
        path: '/gia-pha/nhap-excel',
        handle: { title: 'Nhập từ Excel' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <ImportPage />
          </RequireAuth>
        ),
      },
      {
        path: '/gia-pha/:treeId',
        handle: { title: 'Tổng quan' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <TreePage />
          </RequireAuth>
        ),
      },
      {
        path: '/gia-pha/:treeId/pha-do',
        handle: { title: 'Phả đồ' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <PhaDoPage />
          </RequireAuth>
        ),
      },
      {
        path: '/gia-pha/:treeId/pha-ky',
        handle: { title: 'Phả ký' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <PhaKyPage />
          </RequireAuth>
        ),
      },
      {
        path: '/gia-pha/:treeId/su-kien',
        handle: { title: 'Sự kiện' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <TreeEventsPage />
          </RequireAuth>
        ),
      },
      {
        path: '/gia-pha/:treeId/quan-he',
        handle: { title: 'Tra cứu quan hệ' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <KinshipPage />
          </RequireAuth>
        ),
      },
      {
        path: '/gia-pha/:treeId/thieu-thong-tin',
        handle: { title: 'Cần cập nhật' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <IncompletePage />
          </RequireAuth>
        ),
      },
      {
        path: '/gia-pha/:treeId/dong-thoi-gian',
        handle: { title: 'Dòng thời gian' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <TimelinePage />
          </RequireAuth>
        ),
      },
      {
        path: '/quan-tri',
        handle: { title: 'Quản trị' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <RequireSuperadmin>
              <AdminPage />
            </RequireSuperadmin>
          </RequireAuth>
        ),
      },
      {
        path: '/su-kien',
        handle: { title: 'Sự kiện của tôi' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <MyEventsPage />
          </RequireAuth>
        ),
      },
      {
        path: '/gia-pha/:treeId/cay',
        handle: { title: 'Cây gia phả' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <TreeViewPage />
          </RequireAuth>
        ),
      },
      {
        path: '/gia-pha/:treeId/nguoi/:personId',
        handle: { title: 'Hồ sơ người' } satisfies RouteHandle,
        element: (
          <RequireAuth>
            <PersonPage />
          </RequireAuth>
        ),
      },
      { path: '*', handle: { title: 'Không tìm thấy trang' } satisfies RouteHandle, element: <FullPageMessage>Không tìm thấy trang này.</FullPageMessage> },
    ],
  },
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
      // Bản đã lưu có thể cũ vài giây (lưu theo nhịp 2 giây) nhưng vẫn "còn tươi" theo staleTime: tải lại ngay khi khôi phục xong,
      // để không hiện dữ liệu cũ sau khi vừa sửa (offline thì lần tải lại tạm dừng và bản đã lưu vẫn hiện).
      onSuccess={() => void queryClient.invalidateQueries()}
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
