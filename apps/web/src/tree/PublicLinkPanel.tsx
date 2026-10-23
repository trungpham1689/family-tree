import { useMemo, useState, type FormEvent } from 'react';
import { publicLinkUrl } from '../data/public-tree';
import { downloadBlob, exportFileName } from '../lib/download';
import { QR_QUIET_ZONE, qrMatrix, qrPngBlob, qrSvgPath } from '../share/qr';
import { useDisablePublicLink, useRotatePublicLink, useSetPublicLinkPassword } from '../data/tree-queries';
import type { TreeWithRole } from '../data/trees';
import { Button } from '../ui/Button';
import { ErrorBanner, TextField } from '../ui/fields';

const MIN_PASSWORD = 4;

/** Mã QR của link (không chứa mật khẩu), để in dán ở nhà thờ họ hoặc gửi ảnh cho họ hàng. */
const QrCard = ({ url, treeName }: { url: string; treeName: string }) => {
  const matrix = useMemo(() => qrMatrix(url), [url]);
  const side = matrix.length + QR_QUIET_ZONE * 2;
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setError(null);
    try {
      const today = new Date().toLocaleDateString('sv-SE');
      downloadBlob(await qrPngBlob(url, `Gia phả ${treeName}`), exportFileName('Ma-QR', treeName, today, 'png'));
    } catch (failure) {
      setError((failure as Error).message);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-paper p-4">
      <svg
        role="img"
        aria-label="Mã QR của link chia sẻ công khai"
        viewBox={`${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE} ${side} ${side}`}
        shapeRendering="crispEdges"
        className="size-44 shrink-0 rounded-lg bg-white"
      >
        <path d={qrSvgPath(matrix)} fill="#000" />
      </svg>
      <div className="min-w-0 flex-1 basis-48 space-y-2">
        <p className="text-sm text-ink-muted">
          Quét bằng camera điện thoại để mở link. Mã QR không chứa mật khẩu: người xem vẫn phải nhập mật khẩu. Tạo lại link thì mã cũ hết dùng.
        </p>
        <Button variant="secondary" onClick={download}>
          Tải ảnh để in
        </Button>
        {error && <ErrorBanner>{error}</ErrorBanner>}
      </div>
    </div>
  );
};

/** Chủ sở hữu bật (kèm mật khẩu), sao chép, đổi mật khẩu, tạo lại hoặc tắt Link chia sẻ công khai. */
export const PublicLinkPanel = ({ tree }: { tree: TreeWithRole }) => {
  const rotate = useRotatePublicLink(tree.id);
  const disable = useDisablePublicLink(tree.id);
  const setPassword = useSetPublicLinkPassword(tree.id);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [mode, setMode] = useState<'none' | 'enable' | 'change-password' | 'rotate' | 'disable'>('none');
  const [passwordInput, setPasswordInput] = useState('');
  const url = tree.public_token ? publicLinkUrl(tree.public_token) : null;
  const busy = rotate.isPending || disable.isPending || setPassword.isPending;
  const error = rotate.error ?? disable.error ?? setPassword.error;
  const passwordValid = passwordInput.trim().length >= MIN_PASSWORD;

  const reset = () => {
    setMode('none');
    setPasswordInput('');
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const submitPassword = (event: FormEvent, submit: (password: string, onDone: () => void) => void) => {
    event.preventDefault();
    if (passwordValid) submit(passwordInput.trim(), reset);
  };

  return (
    <section aria-labelledby="link-cong-khai" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="link-cong-khai" className="font-serif text-2xl font-bold">
        Link chia sẻ công khai
      </h2>
      <p className="mt-1 text-ink-muted">
        Ai có link và nhập đúng mật khẩu mới xem được cây, không cần đăng nhập.
      </p>

      {url ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              aria-label="Link chia sẻ công khai"
              value={url}
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-4"
              onFocus={(event) => event.target.select()}
            />
            <Button onClick={copy}>{copied ? 'Đã chép' : 'Sao chép'}</Button>
          </div>

          {mode === 'change-password' && (
            <form className="space-y-2" onSubmit={(event) => submitPassword(event, (password, onDone) => setPassword.mutate(password, { onSuccess: onDone }))}>
              <TextField
                label="Mật khẩu mới"
                type="password"
                autoFocus
                required
                minLength={MIN_PASSWORD}
                hint={`Ít nhất ${MIN_PASSWORD} ký tự.`}
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={reset}>
                  Huỷ
                </Button>
                <Button type="submit" disabled={busy || !passwordValid}>
                  {setPassword.isPending ? 'Đang lưu…' : 'Lưu mật khẩu'}
                </Button>
              </div>
            </form>
          )}

          {mode === 'rotate' && (
            <form
              className="space-y-2 rounded-xl bg-danger-soft px-4 py-3"
              onSubmit={(event) => submitPassword(event, (password, onDone) => rotate.mutate(password, { onSuccess: onDone }))}
            >
              <p className="text-danger">Link cũ sẽ ngừng hoạt động ngay. Những người đang giữ link cũ cần được gửi link và mật khẩu mới.</p>
              <TextField
                label="Mật khẩu cho link mới"
                type="password"
                autoFocus
                required
                minLength={MIN_PASSWORD}
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={reset}>
                  Huỷ
                </Button>
                <Button type="submit" variant="danger" disabled={busy || !passwordValid}>
                  Tạo link mới
                </Button>
              </div>
            </form>
          )}

          {mode === 'disable' && (
            <div className="rounded-xl bg-danger-soft px-4 py-3">
              <p className="text-danger">Link sẽ ngừng hoạt động ngay. Bạn có thể bật lại sau, khi đó link và mật khẩu sẽ khác.</p>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" onClick={reset}>
                  Huỷ
                </Button>
                <Button variant="danger" disabled={busy} onClick={() => disable.mutate(undefined, { onSuccess: reset })}>
                  Tắt link
                </Button>
              </div>
            </div>
          )}

          {showQr && <QrCard url={url} treeName={tree.name} />}

          {mode === 'none' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" aria-expanded={showQr} onClick={() => setShowQr((shown) => !shown)}>
                {showQr ? 'Ẩn mã QR' : 'Mã QR'}
              </Button>
              <Button variant="secondary" onClick={() => setMode('change-password')}>
                Đổi mật khẩu
              </Button>
              <Button variant="secondary" onClick={() => setMode('rotate')}>
                Tạo lại link
              </Button>
              <Button variant="secondary" className="border-danger/40 text-danger! sm:ml-auto" onClick={() => setMode('disable')}>
                Tắt link
              </Button>
            </div>
          )}
        </div>
      ) : mode === 'enable' ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => submitPassword(event, (password, onDone) => rotate.mutate(password, { onSuccess: onDone }))}
        >
          <TextField
            label="Đặt mật khẩu cho link"
            type="password"
            autoFocus
            required
            minLength={MIN_PASSWORD}
            hint={`Ít nhất ${MIN_PASSWORD} ký tự. Gửi kèm link này cho người bạn muốn chia sẻ.`}
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={reset}>
              Huỷ
            </Button>
            <Button type="submit" disabled={busy || !passwordValid}>
              {rotate.isPending ? 'Đang bật…' : 'Bật link công khai'}
            </Button>
          </div>
        </form>
      ) : (
        <Button className="mt-4" onClick={() => setMode('enable')}>
          Bật link công khai
        </Button>
      )}
      {error && <ErrorBanner>{error.message}</ErrorBanner>}
    </section>
  );
};
