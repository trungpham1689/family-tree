import { anniversariesBetween, fromJulianDay, julianDay, lunarToSolar, type SolarDate } from '@gia-pha/lunar';

/**
 * Những gì hiện trên "Lịch của tôi": giỗ và sinh nhật suy ra từ hồ sơ Người (không lưu trùng),
 * cùng Sự kiện của các Gia phả. Thuần TypeScript để kiểm tra được mọi luật ngày tháng.
 */

export type OccurrenceKind = 'gio' | 'sinh_nhat' | 'su_kien';

export type CalendarPerson = {
  id: string;
  tree_id: string;
  full_name: string;
  is_deceased: boolean;
  anniversary_day: number | null;
  anniversary_month: number | null;
  /** Ngày sinh dương đầy đủ (YYYY-MM-DD), chỉ có khi biết đủ ngày. */
  birth_solar_date: string | null;
};

export type CalendarEvent = {
  id: string;
  tree_id: string;
  title: string;
  calendar: string;
  repeats_yearly: boolean;
  year: number | null;
  month: number;
  day: number;
  leap: boolean;
  start_time: string | null;
  location: string | null;
};

export type CalendarSource = {
  trees: readonly { id: string; name: string }[];
  persons: readonly CalendarPerson[];
  events: readonly CalendarEvent[];
};

export type Occurrence = {
  date: SolarDate;
  kind: OccurrenceKind;
  title: string;
  detail: string;
  treeId: string;
  treeName: string;
  personId?: string;
  eventId?: string;
};

const KIND_ORDER: Record<OccurrenceKind, number> = { gio: 0, sinh_nhat: 1, su_kien: 2 };
const collator = new Intl.Collator('vi');

const daysInSolarMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Ngày dương trong năm `year`; ngày không có trong tháng (29/2, 31/4…) lùi về ngày cuối tháng. */
const solarInYear = (year: number, month: number, day: number): SolarDate => ({
  year,
  month,
  day: Math.min(day, daysInSolarMonth(year, month)),
});

const parseIso = (iso: string): SolarDate | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
};

const timeText = (time: string | null) => (time ? time.slice(0, 5) : null);

export const occurrencesBetween = (source: CalendarSource, from: SolarDate, to: SolarDate): Occurrence[] => {
  const start = julianDay(from);
  const end = julianDay(to);
  const inRange = (date: SolarDate) => {
    const jd = julianDay(date);
    return jd >= start && jd <= end;
  };
  const treeName = new Map(source.trees.map((tree) => [tree.id, tree.name]));
  const results: Occurrence[] = [];

  for (const person of source.persons) {
    const base = { treeId: person.tree_id, treeName: treeName.get(person.tree_id) ?? '', personId: person.id };
    if (person.is_deceased && person.anniversary_day !== null && person.anniversary_month !== null) {
      const lunar = { day: person.anniversary_day, month: person.anniversary_month };
      for (const date of anniversariesBetween(lunar, from, to)) {
        results.push({
          ...base,
          date,
          kind: 'gio',
          title: `Giỗ ${person.full_name}`,
          detail: `Ngày ${lunar.day} tháng ${lunar.month} âm lịch`,
        });
      }
    }
    const birth = !person.is_deceased && person.birth_solar_date ? parseIso(person.birth_solar_date) : null;
    if (birth) {
      for (let year = from.year; year <= to.year; year += 1) {
        const date = solarInYear(year, birth.month, birth.day);
        if (year >= birth.year && inRange(date)) {
          results.push({
            ...base,
            date,
            kind: 'sinh_nhat',
            title: `Sinh nhật ${person.full_name}`,
            detail: year > birth.year ? `Tròn ${year - birth.year} tuổi` : 'Ngày sinh',
          });
        }
      }
    }
  }

  for (const event of source.events) {
    const base = { kind: 'su_kien' as const, title: event.title, treeId: event.tree_id, treeName: treeName.get(event.tree_id) ?? '', eventId: event.id };
    const detail = [
      event.calendar === 'am' ? `Ngày ${event.day} tháng ${event.month}${event.leap ? ' nhuận' : ''} âm lịch` : null,
      timeText(event.start_time),
      event.location,
    ]
      .filter(Boolean)
      .join(' · ');
    const dates: SolarDate[] = [];
    if (event.calendar === 'am') {
      if (event.repeats_yearly) {
        // Cùng luật với giỗ: tháng nhuận → tháng thường, ngày 30 thiếu → ngày cuối tháng.
        dates.push(...anniversariesBetween({ day: event.day, month: event.month }, from, to));
      } else if (event.year !== null) {
        const exact =
          lunarToSolar({ year: event.year, month: event.month, day: event.day, leap: event.leap }) ??
          lunarToSolar({ year: event.year, month: event.month, day: event.day - 1, leap: event.leap });
        if (exact && inRange(exact)) dates.push(exact);
      }
    } else if (event.repeats_yearly) {
      for (let year = from.year; year <= to.year; year += 1) {
        const date = solarInYear(year, event.month, event.day);
        if (inRange(date)) dates.push(date);
      }
    } else if (event.year !== null) {
      const date = solarInYear(event.year, event.month, event.day);
      if (inRange(date)) dates.push(date);
    }
    for (const date of dates) results.push({ ...base, date, detail });
  }

  return results.sort(
    (a, b) =>
      julianDay(a.date) - julianDay(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || collator.compare(a.title, b.title),
  );
};

/** "Sắp tới": từ hôm nay đến hết `days` ngày sau. */
export const upcoming = (source: CalendarSource, today: SolarDate, days = 30): Occurrence[] =>
  occurrencesBetween(source, today, fromJulianDay(julianDay(today) + days));

export const dateKey = ({ year, month, day }: SolarDate) => `${year}-${month}-${day}`;

/** Gom theo ngày để lịch tháng tra nhanh. */
export const groupByDay = (occurrences: readonly Occurrence[]): Map<string, Occurrence[]> => {
  const groups = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    const key = dateKey(occurrence.date);
    groups.set(key, [...(groups.get(key) ?? []), occurrence]);
  }
  return groups;
};
