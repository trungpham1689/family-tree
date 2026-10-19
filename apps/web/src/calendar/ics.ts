import { dateKey, type Occurrence } from '@gia-pha/reminders';

/** Lịch .ics (iCalendar, RFC 5545) từ các Occurrence đã tính — mỗi dịp là một sự kiện cả ngày. */

type SimpleDate = { year: number; month: number; day: number };

const pad = (value: number) => String(value).padStart(2, '0');

const icsDate = ({ year, month, day }: SimpleDate) => `${year}${pad(month)}${pad(day)}`;

/** Ngày hôm sau, dùng cho DTEND (loại trừ) của sự kiện cả ngày. */
const nextDay = ({ year, month, day }: SimpleDate): SimpleDate => {
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};

const escapeText = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

const stamp = (now: Date) =>
  `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

export type IcsOptions = {
  /** Tên lịch hiện trong app lịch; đặt thì coi là lịch đăng ký: app lịch tự tải lại mỗi 12 giờ. */
  calendarName?: string;
  /** Thêm chuông báo: 9:00 hôm trước và 7:00 sáng đúng ngày (sự kiện cả ngày nên tính từ 0:00). */
  alarms?: boolean;
};

export const occurrencesToIcs = (occurrences: readonly Occurrence[], now = new Date(), options: IcsOptions = {}): string => {
  const dtstamp = stamp(now);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gia Pha//vi', 'CALSCALE:GREGORIAN'];
  if (options.calendarName) {
    lines.push(`X-WR-CALNAME:${escapeText(options.calendarName)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H');
  }
  for (const occurrence of occurrences) {
    const uid = `${occurrence.kind}-${occurrence.personId ?? occurrence.eventId ?? 'x'}-${dateKey(occurrence.date)}@gia-pha`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDate(occurrence.date)}`,
      `DTEND;VALUE=DATE:${icsDate(nextDay(occurrence.date))}`,
      `SUMMARY:${escapeText(occurrence.title)}`,
    );
    if (occurrence.detail) lines.push(`DESCRIPTION:${escapeText(occurrence.detail)}`);
    if (options.alarms) {
      for (const trigger of ['-PT15H', 'PT7H']) {
        lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(occurrence.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
      }
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
};
