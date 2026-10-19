import { fromJulianDay, julianDay, type SolarDate } from '@gia-pha/lunar';
import { occurrencesBetween, type CalendarSource } from '@gia-pha/reminders';
import { occurrencesToIcs } from './ics';

/** Lịch đăng ký trải ra bao nhiêu ngày tới (và lùi lại vài ngày để không mất mục vừa qua). */
const DAYS_AHEAD = 400;
const DAYS_BACK = 7;

/** Dữ liệu `calendar_feed(token)` → nội dung .ics: giỗ, sinh nhật, kỷ niệm cưới, sự kiện, kèm chuông báo. */
export const feedToIcs = (source: CalendarSource, today: SolarDate, now = new Date()): string => {
  const jd = julianDay(today);
  const occurrences = occurrencesBetween(source, fromJulianDay(jd - DAYS_BACK), fromJulianDay(jd + DAYS_AHEAD));
  return occurrencesToIcs(occurrences, now, { calendarName: 'Gia Phả', alarms: true });
};
