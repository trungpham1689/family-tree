import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { useMyProfile } from '../data/profile';
import { promptInstall, useInstallMode } from '../lib/install-prompt';
import { MyProfileDialog } from '../profile/MyProfileDialog';
import { Dialog } from './Dialog';

const ITEM = 'block min-h-11 w-full px-4 text-left hover:bg-paper';

/** Ảnh đại diện chữ cái đầu của tên (hoặc email); bấm mở menu "Cá nhân" / "Đăng xuất". Bấm ra ngoài hoặc Esc thì đóng. */
export const AccountMenu = () => {
  const { state, signOut, signingOut } = useAuth();
  const user = state.status === 'signed-in' ? state.session.user : undefined;
  const email = user?.email;
  const [open, setOpen] = useState(false);
  // Chữ cái avatar lấy từ tên lúc đăng ký (đã có trong phiên) hoặc email; hồ sơ chỉ tải khi mở menu.
  const profile = useMyProfile(open);
  const [profileOpen, setProfileOpen] = useState(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);
  const installMode = useInstallMode();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const signupName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';
  const label = profile.data?.fullName || signupName || email || '?';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
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
        ref={triggerRef}
        type="button"
        aria-label="Tài khoản"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid size-11 place-items-center"
      >
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-son font-semibold text-white uppercase">
          {Array.from(label)[0]}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
          <button
            type="button"
            className={ITEM}
            onClick={() => {
              setOpen(false);
              setProfileOpen(true);
            }}
          >
            Cá nhân
          </button>
          {installMode !== 'none' && (
            <button
              type="button"
              className={ITEM}
              onClick={() => {
                setOpen(false);
                if (installMode === 'prompt') void promptInstall();
                else setIosHelpOpen(true);
              }}
            >
              Cài ứng dụng
            </button>
          )}
          <button type="button" className={`${ITEM} text-danger`} disabled={signingOut} onClick={signOut}>
            {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
          </button>
        </div>
      )}
      <MyProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      <Dialog open={iosHelpOpen} title="Cài ứng dụng" onClose={() => setIosHelpOpen(false)}>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Mở trang này bằng Safari.</li>
          <li>Bấm nút Chia sẻ (hình ô vuông có mũi tên lên) ở thanh dưới.</li>
          <li>Chọn “Thêm vào MH chính” rồi bấm “Thêm”.</li>
        </ol>
      </Dialog>
    </div>
  );
};
