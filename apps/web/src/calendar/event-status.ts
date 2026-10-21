import { julianDay, type SolarDate } from '@gia-pha/lunar';
import { weekdayName } from './month-grid';

/** Trong vòng bao nhiêu ngày tới thì coi là "gần đến ngày", cần nổi bật. */
export const NEAR_DAYS = 7;

export type EventState = 'past' | 'today' | 'near' | 'later';

export type EventStatus = { state: EventState; days: number; label: string };

/** Trạng thái của một ngày so với hôm nay: đã qua, hôm nay, trong NEAR_DAYS ngày tới, hoặc xa hơn. */
export const eventStatus = (date: SolarDate, today: SolarDate): EventStatus => {
  const days = julianDay(date) - julianDay(today);
  if (days < 0) return { state: 'past', days, label: `Đã qua · ${-days} ngày trước` };
  if (days === 0) return { state: 'today', days, label: 'Hôm nay' };
  return { state: days <= NEAR_DAYS ? 'near' : 'later', days, label: `Còn ${days} ngày` };
};

/** Tách danh sách (đã sắp theo ngày tăng dần): từ hôm nay trở đi giữ nguyên thứ tự, đã qua xếp mới nhất trước. */
export const partitionByToday = <T extends { date: SolarDate }>(items: readonly T[], today: SolarDate): { upcoming: T[]; past: T[] } => {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const item of items) (eventStatus(item.date, today).state === 'past' ? past : upcoming).push(item);
  return { upcoming, past: past.reverse() };
};

/** "T4", "CN": tên thứ rút gọn cho ô ngày. */
export const weekdayShort = (date: SolarDate): string => SHORT_WEEKDAY[weekdayName(date)] ?? weekdayName(date);

const SHORT_WEEKDAY: Record<string, string> = {
  'Thứ Hai': 'T2',
  'Thứ Ba': 'T3',
  'Thứ Tư': 'T4',
  'Thứ Năm': 'T5',
  'Thứ Sáu': 'T6',
  'Thứ Bảy': 'T7',
  'Chủ nhật': 'CN',
};
