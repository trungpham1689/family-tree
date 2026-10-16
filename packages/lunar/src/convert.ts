import {
  jdFromDate,
  jdToDate,
  leapMonthOffset,
  lunarMonth11Start,
  newMoonDay,
  VIETNAM_TIME_ZONE,
} from './astronomy.ts';

/** Ngày dương lịch. Tháng 1–12. */
export type SolarDate = { year: number; month: number; day: number };

/** Ngày âm lịch. `leap` = true nếu thuộc tháng nhuận. */
export type LunarDate = { year: number; month: number; day: number; leap: boolean };

const floor = Math.floor;
const NEW_MOON_EPOCH = 2415021.076998695;
const SYNODIC_MONTH = 29.530588853;

/** Số ngày Julius (dùng để tính can chi, khoảng cách ngày…). */
export const julianDay = ({ year, month, day }: SolarDate): number => jdFromDate(day, month, year);

export const fromJulianDay = (jd: number): SolarDate => jdToDate(jd);

export const solarToLunar = (date: SolarDate): LunarDate => {
  const timeZone = VIETNAM_TIME_ZONE;
  const dayNumber = julianDay(date);
  // Ước lượng lần sóc bằng chu kỳ trung bình; trăng mới thật có thể đến muộn hơn,
  // nên lùi cho tới khi gặp lần sóc không sau ngày đang xét. Bản gốc chỉ lùi một lần
  // và cho ra "ngày 0" ở vài ngày hiếm (ví dụ 07/05/2054, 09/04/2062).
  let k = floor((dayNumber - NEW_MOON_EPOCH) / SYNODIC_MONTH) + 1;
  let monthStart = newMoonDay(k, timeZone);
  while (monthStart > dayNumber) {
    k -= 1;
    monthStart = newMoonDay(k, timeZone);
  }

  let a11 = lunarMonth11Start(date.year, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = date.year;
    a11 = lunarMonth11Start(date.year - 1, timeZone);
  } else {
    lunarYear = date.year + 1;
    b11 = lunarMonth11Start(date.year + 1, timeZone);
  }

  const day = dayNumber - monthStart + 1;
  const diff = floor((monthStart - a11) / 29);
  let leap = false;
  let month = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11, timeZone);
    if (diff >= leapDiff) {
      month = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (month > 12) month -= 12;
  if (month >= 11 && diff < 4) lunarYear -= 1;
  return { year: lunarYear, month, day, leap };
};

/** Bounds of the lunar year containing `month` (tháng 11 âm năm trước → tháng 11 năm nay). */
const month11Bounds = (month: number, year: number) =>
  month < 11
    ? { a11: lunarMonth11Start(year - 1), b11: lunarMonth11Start(year) }
    : { a11: lunarMonth11Start(year), b11: lunarMonth11Start(year + 1) };

/** Ngày đầu (số Julius) của một tháng âm; null nếu tháng nhuận đó không có trong năm. */
const lunarMonthStart = (month: number, year: number, leap: boolean): number | null => {
  const { a11, b11 } = month11Bounds(month, year);
  const k = floor(0.5 + (a11 - NEW_MOON_EPOCH) / SYNODIC_MONTH);
  let offset = month - 11;
  if (offset < 0) offset += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && month !== leapMonth) return null;
    if (leap || offset >= leapOff) offset += 1;
  } else if (leap) {
    return null;
  }
  return newMoonDay(k + offset);
};

/** Đổi âm sang dương. Trả về null nếu ngày âm không tồn tại (tháng nhuận sai, ngày 30 tháng thiếu). */
export const lunarToSolar = (date: LunarDate): SolarDate | null => {
  const start = lunarMonthStart(date.month, date.year, date.leap);
  if (start === null || date.day < 1) return null;
  if (date.day > lunarMonthLengthFromStart(start)) return null;
  return fromJulianDay(start + date.day - 1);
};

const lunarMonthLengthFromStart = (start: number): number => {
  const k = floor((start - NEW_MOON_EPOCH) / SYNODIC_MONTH + 0.5);
  const next = [newMoonDay(k), newMoonDay(k + 1), newMoonDay(k + 2)].find((day) => day > start);
  return next! - start;
};

/** Số ngày của một tháng âm (29 = tháng thiếu, 30 = tháng đủ); null nếu tháng không tồn tại. */
export const lunarMonthLength = (month: number, year: number, leap = false): number | null => {
  const start = lunarMonthStart(month, year, leap);
  return start === null ? null : lunarMonthLengthFromStart(start);
};

/** Tháng nhuận của năm âm `year` (1–12), hoặc null nếu năm không nhuận. */
export const leapMonthOf = (year: number): number | null => {
  for (let month = 1; month <= 12; month += 1) {
    if (lunarMonthStart(month, year, true) !== null) return month;
  }
  return null;
};
