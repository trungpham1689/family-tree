import { fromJulianDay, julianDay, lunarMonthLength, lunarToSolar, solarToLunar, type SolarDate } from './convert.ts';

/**
 * Ngày giỗ hằng năm, theo phong tục đã chốt (CONTEXT.md):
 * - Người mất trong tháng nhuận được giỗ vào tháng thường cùng số.
 * - Ngày 30 mà năm đó tháng ấy chỉ có 29 ngày thì giỗ vào ngày cuối tháng (29).
 */
export type LunarDayMonth = { day: number; month: number };

/** Ngày dương của ngày giỗ trong năm âm `lunarYear`. */
export const anniversaryInLunarYear = ({ day, month }: LunarDayMonth, lunarYear: number): SolarDate => {
  if (day < 1 || day > 30 || month < 1 || month > 12) {
    throw new RangeError(`Ngày âm không hợp lệ: ${day}/${month}`);
  }
  const length = lunarMonthLength(month, lunarYear, false) ?? 29;
  const solar = lunarToSolar({ year: lunarYear, month, day: Math.min(day, length), leap: false });
  if (!solar) throw new RangeError(`Không đổi được ${day}/${month} năm âm ${lunarYear}`);
  return solar;
};

/** Mọi lần giỗ rơi trong khoảng dương lịch [from, to], theo thứ tự thời gian. */
export const anniversariesBetween = (anniversary: LunarDayMonth, from: SolarDate, to: SolarDate): SolarDate[] => {
  const start = julianDay(from);
  const end = julianDay(to);
  const firstLunarYear = solarToLunar(from).year;
  const lastLunarYear = solarToLunar(to).year;
  const results: SolarDate[] = [];
  for (let year = firstLunarYear; year <= lastLunarYear; year += 1) {
    const jd = julianDay(anniversaryInLunarYear(anniversary, year));
    if (jd >= start && jd <= end) results.push(fromJulianDay(jd));
  }
  return results;
};

/** Lần giỗ kế tiếp tính từ ngày `from` (kể cả chính ngày đó). */
export const nextAnniversary = (anniversary: LunarDayMonth, from: SolarDate): SolarDate => {
  const lunarYear = solarToLunar(from).year;
  const thisYear = anniversaryInLunarYear(anniversary, lunarYear);
  return julianDay(thisYear) >= julianDay(from) ? thisYear : anniversaryInLunarYear(anniversary, lunarYear + 1);
};
