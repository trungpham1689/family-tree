import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { useIsSuperadmin } from '../data/admin';
import { useDueReminders } from '../data/tree-queries';
import { MyProfileDialog } from '../profile/MyProfileDialog';
import { Button } from './Button';

export const AppHeader = () => {
  const { signOut } = useAuth();
  const reminders = useDueReminders();
  const superadmin = useIsSuperadmin();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 whitespace-nowrap">
        <Link to="/gia-pha" aria-label="Gia Phả" className="flex items-center gap-2 font-serif text-xl font-bold text-son sm:text-2xl">
          <img src="/logo-mark.svg" alt="" className="h-7 w-7" />
          {/* Thêm link Quản trị thì điện thoại hết chỗ cho chữ; chỉ giữ biểu tượng. */}
          <span className={superadmin.data ? 'hidden sm:inline' : undefined}>Gia Phả</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link to="/lich" className="relative px-2 font-semibold text-ink hover:text-son" aria-label="Lịch">
            Lịch
            {reminders.unread.length > 0 && (
              <span className="absolute -right-3 -top-2 grid size-5 place-items-center rounded-full bg-son text-xs font-bold text-white">
                {reminders.unread.length > 9 ? '9+' : reminders.unread.length}
              </span>
            )}
          </Link>
          {superadmin.data && (
            <Link to="/quan-tri" className="px-2 font-semibold text-ink hover:text-son">
              Quản trị
            </Link>
          )}
          <button type="button" onClick={() => setProfileOpen(true)} className="min-h-11 px-2 font-semibold text-ink hover:text-son">
            Hồ sơ
          </button>
          <Button variant="ghost" className="px-3 sm:px-5" onClick={signOut}>
            Đăng xuất
          </Button>
        </div>
      </div>
      <MyProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
};
