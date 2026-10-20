import { useMemo } from 'react';
import { Link } from 'react-router';
import { CalendarFeedPanel } from '../calendar/CalendarFeedPanel';
import { useTreeExport } from '../export/use-tree-export';
import { todayInVietnam } from '../calendar/month-grid';
import { occurrencesBetween, onThisDay, upcoming } from '@gia-pha/reminders';
import { OccurrenceList } from '../calendar/OccurrenceList';
import { useDueReminders, useMarkNotificationsRead, useMutedGioPersons, useMyCalendar, useMyTrees, useToggleGioMute } from '../data/tree-queries';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { Footer } from '../ui/Footer';

/** Sự kiện: giỗ/sinh nhật/sự kiện 30 ngày tới (mọi gia phả) và Danh sách nhắc giỗ. Mỗi gia phả có trang Sự kiện riêng (xem độ sớm nhắc, sự kiện cũ…). */
export const MyEventsPage = () => {
  const today = todayInVietnam();
  const calendar = useMyCalendar(true);
  const upcomingList = useMemo(() => (calendar.data ? upcoming(calendar.data, today, 30) : []), [calendar.data, today]);
  const history = useMemo(() => (calendar.data ? onThisDay(calendar.data, today) : []), [calendar.data, today]);
  const reminders = useDueReminders();
  const muted = useMutedGioPersons();
  const toggleMute = useToggleGioMute();
  const trees = useMyTrees();
  const markRead = useMarkNotificationsRead();
  const { running: exporting, run: runExport } = useTreeExport('');

  const manyTrees = (trees.data?.length ?? 0) > 1;

  const exportIcs = () => {
    if (!calendar.data) return;
    void runExport('ics', { occurrences: occurrencesBetween(calendar.data, today, { ...today, year: today.year + 3 }) });
  };

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
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
                <Button variant="secondary" disabled={exporting !== null} onClick={exportIcs}>
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

        {history.length > 0 && (
          <section className="mt-8" aria-labelledby="ngay-nay-nam-xua">
            <h2 id="ngay-nay-nam-xua" className="font-serif text-xl font-bold">
              Ngày này năm xưa
            </h2>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {history.map((item) => (
                <li key={`${item.kind}-${item.personId}`}>
                  <Link to={`/gia-pha/${item.treeId}/nguoi/${item.personId}`} className="flex items-start gap-3 px-4 py-3 hover:bg-paper">
                    <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-full bg-ink-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        Năm {item.year}: {item.text}
                      </span>
                      <span className="block text-sm text-ink-muted">
                        {[`Cách đây ${item.yearsAgo} năm`, manyTrees ? item.treeName : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="font-serif text-xl font-bold">Đã tắt nhắc giỗ</h2>
          <p className="mt-1 text-ink-muted">
            Mặc định ai cũng được nhắc giỗ. Người trong danh sách này đã bị tắt riêng. Bật/tắt từ trang của mỗi Người.
          </p>
          {muted.isError && <ErrorBanner>{muted.error.message}</ErrorBanner>}
          {muted.isSuccess && muted.data.length === 0 && <p className="mt-2 text-ink-muted">Chưa tắt nhắc giỗ của ai.</p>}
          {muted.isSuccess && muted.data.length > 0 && (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {muted.data.map((item) => (
                <li key={item.personId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <Link to={`/gia-pha/${item.treeId}/nguoi/${item.personId}`} className="font-semibold hover:text-son hover:underline">
                    {item.personName}
                    {manyTrees && <span className="ml-2 text-sm font-normal text-ink-muted">{item.treeName}</span>}
                  </Link>
                  <button
                    type="button"
                    className="text-sm text-son hover:underline"
                    disabled={toggleMute.unmute.isPending}
                    onClick={() => toggleMute.unmute.mutate(item.personId)}
                  >
                    Bật lại nhắc giỗ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <CalendarFeedPanel />
      </main>
      <Footer />
    </>
  );
};
