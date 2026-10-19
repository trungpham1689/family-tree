import { fromJulianDay, julianDay, type SolarDate } from '@gia-pha/lunar';
import { dueReminders, tienThuongOf, type DueReminder } from './due-reminders.ts';
import { occurrencesBetween, type CalendarSource, type Occurrence } from './occurrences.ts';

/**
 * Chính sách nhắc nhở: ai được nhắc gì, vào lúc nào. Hai nơi dùng (adapter): chuông nhắc nhở trong app (theo từng tài khoản:
 * danh sách tắt nhắc giỗ, độ sớm nhắc, Tiên thường) và bản tin email (chung cho cả gia phả, theo cửa sổ ngày).
 * Giữ cả hai ở đây để quy tắc ngày tháng nằm một chỗ và test được không cần React hay database.
 */

/** Độ sớm nhắc lớn nhất cho phép (SPEC story 63: đúng ngày / trước 1, 3, 7 ngày). */
export const MAX_OFFSET_DAYS = 7;

export type TreeReminderPrefs = { offsetDays: number; tienThuong: boolean };

/**
 * Chuông nhắc nhở của một tài khoản: mọi giỗ, sinh nhật, kỷ niệm cưới, sự kiện đến hạn theo độ sớm của từng gia phả.
 * Giỗ của Người trong `mutedPersonIds` bị bỏ (cả Tiên thường của họ). Gia phả chưa đặt gì thì nhắc đúng ngày, không Tiên thường.
 */
export const bellReminders = (input: {
  source: CalendarSource;
  today: SolarDate;
  mutedPersonIds: ReadonlySet<string>;
  prefsByTree: ReadonlyMap<string, TreeReminderPrefs>;
}): DueReminder[] => {
  const { source, today, mutedPersonIds, prefsByTree } = input;
  // +1 ngày: giỗ của ngày mai cho ra Tiên thường vào hôm nay.
  const base = occurrencesBetween(source, today, fromJulianDay(julianDay(today) + MAX_OFFSET_DAYS + 1));
  const withTienThuong = tienThuongOf(base.filter((occurrence) => prefsByTree.get(occurrence.treeId)?.tienThuong));
  const offsetsByTree = new Map([...prefsByTree].map(([treeId, pref]) => [treeId, pref.offsetDays]));
  return dueReminders([...base, ...withTienThuong], today, mutedPersonIds, offsetsByTree);
};

/** Mọi thứ trong `days` ngày kể từ hôm nay (gồm hôm nay) cho bản tin email của một gia phả: không lọc theo tài khoản. */
export const digestOccurrences = (source: CalendarSource, today: SolarDate, days: number): Occurrence[] =>
  occurrencesBetween(source, today, fromJulianDay(julianDay(today) + days - 1));
