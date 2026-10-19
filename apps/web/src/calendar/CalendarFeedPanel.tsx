import { useState } from 'react';
import { calendarFeedUrl } from '../data/calendar-feed';
import { useCalendarFeed, useDisableCalendarFeed, useRotateCalendarFeed } from '../data/tree-queries';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';

/** Link lịch đăng ký (.ics): dán vào Google/Apple Calendar một lần, giỗ, sinh nhật, kỷ niệm cưới và sự kiện tự cập nhật kèm chuông báo. */
export const CalendarFeedPanel = () => {
  const feed = useCalendarFeed();
  const rotate = useRotateCalendarFeed();
  const disable = useDisableCalendarFeed();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<'rotate' | 'disable' | null>(null);
  const url = feed.data ? calendarFeedUrl(feed.data) : null;
  const webcal = url?.replace(/^https?:/, 'webcal:') ?? null;
  const busy = rotate.isPending || disable.isPending;
  const error = feed.error ?? rotate.error ?? disable.error;

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
    <section aria-labelledby="lich-dang-ky" className="mt-8 rounded-2xl border border-line bg-surface p-5">
      <h2 id="lich-dang-ky" className="font-serif text-xl font-bold">
        Lịch trên điện thoại
      </h2>
      <p className="mt-1 text-ink-muted">
        Thêm một lần vào Google/Apple Calendar: giỗ, sinh nhật, kỷ niệm cưới và sự kiện của mọi gia phả tự cập nhật, có chuông báo
        trước một ngày và đúng ngày. Không cần mở app.
      </p>

      {feed.isPending ? null : url && webcal ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              aria-label="Link lịch đăng ký"
              value={url}
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-4"
              onFocus={(event) => event.target.select()}
            />
            <Button onClick={copy}>{copied ? 'Đã chép' : 'Sao chép'}</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={webcal}
              className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-semibold hover:bg-paper"
            >
              Thêm vào Apple Calendar
            </a>
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center rounded-xl border border-line bg-surface px-5 font-semibold hover:bg-paper"
            >
              Thêm vào Google Calendar
            </a>
          </div>
          <p className="text-sm text-ink-muted">Link này là bí mật: ai có link xem được tên và ngày các mục trên. Đừng gửi cho người ngoài gia đình.</p>

          {confirming && (
            <div className="rounded-xl bg-danger-soft px-4 py-3">
              <p className="text-danger">
                {confirming === 'rotate'
                  ? 'Link cũ ngừng hoạt động ngay; lịch đã thêm vào điện thoại cần thêm lại bằng link mới.'
                  : 'Link ngừng hoạt động ngay; lịch đã thêm vào điện thoại sẽ không cập nhật nữa.'}
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="secondary" onClick={() => setConfirming(null)}>
                  Huỷ
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => (confirming === 'rotate' ? rotate : disable).mutate(undefined, { onSuccess: () => setConfirming(null) })}
                >
                  {confirming === 'rotate' ? 'Tạo link mới' : 'Tắt link'}
                </Button>
              </div>
            </div>
          )}
          {!confirming && (
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setConfirming('rotate')}>
                Tạo lại link
              </Button>
              <Button variant="ghost" className="text-danger!" onClick={() => setConfirming('disable')}>
                Tắt
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Button className="mt-4" disabled={busy} onClick={() => rotate.mutate(undefined)}>
          {rotate.isPending ? 'Đang bật…' : 'Bật lịch đăng ký'}
        </Button>
      )}
      {error && <ErrorBanner>{error.message}</ErrorBanner>}
    </section>
  );
};
