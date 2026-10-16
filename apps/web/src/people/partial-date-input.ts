import { toOtherCalendar, validatePartialDate, type Calendar, type PartialDate } from '@gia-pha/lunar';

export type Precision = PartialDate['precision'];

/** Giá trị thô của ô nhập Ngày không đầy đủ. Năm để trống nghĩa là không biết ngày này. */
export type DateInput = {
  calendar: Calendar;
  precision: Precision;
  year: string;
  month: string;
  day: string;
  leap: boolean;
  approximate: boolean;
};

export const EMPTY_DATE_INPUT: DateInput = {
  calendar: 'duong',
  precision: 'nam',
  year: '',
  month: '',
  day: '',
  leap: false,
  approximate: false,
};

/** Các cột lưu một Ngày không đầy đủ (tiền tố birth_ hoặc death_ được thêm khi ghi). */
export type StoredDate = {
  calendar: Calendar;
  precision: Precision | null;
  year: number | null;
  month: number | null;
  day: number | null;
  leap: boolean;
  approximate: boolean;
  /** Ngày dương đầy đủ (YYYY-MM-DD) khi biết đủ ngày; dùng cho sinh nhật, sắp xếp. */
  solarDate: string | null;
};

export const NO_DATE: StoredDate = {
  calendar: 'duong',
  precision: null,
  year: null,
  month: null,
  day: null,
  leap: false,
  approximate: false,
  solarDate: null,
};

const toInt = (text: string): number | null => (/^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : null);

const isoOf = ({ year, month, day }: { year: number; month: number; day: number }) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Ô nhập → Ngày không đầy đủ; null nếu bỏ trống; chuỗi lỗi nếu sai. */
export const parseDateInput = (input: DateInput): PartialDate | null | string => {
  if (input.year.trim() === '') return null;
  const year = toInt(input.year);
  if (year === null) return 'Năm phải là số, ví dụ 1925.';
  const base = { calendar: input.calendar, year, approximate: input.approximate };

  let date: PartialDate;
  if (input.precision === 'nam') {
    date = { ...base, precision: 'nam' };
  } else {
    const month = toInt(input.month);
    if (month === null) return 'Hãy nhập tháng.';
    const leap = input.calendar === 'am' && input.leap;
    if (input.precision === 'thang') {
      date = { ...base, precision: 'thang', month, leap };
    } else {
      const day = toInt(input.day);
      if (day === null) return 'Hãy nhập ngày.';
      date = { ...base, precision: 'ngay', month, day, leap };
    }
  }
  return validatePartialDate(date) ?? date;
};

/** Ngày dương đầy đủ của một Ngày không đầy đủ, nếu biết đủ ngày. */
export const solarIsoOf = (date: PartialDate): string | null => {
  if (date.precision !== 'ngay') return null;
  if (date.calendar === 'duong') return isoOf(date);
  const solar = toOtherCalendar(date);
  return solar && solar.precision === 'ngay' ? isoOf(solar) : null;
};

export const toStoredDate = (date: PartialDate | null): StoredDate => {
  if (!date) return NO_DATE;
  return {
    calendar: date.calendar,
    precision: date.precision,
    year: date.year,
    month: date.precision === 'nam' ? null : date.month,
    day: date.precision === 'ngay' ? date.day : null,
    leap: date.precision === 'nam' ? false : date.leap,
    approximate: date.approximate,
    solarDate: solarIsoOf(date),
  };
};

export const fromStoredDate = (stored: StoredDate): PartialDate | null => {
  if (stored.year === null || stored.precision === null) return null;
  const base = { calendar: stored.calendar, year: stored.year, approximate: stored.approximate };
  if (stored.precision === 'nam' || stored.month === null) return { ...base, precision: 'nam' };
  if (stored.precision === 'thang' || stored.day === null) return { ...base, precision: 'thang', month: stored.month, leap: stored.leap };
  return { ...base, precision: 'ngay', month: stored.month, day: stored.day, leap: stored.leap };
};

export const dateInputFromStored = (stored: StoredDate): DateInput => ({
  calendar: stored.calendar,
  precision: stored.precision ?? 'nam',
  year: stored.year?.toString() ?? '',
  month: stored.month?.toString() ?? '',
  day: stored.day?.toString() ?? '',
  leap: stored.leap,
  approximate: stored.approximate,
});
