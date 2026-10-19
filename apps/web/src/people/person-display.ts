import { formatPartialDate, nextAnniversary, toOtherCalendar, type SolarDate } from '@gia-pha/lunar';
import { fromStoredDate, type StoredDate } from './partial-date-input';

type LifespanInput = { birth_year: number | null; death_year: number | null; is_deceased: boolean };

/** Chữ cái đại diện khi chưa có ảnh: chữ đầu của từ cuối trong họ tên (ví dụ "Phạm Cự" → "C"). */
export const nameInitial = (fullName: string): string => {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const last = words.at(-1);
  return last ? last.charAt(0).toUpperCase() : '?';
};

/** Dòng năm sinh–mất ngắn gọn hiển thị dưới tên một Người. */
export const lifespanText = ({ birth_year: birth, death_year: death, is_deceased: deceased }: LifespanInput): string => {
  if (birth !== null && death !== null) return `${birth} – ${death}`;
  if (birth !== null) return deceased ? `${birth} – ?` : `Sinh ${birth}`;
  if (death !== null) return `? – ${death}`;
  return deceased ? 'Đã mất' : '';
};

/**
 * Hưởng thọ theo cách gia phả Việt thường ghi (tuổi mụ): năm mất − năm sinh + 1.
 * Null khi chưa đủ năm sinh và năm mất.
 */
export const ageAtDeath = ({ birth_year: birth, death_year: death, is_deceased: deceased }: LifespanInput): number | null =>
  deceased && birth !== null && death !== null ? death - birth + 1 : null;

/** Dưới 60 tuổi ghi "Hưởng dương", từ 60 trở lên ghi "Hưởng thọ" (theo tục ghi gia phả Việt). */
export const deathAgeLabel = (age: number): string => (age >= 60 ? 'Hưởng thọ' : 'Hưởng dương');

/** Tuổi hiện tại (tuổi mụ) của người còn sống, tính từ năm sinh. Null khi chưa biết năm sinh hoặc đã mất. */
export const currentAge = ({ birth_year: birth, is_deceased: deceased }: LifespanInput, todayYear: number): number | null =>
  !deceased && birth !== null ? todayYear - birth + 1 : null;

/** "05/10/1945 — tức 20/9/1945 ÂL (năm Ất Dậu)" — kèm lịch còn lại khi biết đủ ngày. */
export const describeDate = (stored: StoredDate): string | null => {
  const date = fromStoredDate(stored);
  if (!date) return null;
  const main = formatPartialDate(date);
  const other = toOtherCalendar(date);
  if (!other) return main;
  const otherText = formatPartialDate({ ...other, approximate: false });
  return `${main} — tức ${otherText}${other.calendar === 'am' ? '' : ' dương lịch'}`;
};

const formatSolar = ({ day, month, year }: SolarDate) => `${day}/${month}/${year}`;

/** "Ngày 7 tháng 8 âm lịch — lần tới: 17/9/2026". */
export const anniversaryText = (
  anniversary: { day: number | null; month: number | null },
  today: SolarDate,
): string | null => {
  if (anniversary.day === null || anniversary.month === null) return null;
  const next = nextAnniversary({ day: anniversary.day, month: anniversary.month }, today);
  return `Ngày ${anniversary.day} tháng ${anniversary.month} âm lịch — lần tới: ${formatSolar(next)}`;
};
