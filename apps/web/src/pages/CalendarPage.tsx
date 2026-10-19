import { fromJulianDay, julianDay, type SolarDate } from '@gia-pha/lunar';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { DayDetails } from '../calendar/DayDetails';
import { MonthCalendar } from '../calendar/MonthCalendar';
import { parseIsoDate, shiftMonth, todayInVietnam, toIsoDate } from '../calendar/month-grid';
import { dateKey, groupByDay, occurrencesBetween, type CalendarSource, type Occurrence, type OccurrenceKind } from '@gia-pha/reminders';
import { OccurrenceList } from '../calendar/OccurrenceList';
import { useMyCalendar } from '../data/tree-queries';
import { ErrorBanner } from '../ui/fields';
import { AppHeader } from '../ui/AppHeader';
import { PublicHeader } from '../ui/PublicHeader';

/**
 * Lịch âm dương: ai cũng xem được. Khi đã đăng nhập, có thêm chấm giỗ, sinh nhật, Sự kiện
 * của mọi Gia phả tài khoản tham gia.
 */
export const CalendarPage = () => {
  const [params, setParams] = useSearchParams();
  const { state } = useAuth();
  const signedIn = state.status === 'signed-in';
  const calendar = useMyCalendar(signedIn);
  const today = todayInVietnam();
  const selected = parseIsoDate(params.get('ngay')) ?? today;
  const viewed = parseMonth(params.get('thang')) ?? { year: selected.year, month: selected.month };

  // Lấy rộng ra hai bên để cả các ô của tháng trước/sau trên lưới cũng có chấm.
  const byDay = useOccurrencesAroundMonth(calendar.data, viewed.year, viewed.month);
  const monthOccurrences = useOccurrencesInMonth(calendar.data, viewed.year, viewed.month);

  const marks = (date: SolarDate): OccurrenceKind[] => [
    ...new Set((byDay.get(dateKey(date)) ?? []).map((occurrence) => occurrence.kind)),
  ];
  const selectedOccurrences = byDay.get(dateKey(selected)) ?? [];
  const manyTrees = (calendar.data?.trees.length ?? 0) > 1;

  const update = (next: { ngay?: string; thang?: string }) =>
    setParams((current) => {
      const merged = new URLSearchParams(current);
      for (const [key, value] of Object.entries(next)) merged.set(key, value);
      return merged;
    });

  return (
    <>
      {signedIn ? <AppHeader email={state.session.user.email} /> : <PublicHeader />}
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="font-serif text-3xl font-bold">{signedIn ? 'Lịch của tôi' : 'Lịch âm dương'}</h1>
            {signedIn && (
              <Link to="/su-kien" className="font-semibold text-son hover:underline">
                Xem Sự kiện →
              </Link>
            )}
          </div>
          <MonthCalendar
            year={viewed.year}
            month={viewed.month}
            today={today}
            selected={selected}
            marks={signedIn ? marks : undefined}
            onSelect={(date) => update({ ngay: toIsoDate(date), thang: monthKey(date) })}
            onShiftMonth={(delta) => update({ thang: monthKey(shiftMonth(viewed, delta)) })}
            onToday={() => update({ ngay: toIsoDate(today), thang: monthKey(today) })}
          />
          {signedIn && <Legend />}
          {calendar.isError && <ErrorBanner>{calendar.error.message}</ErrorBanner>}
        </div>
        <div className="space-y-4">
          <DayDetails date={selected} />
          {signedIn && selectedOccurrences.length > 0 && (
            <section aria-label="Trong gia phả của bạn">
              <h2 className="mb-2 font-serif text-xl font-bold">Ngày {selected.day}/{selected.month}</h2>
              <OccurrenceList occurrences={selectedOccurrences} today={today} showTree={manyTrees} />
            </section>
          )}
          {signedIn && (
            <section aria-label="Sự kiện trong tháng">
              <h2 className="mb-2 font-serif text-xl font-bold">Sự kiện trong tháng {viewed.month}/{viewed.year}</h2>
              {monthOccurrences.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-8 text-center text-ink-muted">
                  Tháng này chưa có giỗ, sinh nhật hay sự kiện nào.
                </p>
              ) : (
                <OccurrenceList occurrences={monthOccurrences} showDate today={today} showTree={manyTrees} />
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
};

/** Giỗ, sinh nhật, Sự kiện quanh một tháng, gom theo ngày. */
const useOccurrencesAroundMonth = (source: CalendarSource | undefined, year: number, month: number) =>
  useMemo(() => {
    if (!source) return new Map<string, Occurrence[]>();
    const first = julianDay({ year, month, day: 1 });
    return groupByDay(occurrencesBetween(source, fromJulianDay(first - 7), fromJulianDay(first + 45)));
  }, [source, year, month]);

/** Giỗ, sinh nhật, Sự kiện đúng trong một tháng (để hiện cả danh sách, không chỉ ngày đang chọn). */
const useOccurrencesInMonth = (source: CalendarSource | undefined, year: number, month: number) =>
  useMemo(() => {
    if (!source) return [];
    const first = julianDay({ year, month, day: 1 });
    const nextFirst = julianDay(month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 });
    return occurrencesBetween(source, fromJulianDay(first), fromJulianDay(nextFirst - 1));
  }, [source, year, month]);

const Legend = () => (
  <p className="mt-3 flex flex-wrap gap-4 text-sm text-ink-muted">
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-son" /> Giỗ
    </span>
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-la" /> Sinh nhật
    </span>
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-tram" /> Sự kiện
    </span>
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full bg-kim" /> Ngày lễ
    </span>
  </p>
);

const monthKey = ({ year, month }: { year: number; month: number }) => `${year}-${String(month).padStart(2, '0')}`;

const parseMonth = (text: string | null) => {
  const match = text?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
};
