import { Link } from 'react-router';
import { useIsSuperadmin } from '../data/admin';
import { useDueReminders } from '../data/tree-queries';
import { AccountMenu } from './AccountMenu';

export const AppHeader = () => {
  const reminders = useDueReminders();
  const superadmin = useIsSuperadmin();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 whitespace-nowrap">
        <Link to="/gia-pha" aria-label="Gia Phả" className="flex min-h-11 items-center gap-2 font-serif text-xl font-bold text-son sm:text-2xl">
          <img src="/logo-mark.svg" alt="" className="h-7 w-7" />
          {/* Thêm link Quản trị thì điện thoại hết chỗ cho chữ; chỉ giữ biểu tượng. */}
          <span className={superadmin.data ? 'hidden sm:inline' : undefined}>Gia Phả</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link to="/lich" className="relative inline-flex min-h-11 items-center px-2 font-semibold text-ink hover:text-son" aria-label="Lịch">
            Lịch
            {reminders.unread.length > 0 && (
              <span className="absolute -right-3 -top-2 grid size-5 place-items-center rounded-full bg-son text-xs font-bold text-white">
                {reminders.unread.length > 9 ? '9+' : reminders.unread.length}
              </span>
            )}
          </Link>
          {superadmin.data && (
            <Link to="/quan-tri" className="inline-flex min-h-11 items-center px-2 font-semibold text-ink hover:text-son">
              Quản trị
            </Link>
          )}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
};
