import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { queryKeys } from '../data/query-keys';
import { supabase } from '../lib/supabase';
import { Button } from '../ui/Button';
import { FullPageMessage } from '../ui/FullPageMessage';
import { useAuth } from './auth-context';

/** Tài khoản mới chưa dùng được cho tới khi chủ hệ thống duyệt (bảng account_approvals, xem migration duyệt tài khoản). */
const useApproved = (accountId: string | null) =>
  useQuery({
    queryKey: queryKeys.approval(accountId ?? ''),
    enabled: accountId !== null,
    // Chưa duyệt thì kiểm tra lại mỗi 30 giây để tự vào được ngay khi vừa được duyệt.
    refetchInterval: (query) => (query.state.data === false ? 30_000 : false),
    queryFn: async () => {
      const { data, error } = await supabase.from('account_approvals').select('approved').maybeSingle();
      if (error) throw error;
      return data?.approved === true;
    },
  });

/** Chỉ hiển thị nội dung khi đã đăng nhập và đã được duyệt; chưa đăng nhập thì chuyển về trang đăng nhập. */
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { state, signOut } = useAuth();
  const location = useLocation();
  const approved = useApproved(state.status === 'signed-in' ? state.session.user.id : null);

  if (state.status === 'loading') return <FullPageMessage>Đang tải…</FullPageMessage>;
  if (state.status === 'signed-out') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/dang-nhap?tiep=${next}`} replace />;
  }
  if (approved.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  if (approved.isError) return <FullPageMessage>Không kiểm tra được trạng thái tài khoản. Hãy tải lại trang.</FullPageMessage>;
  if (!approved.data) {
    return (
      <FullPageMessage>
        <div className="space-y-4 text-center">
          <h1 className="font-serif text-2xl font-bold text-son">Tài khoản đang chờ duyệt</h1>
          <p>
            Tài khoản <strong>{state.session.user.email}</strong> đã đăng ký thành công nhưng cần người quản lý duyệt
            trước khi sử dụng. Trang sẽ tự mở khi bạn được duyệt.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" disabled={approved.isFetching} onClick={() => approved.refetch()}>
              Kiểm tra lại
            </Button>
            <Button variant="ghost" onClick={signOut}>
              Đăng xuất
            </Button>
          </div>
        </div>
      </FullPageMessage>
    );
  }
  return children;
};
