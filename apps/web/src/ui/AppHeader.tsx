import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { useDueReminders } from '../data/tree-queries';
import { Button } from './Button';

export const AppHeader = () => {
  const { signOut } = useAuth();
  const reminders = useDueReminders();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 whitespace-nowrap">
        <Link to="/gia-pha" className="flex items-center gap-2 font-serif text-2xl font-bold text-son">
          <img src="/logo-mark.svg" alt="" className="h-7 w-7" />
          Gia Phả
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/lich" className="font-semibold text-ink hover:text-son">
            Lịch
          </Link>
          <Link to="/su-kien" className="relative font-semibold text-ink hover:text-son" aria-label="Sự kiện">
            Sự kiện
            {reminders.unread.length > 0 && (
              <span className="absolute -right-3 -top-2 grid size-5 place-items-center rounded-full bg-son text-xs font-bold text-white">
                {reminders.unread.length > 9 ? '9+' : reminders.unread.length}
              </span>
            )}
          </Link>
          <Button variant="ghost" onClick={signOut}>
            Đăng xuất
          </Button>
        </div>
      </div>
    </header>
  );
};
