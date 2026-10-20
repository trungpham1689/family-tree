import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useIsSuperadmin } from '../data/admin';
import { FullPageMessage } from '../ui/FullPageMessage';

/** Đặt bên trong <RequireAuth>: chỉ siêu quản trị mới thấy nội dung. Chỉ là lớp giao diện; mọi hàm admin_* tự kiểm quyền ở database. */
export const RequireSuperadmin = ({ children }: { children: ReactNode }) => {
  const superadmin = useIsSuperadmin();
  if (superadmin.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  if (superadmin.isError) return <FullPageMessage>Không kiểm tra được quyền. Hãy tải lại trang.</FullPageMessage>;
  if (!superadmin.data) {
    return (
      <FullPageMessage>
        <div className="space-y-4 text-center">
          <h1 className="font-serif text-2xl font-bold text-son">Không có quyền truy cập</h1>
          <p>Trang này chỉ dành cho siêu quản trị.</p>
          <Link to="/gia-pha" className="font-semibold text-son hover:underline">
            ← Về Gia phả của tôi
          </Link>
        </div>
      </FullPageMessage>
    );
  }
  return children;
};
