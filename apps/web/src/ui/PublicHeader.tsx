import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';

/** Thanh trên cùng cho trang công khai: không đòi đăng nhập. */
export const PublicHeader = () => {
  const { state } = useAuth();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="font-serif text-2xl font-bold text-son">
          Gia Phả
        </Link>
        <nav className="flex items-center gap-4 font-semibold">
          <Link to="/lich" className="text-ink hover:text-son">
            Lịch
          </Link>
          {state.status === 'signed-in' ? (
            <Link to="/gia-pha" className="text-son hover:underline">
              Gia phả của tôi
            </Link>
          ) : (
            <Link to="/dang-nhap" className="text-son hover:underline">
              Đăng nhập
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};
