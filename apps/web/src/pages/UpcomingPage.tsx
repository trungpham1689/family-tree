import { useMemo } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { todayInVietnam } from '../calendar/month-grid';
import { upcoming } from '../calendar/occurrences';
import { OccurrenceList } from '../calendar/OccurrenceList';
import { useMyCalendar } from '../data/tree-queries';
import { AppHeader } from '../ui/AppHeader';
import { ErrorBanner } from '../ui/fields';

/** Giỗ, sinh nhật, Sự kiện trong 30 ngày tới của mọi Gia phả tài khoản tham gia. */
export const UpcomingPage = () => {
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const calendar = useMyCalendar(true);
  const list = useMemo(() => (calendar.data ? upcoming(calendar.data, todayInVietnam(), 30) : []), [calendar.data]);

  return (
    <>
      <AppHeader email={email} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="font-serif text-3xl font-bold">Sắp tới</h1>
          <Link to="/lich" className="font-semibold text-son hover:underline">
            Xem lịch tháng →
          </Link>
        </div>
        <p className="mt-1 text-ink-muted">Giỗ, sinh nhật và sự kiện trong 30 ngày tới.</p>
        <div className="mt-6">
          {calendar.isPending && <p className="text-ink-muted">Đang tải…</p>}
          {calendar.isError && <ErrorBanner>{calendar.error.message}</ErrorBanner>}
          {calendar.isSuccess && list.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-muted">
              30 ngày tới chưa có giỗ, sinh nhật hay sự kiện nào.
            </p>
          )}
          {list.length > 0 && <OccurrenceList occurrences={list} showDate showTree={(calendar.data?.trees.length ?? 0) > 1} />}
        </div>
      </main>
    </>
  );
};
