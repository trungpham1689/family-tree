import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { FullPageMessage } from '../ui/FullPageMessage';
import { useAuth } from './auth-context';

/** Chỉ hiển thị nội dung khi đã đăng nhập; nếu chưa thì chuyển về trang đăng nhập. */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') return <FullPageMessage>Đang tải…</FullPageMessage>;
  if (state.status === 'signed-out') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/dang-nhap?tiep=${next}`} replace />;
  }
  return children;
};
