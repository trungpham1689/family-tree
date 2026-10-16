import { julianDay, type LunarDate, type SolarDate } from './convert.ts';

export const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'] as const;
export const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'] as const;

const at = <T>(list: readonly T[], index: number): T => list[((index % list.length) + list.length) % list.length]!;
const name = (can: number, chi: number): string => `${at(CAN, can)} ${at(CHI, chi)}`;

/** Can chi của năm âm, ví dụ 2026 → "Bính Ngọ". */
export const yearCanChi = (lunarYear: number): string => name(lunarYear + 6, lunarYear + 8);

/** Can chi của tháng âm. Tháng Giêng luôn là tháng Dần; tháng nhuận mang can chi của tháng thường cùng số. */
export const monthCanChi = ({ year, month }: Pick<LunarDate, 'year' | 'month'>): string =>
  name(year * 12 + month + 3, month + 1);

/** Can chi của ngày (theo ngày dương). */
export const dayCanChi = (date: SolarDate): string => {
  const jd = julianDay(date);
  return name(jd + 9, jd + 1);
};

/** Can chi của giờ Tý (giờ đầu) của ngày. */
export const firstHourCanChi = (date: SolarDate): string => name((julianDay(date) - 1) * 2, 0);

// Mỗi chuỗi ứng với chi của ngày (Tý/Ngọ, Sửu/Mùi, …): '1' là giờ hoàng đạo, theo thứ tự giờ Tý → Hợi.
const ZODIAC_HOURS = ['110100101100', '001101001011', '110011010010', '101100110100', '001011001101', '010010110011'] as const;

export type ZodiacHour = { chi: string; from: number; to: number };

/** Sáu giờ hoàng đạo trong ngày, mỗi giờ gồm tên chi và khung giờ (ví dụ Tý 23–1). */
export const zodiacHours = (date: SolarDate): ZodiacHour[] => {
  const chiOfDay = (julianDay(date) + 1) % 12;
  const pattern = ZODIAC_HOURS[chiOfDay % 6]!;
  return [...pattern].flatMap((flag, index) =>
    flag === '1' ? [{ chi: at(CHI, index), from: (index * 2 + 23) % 24, to: (index * 2 + 1) % 24 }] : [],
  );
};
