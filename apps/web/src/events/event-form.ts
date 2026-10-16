import { lunarToSolar } from '@gia-pha/lunar';
import type { EventFields, TreeEvent } from '../data/calendar';

export type EventFormValues = {
  title: string;
  calendar: 'duong' | 'am';
  repeatsYearly: boolean;
  day: string;
  month: string;
  year: string;
  leap: boolean;
  time: string;
  location: string;
  note: string;
};

export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>;

export const EMPTY_EVENT_FORM: EventFormValues = {
  title: '',
  calendar: 'am',
  repeatsYearly: true,
  day: '',
  month: '',
  year: '',
  leap: false,
  time: '',
  location: '',
  note: '',
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
  const month = intIn(values.month, 1, 12);
  if (month === null) errors.month = 'Tháng từ 1 đến 12.';
  const day = intIn(values.day, 1, isLunar ? 30 : 31);
  if (day === null) errors.day = isLunar ? 'Ngày âm từ 1 đến 30.' : 'Ngày từ 1 đến 31.';

  let year: number | null = null;
  if (!values.repeatsYearly) {
    year = intIn(values.year, 1900, 2200);
    if (year === null) errors.year = 'Sự kiện một lần cần năm, ví dụ 2027.';
  }
  const leap = isLunar && values.leap;

  if (!values.repeatsYearly && year !== null && month !== null && day !== null) {
    if (isLunar) {
      if (!lunarToSolar({ year, month, day, leap })) {
        errors.day = leap ? `Năm ${year} không có ngày này trong tháng ${month} nhuận.` : `Năm ${year} tháng ${month} âm không có ngày ${day}.`;
      }
    } else if (day > daysInSolarMonth(year, month)) {
      errors.day = `Tháng ${month}/${year} không có ngày ${day}.`;
    }
  } else if (!isLunar && month !== null && day !== null && day > daysInSolarMonth(2024, month)) {
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
      repeats_yearly: values.repeatsYearly,
      year,
      month: month!,
      day: day!,
      leap,
      start_time: time || null,
      location: text(values.location),
      note: text(values.note),
    },
  };
};

export const eventToFormValues = (event: TreeEvent): EventFormValues => ({
  title: event.title,
  calendar: event.calendar === 'duong' ? 'duong' : 'am',
  repeatsYearly: event.repeats_yearly,
  day: String(event.day),
  month: String(event.month),
  year: event.year?.toString() ?? '',
  leap: event.leap,
  time: event.start_time?.slice(0, 5) ?? '',
  location: event.location ?? '',
  note: event.note ?? '',
});

/** "Ngày 10 tháng Giêng âm lịch, hằng năm · 08:30 · Nhà thờ họ" */
export const describeEvent = (event: Pick<TreeEvent, 'calendar' | 'repeats_yearly' | 'year' | 'month' | 'day' | 'leap' | 'start_time' | 'location'>) => {
  const lunar = `Ngày ${event.day} tháng ${event.month}${event.leap ? ' nhuận' : ''} âm lịch`;
  const when =
    event.calendar === 'am'
      ? event.repeats_yearly
        ? `${lunar}, hằng năm`
        : `${lunar} năm ${event.year}`
      : event.repeats_yearly
        ? `Ngày ${event.day}/${event.month}, hằng năm`
        : `Ngày ${event.day}/${event.month}/${event.year}`;
  return [when, event.start_time?.slice(0, 5), event.location].filter(Boolean).join(' · ');
};
