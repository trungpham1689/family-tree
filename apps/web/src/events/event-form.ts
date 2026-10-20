import { lunarToSolar } from '@gia-pha/lunar';
import type { EventFields, TreeEvent } from '../data/calendar';

export type EventRepeat = 'once' | 'monthly' | 'yearly';

export const REPEAT_LABELS: Record<EventRepeat, string> = { once: 'Một lần', monthly: 'Hằng tháng', yearly: 'Hằng năm' };

export type EventFormValues = {
  title: string;
  calendar: 'duong' | 'am';
  repeat: EventRepeat;
  day: string;
  month: string;
  /** Bắt buộc: một lần là năm tổ chức, lặp là năm bắt đầu. */
  year: string;
  leap: boolean;
  time: string;
  location: string;
  /** Mô tả sự kiện (cột `note`). */
  note: string;
  /** Người chủ trì (id), hoặc null. */
  hostPersonId: string | null;
  showInPhaKy: boolean;
  showInTimeline: boolean;
};

export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>;

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: '',
  calendar: 'am',
  repeat: 'yearly',
  day: '',
  month: '',
  year: '',
  leap: false,
  time: '',
  location: '',
  note: '',
  hostPersonId: null,
  showInPhaKy: true,
  // Dòng thời gian xếp theo năm, mà sự kiện lặp mặc định không có năm: người dùng tự bật khi đã nhập năm.
  showInTimeline: false,
};

const intIn = (text: string, min: number, max: number): number | null => {
  const value = Number(text.trim());
  return text.trim() !== '' && Number.isInteger(value) && value >= min && value <= max ? value : null;
};

const daysInSolarMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const text = (value: string) => (value.trim() === '' ? null : value.trim());

export const parseEventForm = (
  values: EventFormValues,
): { ok: true; fields: EventFields } | { ok: false; errors: EventFormErrors } => {
  const errors: EventFormErrors = {};
  const title = values.title.trim();
  if (!title) errors.title = 'Hãy đặt tên sự kiện, ví dụ "Họp họ đầu xuân".';

  const isLunar = values.calendar === 'am';
  const monthly = values.repeat === 'monthly';
  const once = values.repeat === 'once';
  const month = monthly ? null : intIn(values.month, 1, 12);
  if (!monthly && month === null) errors.month = 'Tháng từ 1 đến 12.';
  const day = intIn(values.day, 1, isLunar ? 30 : 31);
  if (day === null) errors.day = isLunar ? 'Ngày âm từ 1 đến 30.' : 'Ngày từ 1 đến 31.';

  // Mọi sự kiện đều có năm (một lần: năm tổ chức; lặp: năm bắt đầu) để xem lại theo thời gian và đưa vào Dòng thời gian.
  const year = intIn(values.year, 1900, 2200);
  if (year === null) errors.year = once ? 'Sự kiện một lần cần năm, ví dụ 2027.' : 'Cần năm bắt đầu, ví dụ 2027.';
  const leap = isLunar && !monthly && values.leap;

  if (once && year !== null && month !== null && day !== null) {
    if (isLunar) {
      if (!lunarToSolar({ year, month, day, leap })) {
        errors.day = leap ? `Năm ${year} không có ngày này trong tháng ${month} nhuận.` : `Năm ${year} tháng ${month} âm không có ngày ${day}.`;
      }
    } else if (day > daysInSolarMonth(year, month)) {
      errors.day = `Tháng ${month}/${year} không có ngày ${day}.`;
    }
  } else if (!isLunar && !monthly && month !== null && day !== null && day > daysInSolarMonth(2024, month)) {
    errors.day = `Tháng ${month} không có ngày ${day}.`;
  }

  const time = values.time.trim();
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.time = 'Giờ dạng 08:30.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    fields: {
      title,
      calendar: values.calendar,
      repeats_yearly: values.repeat === 'yearly',
      repeats_monthly: monthly,
      year,
      month,
      day: day!,
      leap,
      start_time: time || null,
      location: text(values.location),
      note: text(values.note),
      host_person_id: values.hostPersonId,
      show_in_pha_ky: values.showInPhaKy,
      show_in_timeline: values.showInTimeline,
    },
  };
};

export const eventToFormValues = (event: TreeEvent): EventFormValues => ({
  title: event.title,
  calendar: event.calendar === 'duong' ? 'duong' : 'am',
  repeat: event.repeats_monthly ? 'monthly' : event.repeats_yearly ? 'yearly' : 'once',
  day: String(event.day),
  month: event.month?.toString() ?? '',
  year: event.year?.toString() ?? '',
  leap: event.leap,
  time: event.start_time?.slice(0, 5) ?? '',
  location: event.location ?? '',
  note: event.note ?? '',
  hostPersonId: event.host_person_id,
  showInPhaKy: event.show_in_pha_ky,
  showInTimeline: event.show_in_timeline,
});

type DescribableEvent = Pick<TreeEvent, 'calendar' | 'repeats_yearly' | 'year' | 'month' | 'day' | 'leap' | 'start_time' | 'location'> & {
  repeats_monthly?: boolean;
};

/** "Ngày 10 tháng 1 âm lịch, hằng năm · 08:30 · Nhà thờ họ" */
export const describeEvent = (event: DescribableEvent) => {
  const since = event.year ? ` (từ ${event.year})` : '';
  const when = event.repeats_monthly
    ? event.calendar === 'am'
      ? `Ngày ${event.day} âm lịch, hằng tháng${since}`
      : `Ngày ${event.day}, hằng tháng${since}`
    : event.calendar === 'am'
      ? event.repeats_yearly
        ? `Ngày ${event.day} tháng ${event.month}${event.leap ? ' nhuận' : ''} âm lịch, hằng năm${since}`
        : `Ngày ${event.day} tháng ${event.month}${event.leap ? ' nhuận' : ''} âm lịch năm ${event.year}`
      : event.repeats_yearly
        ? `Ngày ${event.day}/${event.month}, hằng năm${since}`
        : `Ngày ${event.day}/${event.month}/${event.year}`;
  return [when, event.start_time?.slice(0, 5), event.location].filter(Boolean).join(' · ');
};
