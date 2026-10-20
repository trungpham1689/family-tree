import { useAuth } from '../auth/auth-context';
import { useMyProfile, useUpdateMyProfile } from '../data/profile';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner } from '../ui/fields';
import { ProfileForm } from './ProfileForm';

/** Hồ sơ của chính mình: email chỉ xem, họ tên, ngày sinh, số điện thoại sửa được. */
export const MyProfileDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const profile = useMyProfile(open);
  const update = useUpdateMyProfile();
  const close = () => {
    update.reset();
    onClose();
  };

  return (
    <Dialog open={open} title="Hồ sơ của tôi" onClose={close}>
      <div className="space-y-4">
        {email && (
          <p className="break-all text-ink-muted">
            Email: <span className="text-ink">{email}</span>
          </p>
        )}
        {profile.isPending && <p className="text-ink-muted">Đang tải…</p>}
        {profile.isError && <ErrorBanner>{profile.error.message}</ErrorBanner>}
        {profile.data && (
          <ProfileForm
            initial={profile.data}
            pending={update.isPending}
            error={update.error?.message}
            onCancel={close}
            onSubmit={(values) => update.mutate(values, { onSuccess: close })}
          />
        )}
      </div>
    </Dialog>
  );
};
