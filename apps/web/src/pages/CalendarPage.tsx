import { useSearchParams } from 'react-router';
import { DayDetails } from '../calendar/DayDetails';
import { MonthCalendar } from '../calendar/MonthCalendar';
import { parseIsoDate, shiftMonth, todayInVietnam, toIsoDate } from '../calendar/month-grid';
import { PublicHeader } from '../ui/PublicHeader';

/** Lịch âm dương công khai: ai cũng xem được, không cần đăng nhập. */
export const CalendarPage = () => {
  const [params, setParams] = useSearchParams();
  const today = todayInVietnam();
  const selected = parseIsoDate(params.get('ngay')) ?? today;
  const viewed = parseMonth(params.get('thang')) ?? { year: selected.year, month: selected.month };

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
          <h1 className="mb-4 font-serif text-3xl font-bold">Lịch âm dương</h1>
          <MonthCalendar
            year={viewed.year}
            month={viewed.month}
            today={today}
            selected={selected}
            onSelect={(date) => update({ ngay: toIsoDate(date), thang: monthKey(date) })}
            onShiftMonth={(delta) => update({ thang: monthKey(shiftMonth(viewed, delta)) })}
            onToday={() => update({ ngay: toIsoDate(today), thang: monthKey(today) })}
          />
        </div>
        <DayDetails date={selected} />
      </main>
    </>
  );
};

const monthKey = ({ year, month }: { year: number; month: number }) => `${year}-${String(month).padStart(2, '0')}`;

const parseMonth = (text: string | null) => {
  const match = text?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month } : null;
};
