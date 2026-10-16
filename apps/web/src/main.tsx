import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AuthProvider } from './auth/AuthProvider';
import { RequireAuth } from './auth/RequireAuth';
import './index.css';
import { LoginPage } from './pages/LoginPage';
import { MyTreesPage } from './pages/MyTreesPage';
import { TreePage } from './pages/TreePage';
import { FullPageMessage } from './ui/FullPageMessage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/gia-pha" replace /> },
  { path: '/dang-nhap', element: <LoginPage /> },
  {
    path: '/gia-pha',
    element: (
      <RequireAuth>
        <MyTreesPage />
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
