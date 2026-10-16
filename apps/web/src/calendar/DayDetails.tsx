import {
  dayCanChi,
  holidaysOn,
  monthCanChi,
  solarTermOf,
  solarToLunar,
  yearCanChi,
  zodiacHours,
  type SolarDate,
} from '@gia-pha/lunar';
import { weekdayName } from './month-grid';

const pad = (hour: number) => String(hour).padStart(2, '0');

/** Thông tin đầy đủ của một ngày: âm lịch, can chi, tiết khí, giờ hoàng đạo, ngày lễ. */
export const DayDetails = ({ date }: { date: SolarDate }) => {
  const lunar = solarToLunar(date);
  const holidays = holidaysOn(date);

  return (
    <section aria-live="polite" className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-ink-muted">{weekdayName(date)}</p>
      <p className="font-serif text-3xl font-bold">
        {date.day}/{date.month}/{date.year}
      </p>
      <p className="mt-2 text-lg">
        Ngày <strong>{lunar.day}</strong> tháng <strong>{lunar.month}{lunar.leap ? ' nhuận' : ''}</strong> năm{' '}
        <strong>{yearCanChi(lunar.year)}</strong>
      </p>

      {holidays.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {holidays.map((holiday) => (
            <li
              key={holiday.name}
              className={`rounded-full px-3 py-1 text-sm ${holiday.dayOff ? 'bg-son text-white' : 'bg-kim-soft/50 text-ink'}`}
            >
              {holiday.name}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-ink-muted">Ngày</dt>
        <dd className="font-medium">{dayCanChi(date)}</dd>
        <dt className="text-ink-muted">Tháng</dt>
        <dd className="font-medium">
          {monthCanChi(lunar)}
          {lunar.leap ? ' (nhuận)' : ''}
        </dd>
        <dt className="text-ink-muted">Năm</dt>
        <dd className="font-medium">{yearCanChi(lunar.year)}</dd>
        <dt className="text-ink-muted">Tiết khí</dt>
        <dd className="font-medium">{solarTermOf(date)}</dd>
      </dl>

      <h3 className="mt-5 font-semibold">Giờ hoàng đạo</h3>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {zodiacHours(date).map((hour) => (
          <li key={hour.chi} className="rounded-xl bg-paper px-3 py-2">
            <span className="font-semibold">{hour.chi}</span>{' '}
            <span className="text-ink-muted tabular-nums">
              {pad(hour.from)}–{pad(hour.to)}h
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
