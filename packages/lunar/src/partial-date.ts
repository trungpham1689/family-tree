import type { LunarDayMonth } from './anniversary.ts';
import { yearCanChi } from './can-chi.ts';
import { fromJulianDay, julianDay, lunarMonthLength, lunarToSolar, solarToLunar } from './convert.ts';

/**
 * Ngày không đầy đủ (CONTEXT.md): chỉ biết năm, hoặc tháng-năm, hoặc đủ ngày-tháng-năm;
 * ghi theo âm lịch hoặc dương lịch; có thể kèm "khoảng".
 */
export type Calendar = 'duong' | 'am';

type Base = { calendar: Calendar; year: number; approximate: boolean };

export type PartialDate =
  | (Base & { precision: 'nam' })
  | (Base & { precision: 'thang'; month: number; leap: boolean })
  | (Base & { precision: 'ngay'; month: number; day: number; leap: boolean });

const MIN_YEAR = 1;
const MAX_YEAR = 2200;
const MAX_SOLAR_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeapSolarYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Kiểm tra ngày có tồn tại không; trả về câu báo lỗi tiếng Việt, hoặc null nếu hợp lệ. */
export const validatePartialDate = (date: PartialDate): string | null => {
  if (!Number.isInteger(date.year) || date.year < MIN_YEAR || date.year > MAX_YEAR) {
    return `Năm phải trong khoảng ${MIN_YEAR}–${MAX_YEAR}.`;
  }
  if (date.precision === 'nam') return null;
  if (!Number.isInteger(date.month) || date.month < 1 || date.month > 12) return 'Tháng phải từ 1 đến 12.';
  if (date.calendar === 'duong' && date.leap) return 'Dương lịch không có tháng nhuận.';
  if (date.calendar === 'am' && date.leap && lunarMonthLength(date.month, date.year, true) === null) {
    return `Năm âm ${date.year} không có tháng ${date.month} nhuận.`;
  }
  if (date.precision === 'thang') return null;

  if (!Number.isInteger(date.day) || date.day < 1) return 'Ngày không hợp lệ.';
  if (date.calendar === 'duong') {
    const max = date.month === 2 && !isLeapSolarYear(date.year) ? 28 : MAX_SOLAR_DAYS[date.month - 1]!;
    return date.day > max ? `Tháng ${date.month}/${date.year} chỉ có ${max} ngày.` : null;
  }
  const length = lunarMonthLength(date.month, date.year, date.leap);
  if (length !== null && date.day > length) {
    return `Tháng ${date.month}${date.leap ? ' nhuận' : ''} âm năm ${date.year} chỉ có ${length} ngày.`;
  }
  return date.day > 30 ? 'Tháng âm có tối đa 30 ngày.' : null;
};

/** Đổi sang lịch còn lại; chỉ làm được khi biết đủ ngày-tháng-năm. */
export const toOtherCalendar = (date: PartialDate): PartialDate | null => {
  if (date.precision !== 'ngay' || validatePartialDate(date) !== null) return null;
  if (date.calendar === 'duong') {
    const lunar = solarToLunar(date);
    return { calendar: 'am', precision: 'ngay', ...lunar, approximate: date.approximate };
  }
  const solar = lunarToSolar(date);
  return solar ? { calendar: 'duong', precision: 'ngay', ...solar, leap: false, approximate: date.approximate } : null;
};

/**
 * Ngày-tháng âm dùng làm ngày giỗ, suy từ ngày mất; null nếu chưa đủ thông tin.
 * Theo tục lệ: giỗ vào ngày trước ngày mất 1 ngày (lệch múi giờ mất trước nửa đêm).
 */
export const anniversaryFromDeath = (death: PartialDate): LunarDayMonth | null => {
  if (death.precision !== 'ngay' || validatePartialDate(death) !== null) return null;
  const solar = death.calendar === 'duong' ? death : lunarToSolar(death);
  if (!solar) return null;
  const dayBefore = fromJulianDay(julianDay(solar) - 1);
  const lunar = solarToLunar(dayBefore);
  return { day: lunar.day, month: lunar.month };
};

/** Hiển thị ngắn gọn: "khoảng 1890", "3/1890 ÂL (năm Canh Dần)", "12/3 nhuận/1890 ÂL (năm Canh Dần)", "05/10/1945". */
export const formatPartialDate = (date: PartialDate): string => {
  const prefix = date.approximate ? 'khoảng ' : '';
  const suffix = date.calendar === 'am' ? ` ÂL (năm ${yearCanChi(date.year)})` : '';
  const pad = (value: number) => (date.calendar === 'duong' ? String(value).padStart(2, '0') : String(value));
  switch (date.precision) {
    case 'nam':
      return `${prefix}${date.year}${suffix}`;
    case 'thang':
      return `${prefix}${pad(date.month)}${date.leap ? ' nhuận' : ''}/${date.year}${suffix}`;
    case 'ngay':
      return `${prefix}${pad(date.day)}/${pad(date.month)}${date.leap ? ' nhuận' : ''}/${date.year}${suffix}`;
  }
};
