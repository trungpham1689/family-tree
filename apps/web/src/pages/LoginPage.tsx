import { useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { authErrorMessage } from '../auth/auth-error-message';
import { useAuth } from '../auth/auth-context';
import { safeRedirectPath } from '../auth/safe-redirect';
import { supabase } from '../lib/supabase';
import { Button } from '../ui/Button';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

type Mode = 'sign-in' | 'sign-up';

const MIN_PASSWORD_LENGTH = 8;
const MIN_PHONE_DIGITS = 8;

const today = () => new Date().toLocaleDateString('sv-SE');

/** Lỗi của hồ sơ đăng ký, hoặc null nếu hợp lệ. Database kiểm lại bằng trigger; đây để báo lỗi ngay trên form. */
const profileError = (fullName: string, birthDate: string, phone: string): string | null => {
  if (fullName.trim() === '') return 'Hãy nhập họ và tên.';
  if (birthDate === '' || birthDate < '1900-01-01' || birthDate > today()) return 'Ngày sinh không hợp lệ.';
  if (!/^[0-9+(). -]{8,20}$/.test(phone.trim()) || phone.replace(/\D/g, '').length < MIN_PHONE_DIGITS) return 'Số điện thoại không hợp lệ.';
  return null;
};

export const LoginPage = () => {
  const { state } = useAuth();
  const [params] = useSearchParams();
  const next = safeRedirectPath(params.get('tiep'));

  const [mode, setMode] = useState<Mode>('sign-in');
  const [forgotPassword, setForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
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
      const invalid = profileError(fullName, birthDate, phone);
      if (invalid) {
        setError(invalid);
        return;
      }
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${next}`,
          data: { full_name: fullName.trim(), birth_date: birthDate, phone: phone.trim() },
        },
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
    <>
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
              {mode === 'sign-up' && (
                <>
                  <label className="block">
                    <span className="mb-1 block font-medium">
                      Họ và tên
                      <span className="text-danger" aria-hidden="true">
                        {' '}
                        *
                      </span>
                    </span>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-medium">
                      Ngày sinh
                      <span className="text-danger" aria-hidden="true">
                        {' '}
                        *
                      </span>
                    </span>
                    <input
                      type="date"
                      required
                      min="1900-01-01"
                      max={today()}
                      autoComplete="bday"
                      value={birthDate}
                      onChange={(event) => setBirthDate(event.target.value)}
                      className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-medium">
                      Số điện thoại
                      <span className="text-danger" aria-hidden="true">
                        {' '}
                        *
                      </span>
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={20}
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
                    />
                  </label>
                </>
              )}
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
    <Footer />
    </>
  );
};
