import { useState } from 'react';
import { publicLinkUrl } from '../data/public-tree';
import { useDisablePublicLink, useRotatePublicLink } from '../data/tree-queries';
import type { TreeWithRole } from '../data/trees';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';

/** Chủ sở hữu bật, sao chép, tạo lại hoặc tắt Link chia sẻ công khai. */
export const PublicLinkPanel = ({ tree }: { tree: TreeWithRole }) => {
  const rotate = useRotatePublicLink(tree.id);
  const disable = useDisablePublicLink(tree.id);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<'rotate' | 'disable' | null>(null);
  const url = tree.public_token ? publicLinkUrl(tree.public_token) : null;
  const busy = rotate.isPending || disable.isPending;
  const error = rotate.error ?? disable.error;

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

  return (
    <section aria-labelledby="link-cong-khai" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="link-cong-khai" className="font-serif text-2xl font-bold">
        Link chia sẻ công khai
      </h2>
      <p className="mt-1 text-ink-muted">
        Ai có link đều xem được cây mà không cần đăng nhập. Người còn sống chỉ hiện tên, Đời và năm sinh; Mộ phần không bao giờ
        hiện trên link này.
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
          {confirming ? (
            <div className="rounded-xl bg-danger-soft px-4 py-3">
              <p className="text-danger">
                {confirming === 'rotate'
                  ? 'Link cũ sẽ ngừng hoạt động ngay. Những người đang giữ link cũ cần được gửi link mới.'
                  : 'Link sẽ ngừng hoạt động ngay. Bạn có thể bật lại sau, khi đó link sẽ khác.'}
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" onClick={() => setConfirming(null)}>
                  Huỷ
                </Button>
                <Button
                  className="bg-danger hover:bg-danger"
                  disabled={busy}
                  onClick={() =>
                    (confirming === 'rotate' ? rotate : disable).mutate(undefined, { onSuccess: () => setConfirming(null) })
                  }
                >
                  {confirming === 'rotate' ? 'Tạo link mới' : 'Tắt link'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setConfirming('rotate')}>
                Tạo lại link
              </Button>
              <Button variant="ghost" className="text-danger" onClick={() => setConfirming('disable')}>
                Tắt link
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button className="mt-4" disabled={busy} onClick={() => rotate.mutate()}>
          {rotate.isPending ? 'Đang bật…' : 'Bật link công khai'}
        </Button>
      )}
      {error && <ErrorBanner>{error.message}</ErrorBanner>}
    </section>
  );
};
