import { yearCanChi, type SolarDate } from '@gia-pha/lunar';
import { useMemo } from 'react';
import { Button } from '../ui/Button';
import { buildMonthGrid, sameDay, WEEKDAY_HEADERS, type DayCell } from './month-grid';
import { MARK_COLORS, MARK_LABELS } from './mark-colors';
import type { OccurrenceKind } from '@gia-pha/reminders';

type MonthCalendarProps = {
  year: number;
  month: number;
  today: SolarDate;
  selected: SolarDate;
  onSelect: (date: SolarDate) => void;
  onShiftMonth: (delta: number) => void;
  onToday: () => void;
  /** Loại sự kiện của tài khoản rơi vào từng ngày (giỗ, sinh nhật, Sự kiện), để chấm màu. */
  marks?: (date: SolarDate) => readonly OccurrenceKind[];
};

const lunarLabel = ({ lunar }: DayCell): string => (lunar.day === 1 ? `${lunar.day}/${lunar.month}${lunar.leap ? 'N' : ''}` : String(lunar.day));

export const MonthCalendar = ({ year, month, today, selected, onSelect, onShiftMonth, onToday, marks }: MonthCalendarProps) => {
  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const lunarYears = [...new Set(weeks.flat().filter((cell) => cell.inMonth).map((cell) => cell.lunar.year))];

  return (
    <section aria-label={`Lịch tháng ${month}/${year}`}>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">
            Tháng {month}/{year}
          </h2>
          <p className="text-ink-muted">Năm {lunarYears.map(yearCanChi).join(' – ')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" aria-label="Tháng trước" onClick={() => onShiftMonth(-1)}>
            ‹
          </Button>
          <Button variant="secondary" onClick={onToday}>
            Hôm nay
          </Button>
          <Button variant="secondary" aria-label="Tháng sau" onClick={() => onShiftMonth(1)}>
            ›
          </Button>
        </div>
      </header>

      {/* Mỗi ô là một nút có nhãn đủ ngày tháng, nên hàng tên thứ chỉ để nhìn. */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div aria-hidden="true" className="grid grid-cols-7 border-b border-line bg-paper text-center text-sm font-semibold text-ink-muted">
          {WEEKDAY_HEADERS.map((name) => (
            <div key={name} className={`py-2 ${name === 'CN' ? 'text-son' : ''}`}>
              {name}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]!.date.day + '-' + week[0]!.date.month} className="grid grid-cols-7">
            {week.map((cell) => {
              const isSelected = sameDay(cell.date, selected);
              const isToday = sameDay(cell.date, today);
              const isRedDay = cell.weekday === 8 || cell.holidays.some((holiday) => holiday.dayOff);
              const kinds = marks?.(cell.date) ?? [];
              return (
                <button
                  key={`${cell.date.month}-${cell.date.day}`}
                  type="button"
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${isToday ? 'Hôm nay, ' : ''}${cell.date.day}/${cell.date.month}, âm ${cell.lunar.day}/${cell.lunar.month}${
                    cell.holidays.length ? `, ${cell.holidays.map((holiday) => holiday.name).join(', ')}` : ''
                  }${kinds.length ? `, có ${kinds.map((kind) => MARK_LABELS[kind]).join(', ')}` : ''}`}
                  onClick={() => onSelect(cell.date)}
                  className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 border-b border-r border-line p-1 transition-colors last:border-r-0 sm:min-h-20 ${
                    isSelected ? 'bg-son/10 outline-2 -outline-offset-2 outline-son' : 'hover:bg-paper'
                  }`}
                >
                  <span
                    className={`grid size-9 place-items-center rounded-full text-lg font-semibold tabular-nums ${
                      !cell.inMonth ? 'text-ink-muted font-normal' : isToday ? 'bg-son text-white' : isRedDay ? 'text-son' : ''
                    }`}
                  >
                    {cell.date.day}
                  </span>
                  <span
                    className={`text-sm tabular-nums ${
                      !cell.inMonth
                        ? 'text-ink-muted'
                        : cell.lunar.day === 1
                          ? 'font-bold text-son'
                          : cell.lunar.day === 15
                            ? 'font-bold text-kim-text'
                            : 'text-ink-muted'
                    }`}
                  >
                    {lunarLabel(cell)}
                  </span>
                  {(cell.holidays.length > 0 || kinds.length > 0) && (
                    <span className="absolute right-1.5 top-1.5 flex gap-0.5" aria-hidden="true">
                      {cell.holidays.length > 0 && <span className="size-1.5 rounded-full bg-kim" />}
                      {kinds.map((kind) => (
                        <span key={kind} className={`size-2 rounded-full ${MARK_COLORS[kind]}`} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        Số nhỏ là ngày âm lịch; <span className="font-bold text-son">đỏ</span> là mùng 1,{' '}
        <span className="font-bold text-kim-text">vàng</span> là rằm. Chấm vàng: ngày lễ.
      </p>
    </section>
  );
};
