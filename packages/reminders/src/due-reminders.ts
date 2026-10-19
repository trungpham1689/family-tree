import { julianDay } from '@gia-pha/lunar';
import type { Occurrence } from './occurrences';

/**
 * Nhắc nhở đến hạn, suy trực tiếp từ các occurrence (giỗ/sinh nhật/Sự kiện) đã có, không lưu trùng:
 * - Giỗ mặc định nhắc cho mọi Người; ai có trong Danh sách đã tắt (mutedPersonIds) thì bỏ qua.
 * - Sinh nhật và Sự kiện không lọc theo danh sách.
 * - "Đến hạn" là từ hôm nay đến hết `offset` ngày tới, offset lấy theo từng Gia phả (0 = đúng ngày).
 */

export type DueReminder = { key: string; occurrence: Occurrence; dueInDays: number };

/** Khoá ổn định của một occurrence, dùng làm khoá "đã đọc" (không có dòng riêng cho mỗi nhắc nhở). */
export const notificationKey = (occurrence: Occurrence): string =>
  `${occurrence.kind}:${occurrence.personId ?? occurrence.eventId ?? ''}:${occurrence.date.year}-${occurrence.date.month}-${occurrence.date.day}`;

export const dueReminders = (
  occurrences: readonly Occurrence[],
  today: { year: number; month: number; day: number },
  mutedPersonIds: ReadonlySet<string>,
  offsetDaysByTree: ReadonlyMap<string, number>,
): DueReminder[] => {
  const todayJd = julianDay(today);
  return occurrences
    .filter((occurrence) => occurrence.kind !== 'gio' || occurrence.personId === undefined || !mutedPersonIds.has(occurrence.personId))
    .flatMap((occurrence) => {
      const dueInDays = julianDay(occurrence.date) - todayJd;
      const offset = offsetDaysByTree.get(occurrence.treeId) ?? 0;
      return dueInDays >= 0 && dueInDays <= offset ? [{ key: notificationKey(occurrence), occurrence, dueInDays }] : [];
    })
    .sort((a, b) => a.dueInDays - b.dueInDays);
};
