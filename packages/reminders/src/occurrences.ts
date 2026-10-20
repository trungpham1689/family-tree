import { anniversariesBetween, fromJulianDay, julianDay, lunarToSolar, solarToLunar, type SolarDate } from '@gia-pha/lunar';

/**
 * Những gì hiện trên "Lịch của tôi": giỗ và sinh nhật suy ra từ hồ sơ Người (không lưu trùng),
 * cùng Sự kiện của các Gia phả. Thuần TypeScript để kiểm tra được mọi luật ngày tháng.
 */

export type OccurrenceKind = 'gio' | 'sinh_nhat' | 'cuoi' | 'su_kien';

export type CalendarPerson = {
  id: string;
  tree_id: string;
  full_name: string;
  is_deceased: boolean;
  anniversary_day: number | null;
  anniversary_month: number | null;
  /** Ngày sinh dương đầy đủ (YYYY-MM-DD), chỉ có khi biết đủ ngày. */
  birth_solar_date: string | null;
  /** Ngày mất dương đầy đủ (YYYY-MM-DD); chỉ dùng cho "Ngày này năm xưa". */
  death_solar_date?: string | null;
};

/** Một cuộc hôn phối đã biết đủ ngày-tháng-năm cưới (chưa ly hôn): để nhắc Kỷ niệm cưới. */
export type CalendarMarriage = {
  id: string;
  tree_id: string;
  /** Một trong hai người, để bấm vào dẫn về hồ sơ. */
  partner_a: string;
  /** "Chồng & Vợ". */
  names: string;
  marriage_year: number | null;
  marriage_month: number | null;
  marriage_day: number | null;
};

export type CalendarEvent = {
  id: string;
  tree_id: string;
  title: string;
  calendar: string;
  repeats_yearly: boolean;
  /** Lặp mỗi tháng vào `day` (không có `month`). Thiếu thì coi là false (dữ liệu cũ). */
  repeats_monthly?: boolean;
  /** Sự kiện một lần: năm tổ chức. Sự kiện lặp: năm bắt đầu (null: từ trước tới nay). */
  year: number | null;
  /** Null chỉ khi lặp hằng tháng. */
  month: number | null;
  day: number;
  leap: boolean;
  start_time: string | null;
  location: string | null;
};

export type CalendarSource = {
  trees: readonly { id: string; name: string }[];
  persons: readonly CalendarPerson[];
  events: readonly CalendarEvent[];
  marriages?: readonly CalendarMarriage[];
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

const KIND_ORDER: Record<OccurrenceKind, number> = { gio: 0, sinh_nhat: 1, cuoi: 2, su_kien: 3 };
const collator = new Intl.Collator('vi');

const daysInSolarMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Ngày dương trong năm `year`; ngày không có trong tháng (29/2, 31/4…) lùi về ngày cuối tháng. */
const solarInYear = (year: number, month: number, day: number): SolarDate => ({
  year,
  month,
  day: Math.min(day, daysInSolarMonth(year, month)),
});

/**
 * Các ngày `day` hằng tháng trong khoảng [from, to]. Dương lịch: ngày không có trong tháng (31/2…) lùi về ngày cuối tháng.
 * Âm lịch: duyệt từng ngày, lấy ngày âm = `day`; tháng thiếu (29 ngày) thì ngày 30 rơi vào ngày cuối tháng; tháng nhuận cũng tính.
 */
const monthlyBetween = (calendar: 'am' | 'duong', day: number, from: SolarDate, to: SolarDate): SolarDate[] => {
  const dates: SolarDate[] = [];
  if (calendar === 'duong') {
    for (let year = from.year, month = from.month; year < to.year || (year === to.year && month <= to.month); ) {
      const date = solarInYear(year, month, day);
      if (julianDay(date) >= julianDay(from) && julianDay(date) <= julianDay(to)) dates.push(date);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return dates;
  }
  for (let jd = julianDay(from); jd <= julianDay(to); jd += 1) {
    const lunar = solarToLunar(fromJulianDay(jd));
    const isLastDay = solarToLunar(fromJulianDay(jd + 1)).day === 1;
    if (lunar.day === day || (isLastDay && lunar.day < day)) dates.push(fromJulianDay(jd));
  }
  return dates;
};

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

  for (const marriage of source.marriages ?? []) {
    const { marriage_year: marriedYear, marriage_month: month, marriage_day: day } = marriage;
    if (marriedYear === null || month === null || day === null) continue;
    for (let year = from.year; year <= to.year; year += 1) {
      const date = solarInYear(year, month, day);
      if (year > marriedYear && inRange(date)) {
        results.push({
          date,
          kind: 'cuoi',
          title: `Kỷ niệm cưới ${marriage.names}`,
          detail: `Tròn ${year - marriedYear} năm ngày cưới`,
          treeId: marriage.tree_id,
          treeName: treeName.get(marriage.tree_id) ?? '',
          personId: marriage.partner_a,
        });
      }
    }
  }

  for (const event of source.events) {
    const base = { kind: 'su_kien' as const, title: event.title, treeId: event.tree_id, treeName: treeName.get(event.tree_id) ?? '', eventId: event.id };
    const monthly = event.repeats_monthly === true;
    const month = event.month;
    const detail = [
      event.calendar === 'am' ? (monthly ? `Ngày ${event.day} âm lịch hằng tháng` : `Ngày ${event.day} tháng ${month}${event.leap ? ' nhuận' : ''} âm lịch`) : null,
      monthly && event.calendar !== 'am' ? `Ngày ${event.day} hằng tháng` : null,
      timeText(event.start_time),
      event.location,
    ]
      .filter(Boolean)
      .join(' · ');
    const dates: SolarDate[] = [];
    if (monthly) {
      dates.push(...monthlyBetween(event.calendar === 'am' ? 'am' : 'duong', event.day, from, to));
    } else if (month === null) {
      // Không hợp lệ (database cấm): bỏ qua thay vì đoán.
    } else if (event.calendar === 'am') {
      if (event.repeats_yearly) {
        // Cùng luật với giỗ: tháng nhuận → tháng thường, ngày 30 thiếu → ngày cuối tháng.
        dates.push(...anniversariesBetween({ day: event.day, month }, from, to));
      } else if (event.year !== null) {
        const exact =
          lunarToSolar({ year: event.year, month, day: event.day, leap: event.leap }) ??
          lunarToSolar({ year: event.year, month, day: event.day - 1, leap: event.leap });
        if (exact && inRange(exact)) dates.push(exact);
      }
    } else if (event.repeats_yearly) {
      for (let year = from.year; year <= to.year; year += 1) {
        const date = solarInYear(year, month, event.day);
        if (inRange(date)) dates.push(date);
      }
    } else if (event.year !== null) {
      const date = solarInYear(event.year, month, event.day);
      if (inRange(date)) dates.push(date);
    }
    // Sự kiện lặp có năm bắt đầu thì không xuất hiện trước năm đó. Sự kiện âm lịch tính theo năm ÂM (tháng Chạp âm
    // của năm âm 2023 rơi vào tháng 1 dương 2024 vẫn thuộc năm 2023); sự kiện dương lịch tính theo năm dương.
    const startYear = event.repeats_yearly || monthly ? event.year : null;
    const yearOf = (date: SolarDate) => (event.calendar === 'am' ? solarToLunar(date).year : date.year);
    for (const date of dates) if (startYear === null || yearOf(date) >= startYear) results.push({ ...base, date, detail });
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
