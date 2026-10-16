import { fromJulianDay, holidaysOn, julianDay, solarToLunar, type Holiday, type LunarDate, type SolarDate } from '@gia-pha/lunar';

export type DayCell = {
  date: SolarDate;
  inMonth: boolean;
  lunar: LunarDate;
  holidays: Holiday[];
  /** Thứ trong tuần theo cách gọi Việt Nam: 2–7, CN = 8. */
  weekday: number;
};

export const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

/** Thứ trong tuần (0 = thứ Hai … 6 = Chủ nhật) của một số ngày Julius. */
const mondayIndex = (jd: number): number => jd % 7;

/** Lưới lịch tháng, tuần bắt đầu từ thứ Hai, đủ các tuần chứa ngày của tháng. */
export const buildMonthGrid = (year: number, month: number): DayCell[][] => {
  const first = julianDay({ year, month, day: 1 });
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const last = julianDay({ ...nextMonth, day: 1 }) - 1;
  const gridStart = first - mondayIndex(first);
  const gridEnd = last + (6 - mondayIndex(last));

  const weeks: DayCell[][] = [];
  for (let jd = gridStart; jd <= gridEnd; jd += 7) {
    weeks.push(
      Array.from({ length: 7 }, (_, offset) => {
        const date = fromJulianDay(jd + offset);
        return {
          date,
          inMonth: date.month === month && date.year === year,
          lunar: solarToLunar(date),
          holidays: holidaysOn(date),
          weekday: offset + 2,
        };
      }),
    );
  }
  return weeks;
};

/** Ngày hôm nay theo giờ Việt Nam, bất kể máy người dùng đặt múi giờ nào. */
export const todayInVietnam = (now: Date = new Date()): SolarDate => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
};

export const sameDay = (a: SolarDate, b: SolarDate): boolean => a.year === b.year && a.month === b.month && a.day === b.day;

export const shiftMonth = ({ year, month }: { year: number; month: number }, delta: number) => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

/** "2026-10-16" ↔ SolarDate, dùng cho tham số trên URL. */
export const toIsoDate = ({ year, month, day }: SolarDate): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const parseIsoDate = (text: string | null): SolarDate | null => {
  const match = text?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (date.month < 1 || date.month > 12 || date.day < 1) return null;
  // Loại ngày không tồn tại (ví dụ 31/02) bằng cách đổi qua số Julius rồi so lại.
  return sameDay(fromJulianDay(julianDay(date)), date) ? date : null;
};

export const WEEKDAY_NAMES = ['', '', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'] as const;

export const weekdayName = (date: SolarDate): string => WEEKDAY_NAMES[mondayIndex(julianDay(date)) + 2]!;
