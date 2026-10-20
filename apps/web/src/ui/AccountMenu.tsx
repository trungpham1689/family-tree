import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { useMyProfile } from '../data/profile';
import { MyProfileDialog } from '../profile/MyProfileDialog';

const ITEM = 'block min-h-11 w-full px-4 text-left hover:bg-paper';

/** Ảnh đại diện chữ cái đầu của tên (hoặc email); bấm mở menu "Cá nhân" / "Đăng xuất". Bấm ra ngoài hoặc Esc thì đóng. */
export const AccountMenu = () => {
  const { state, signOut } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const profile = useMyProfile();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = profile.data?.fullName || email || '?';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Tài khoản"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid size-11 place-items-center"
      >
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-son font-semibold text-white uppercase">
          {Array.from(label)[0]}
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() => {
              setOpen(false);
              setProfileOpen(true);
            }}
          >
            Cá nhân
          </button>
          <button type="button" role="menuitem" className={`${ITEM} text-danger`} onClick={signOut}>
            Đăng xuất
          </button>
        </div>
      )}
      <MyProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};
