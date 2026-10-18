import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { authErrorMessage } from '../auth/auth-error-message';
import { useAuth } from '../auth/auth-context';
import { safeRedirectPath } from '../auth/safe-redirect';
import { supabase } from '../lib/supabase';
import { Button } from '../ui/Button';
import { FullPageMessage } from '../ui/FullPageMessage';

type Mode = 'sign-in' | 'sign-up';

const MIN_PASSWORD_LENGTH = 8;

export const LoginPage = () => {
  const { state } = useAuth();
  const [params] = useSearchParams();
  const next = safeRedirectPath(params.get('tiep'));

  const [mode, setMode] = useState<Mode>('sign-in');
  const [forgotPassword, setForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (state.status === 'loading') return <FullPageMessage>Đang tải…</FullPageMessage>;
  if (state.status === 'signed-in') return <Navigate to={next} replace />;

  const sendResetEmail = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/dat-lai-mat-khau`,
      });
      if (resetError) setError(authErrorMessage(resetError));
      else setNotice(`Đã gửi email đặt lại mật khẩu tới ${email}. Hãy mở thư và làm theo hướng dẫn.`);
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (oauthError) setError(authErrorMessage(oauthError));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) setError(authErrorMessage(signInError));
        return;
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${next}` },
      });
      if (signUpError) setError(authErrorMessage(signUpError));
      else if (!data.session) setNotice('Đã tạo tài khoản. Hãy mở email xác nhận rồi đăng nhập.');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (target: Mode) => {
    setMode(target);
    setForgotPassword(false);
    setError(null);
    setNotice(null);
  };

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <img src="/logo-mark.svg" alt="" className="mx-auto mb-2 h-12 w-12" />
          <h1 className="font-serif text-4xl font-bold text-son">Gia Phả</h1>
          <p className="mt-2 text-ink-muted">Lưu giữ cội nguồn của cả dòng họ</p>
        </header>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-paper p-1" role="tablist">
            {(
              [
                ['sign-in', 'Đăng nhập'],
                ['sign-up', 'Tạo tài khoản'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={`min-h-11 rounded-lg font-semibold transition-colors ${
                  mode === value ? 'bg-surface text-son shadow-sm' : 'text-ink-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Button variant="secondary" className="w-full" onClick={signInWithGoogle}>
            <GoogleMark />
            Tiếp tục với Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-sm text-ink-muted">
            <span className="h-px flex-1 bg-line" />
            hoặc dùng email
            <span className="h-px flex-1 bg-line" />
          </div>

          {forgotPassword ? (
            <form onSubmit={sendResetEmail} className="space-y-4">
              <p className="text-ink-muted">Nhập email đã dùng để tạo tài khoản. Chúng tôi sẽ gửi link đặt lại mật khẩu.</p>
              <label className="block">
                <span className="mb-1 block font-medium">
                  Email
                  <span className="text-danger" aria-hidden="true">
                    {' '}
                    *
                  </span>
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
                />
              </label>

              {error && (
                <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-danger">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-xl bg-kim-soft/40 px-4 py-3">
                  {notice}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Đang gửi…' : 'Gửi email đặt lại mật khẩu'}
              </Button>
              <button
                type="button"
                className="block w-full text-center font-semibold text-son hover:underline"
                onClick={() => {
                  setForgotPassword(false);
                  setError(null);
                  setNotice(null);
                }}
              >
                ← Quay lại đăng nhập
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block font-medium">
                  Email
                  <span className="text-danger" aria-hidden="true">
                    {' '}
                    *
                  </span>
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium">
                    Mật khẩu
                    <span className="text-danger" aria-hidden="true">
                      {' '}
                      *
                    </span>
                  </span>
                  {mode === 'sign-in' && (
                    <button
                      type="button"
                      className="font-semibold text-son hover:underline"
                      onClick={() => {
                        setForgotPassword(true);
                        setError(null);
                        setNotice(null);
                      }}
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </span>
                <input
                  type="password"
                  required
                  minLength={mode === 'sign-up' ? MIN_PASSWORD_LENGTH : undefined}
                  autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
                />
                <span className={`mt-1 block text-sm text-ink-muted ${mode === 'sign-up' ? '' : 'invisible'}`}>
                  Ít nhất {MIN_PASSWORD_LENGTH} ký tự.
                </span>
              </label>

              {error && (
                <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-danger">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-xl bg-kim-soft/40 px-4 py-3">
                  {notice}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Đang xử lý…' : mode === 'sign-in' ? 'Đăng nhập' : 'Tạo tài khoản'}
              </Button>
            </form>
          )}
        </section>

        <p className="mt-6 text-center">
          <Link to="/lich" className="font-semibold text-son hover:underline">
            Xem lịch âm dương →
          </Link>
        </p>
      </div>
    </main>
  );
};

const GoogleMark = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24z" />
    <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
  </svg>
);
