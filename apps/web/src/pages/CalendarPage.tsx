import { fromJulianDay, julianDay, type SolarDate } from '@gia-pha/lunar';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { DayDetails } from '../calendar/DayDetails';
import { MonthCalendar } from '../calendar/MonthCalendar';
import { parseIsoDate, shiftMonth, todayInVietnam, toIsoDate } from '../calendar/month-grid';
import { dateKey, groupByDay, occurrencesBetween, type CalendarSource, type Occurrence, type OccurrenceKind } from '../calendar/occurrences';
import { OccurrenceList } from '../calendar/OccurrenceList';
import { useMyCalendar } from '../data/tree-queries';
import { ErrorBanner } from '../ui/fields';
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
      <PublicHeader />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_22rem]">
        <div>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h1 className="font-serif text-3xl font-bold">{signedIn ? 'Lịch của tôi' : 'Lịch âm dương'}</h1>
            {signedIn && (
              <Link to="/sap-toi" className="font-semibold text-son hover:underline">
                Sắp tới (30 ngày) →
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
              <h2 className="mb-2 font-serif text-xl font-bold">Trong gia phả của bạn</h2>
              <OccurrenceList occurrences={selectedOccurrences} showTree={manyTrees} />
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
