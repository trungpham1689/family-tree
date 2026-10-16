import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { Button } from './Button';

export const AppHeader = ({ email }: { email?: string | undefined }) => {
  const { signOut } = useAuth();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/gia-pha" className="font-serif text-2xl font-bold text-son">
          Gia Phả
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/lich" className="font-semibold text-ink hover:text-son">
            Lịch
          </Link>
          <Link to="/sap-toi" className="font-semibold text-ink hover:text-son">
            Sắp tới
          </Link>
          {email && <span className="hidden text-ink-muted sm:inline">{email}</span>}
          <Button variant="ghost" onClick={signOut}>
            Đăng xuất
          </Button>
        </div>
      </div>
    </header>
  );
};
