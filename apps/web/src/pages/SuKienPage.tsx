import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { occurrencesToIcs } from '../calendar/ics';
import { todayInVietnam } from '../calendar/month-grid';
import { occurrencesBetween, upcoming } from '@gia-pha/reminders';
import { OccurrenceList } from '../calendar/OccurrenceList';
import { useDueReminders, useMarkNotificationsRead, useMyCalendar, useMyTrees, useReminderWatch, useToggleWatch } from '../data/tree-queries';
import { downloadBlob } from '../lib/download';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { Footer } from '../ui/Footer';

/** Sự kiện: giỗ/sinh nhật/sự kiện 30 ngày tới (mọi gia phả) và Danh sách nhắc giỗ. Mỗi gia phả có trang Sự kiện riêng (xem độ sớm nhắc, sự kiện cũ…). */
export const SuKienPage = () => {
  const today = todayInVietnam();
  const calendar = useMyCalendar(true);
  const upcomingList = useMemo(() => (calendar.data ? upcoming(calendar.data, today, 30) : []), [calendar.data, today]);
  const reminders = useDueReminders();
  const watch = useReminderWatch();
  const toggleWatch = useToggleWatch();
  const trees = useMyTrees();
  const markRead = useMarkNotificationsRead();
  const [exporting, setExporting] = useState(false);

  const manyTrees = (trees.data?.length ?? 0) > 1;

  const exportIcs = () => {
    if (!calendar.data) return;
    setExporting(true);
    try {
      const threeYears = occurrencesBetween(calendar.data, today, { ...today, year: today.year + 3 });
      downloadBlob(new Blob([occurrencesToIcs(threeYears)], { type: 'text/calendar;charset=utf-8' }), 'lich-gia-pha.ics');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-serif text-3xl font-bold text-son">Sự kiện</h1>

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-bold">Sắp tới (30 ngày)</h2>
            <div className="flex items-center gap-2">
              {reminders.unread.length > 0 && (
                <Button
                  variant="ghost"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate(reminders.unread.map((item) => item.key))}
                >
                  Đánh dấu đã xem
                </Button>
              )}
              {calendar.isSuccess && (
                <Button variant="secondary" disabled={exporting} onClick={exportIcs}>
                  Xuất lịch 3 năm tới (.ics)
                </Button>
              )}
            </div>
          </div>
          {calendar.isPending && <p className="mt-2 text-ink-muted">Đang tải…</p>}
          {calendar.isError && <ErrorBanner>{calendar.error.message}</ErrorBanner>}
          {calendar.isSuccess && upcomingList.length === 0 && (
            <p className="mt-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-muted">
              30 ngày tới chưa có giỗ, sinh nhật hay sự kiện nào.
            </p>
          )}
          {upcomingList.length > 0 && (
            <div className="mt-3">
              <OccurrenceList occurrences={upcomingList} showDate today={today} showTree={manyTrees} />
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="font-serif text-xl font-bold">Danh sách nhắc giỗ</h2>
          <p className="mt-1 text-ink-muted">
            Chỉ Người trong danh sách này được nhắc giỗ (sinh nhật và sự kiện luôn nhắc). Thêm/bỏ từ trang của mỗi Người.
          </p>
          {watch.isError && <ErrorBanner>{watch.error.message}</ErrorBanner>}
          {watch.isSuccess && watch.data.length === 0 && <p className="mt-2 text-ink-muted">Chưa theo dõi ai.</p>}
          {watch.isSuccess && watch.data.length > 0 && (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {watch.data.map((item) => (
                <li key={item.personId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Link to={`/gia-pha/${item.treeId}/nguoi/${item.personId}`} className="font-semibold hover:text-son hover:underline">
                    {item.personName}
                    {manyTrees && <span className="ml-2 text-sm font-normal text-ink-muted">{item.treeName}</span>}
                  </Link>
                  <button
                    type="button"
                    className="text-sm text-danger hover:underline"
                    disabled={toggleWatch.remove.isPending}
                    onClick={() => toggleWatch.remove.mutate(item.personId)}
                  >
                    Bỏ khỏi danh sách
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

      </main>
      <Footer />
    </>
  );
};
