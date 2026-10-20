import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { authErrorMessage } from '../auth/auth-error-message';
import { useAuth } from '../auth/auth-context';
import { supabase } from '../lib/supabase';
import { Button } from '../ui/Button';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';
import { PasswordInput } from '../ui/fields';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Trang đích của link "Quên mật khẩu" trong email. Link đó tự đăng nhập tạm (Supabase xử lý qua URL),
 * nên có phiên đăng nhập ở đây nghĩa là link còn hợp lệ; chưa có thì link đã hết hạn hoặc dùng rồi.
 */
export const ResetPasswordPage = () => {
  const { state } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (state.status === 'loading') return <FullPageMessage>Đang tải…</FullPageMessage>;

  if (state.status === 'signed-out') {
    return (
      <FullPageMessage>
        Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
        <br />
        <Link to="/dang-nhap" className="font-semibold text-son hover:underline">
          Quay lại trang đăng nhập
        </Link>{' '}
        để gửi lại.
      </FullPageMessage>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (password !== confirm) {
      setError('Hai mật khẩu chưa khớp.');
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError(authErrorMessage(updateError));
      else setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <img src="/logo-mark.svg" alt="" className="mx-auto mb-2 h-12 w-12" />
          <h1 className="font-serif text-3xl font-bold text-son">Đặt lại mật khẩu</h1>
        </header>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          {done ? (
            <div className="space-y-4 text-center">
              <p>Đã đổi mật khẩu.</p>
              <Link to="/gia-pha">
                <Button className="w-full">Vào Gia phả của tôi</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block font-medium">Mật khẩu mới</span>
                <PasswordInput
                  required
                  autoFocus
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
                />
                <span className="mt-1 block text-sm text-ink-muted">Ít nhất {MIN_PASSWORD_LENGTH} ký tự.</span>
              </label>
              <label className="block">
                <span className="mb-1 block font-medium">Nhập lại mật khẩu mới</span>
                <PasswordInput
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
                />
              </label>

              {error && (
                <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-danger">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
              </Button>
            </form>
          )}
        </section>
      </div>
    </main>
    <Footer />
    </>
  );
};
