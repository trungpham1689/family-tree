import { anniversaryInLunarYear, lunarToSolar, solarToLunar } from '@gia-pha/lunar';
import { describe, expect, it } from 'vitest';
import { occurrencesBetween, upcoming, type CalendarEvent, type CalendarPerson, type CalendarSource } from './occurrences';

const person = (extra: Partial<CalendarPerson>): CalendarPerson => ({
  id: 'p',
  tree_id: 't1',
  full_name: 'Người',
  is_deceased: false,
  anniversary_day: null,
  anniversary_month: null,
  birth_solar_date: null,
  ...extra,
});

const event = (extra: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e',
  tree_id: 't1',
  title: 'Sự kiện',
  calendar: 'duong',
  repeats_yearly: true,
  year: null,
  month: 1,
  day: 1,
  leap: false,
  start_time: null,
  location: null,
  ...extra,
});

const source = (partial: Partial<CalendarSource>): CalendarSource => ({
  trees: [
    { id: 't1', name: 'Họ Phạm' },
    { id: 't2', name: 'Họ Lê' },
  ],
  persons: [],
  events: [],
  ...partial,
});

const year = (y: number) => ({ from: { year: y, month: 1, day: 1 }, to: { year: y, month: 12, day: 31 } });

describe('giỗ', () => {
  it('giỗ âm lặp hằng năm rơi đúng ngày dương của từng năm', () => {
    const data = source({ persons: [person({ full_name: 'Cụ Tổ', is_deceased: true, anniversary_day: 12, anniversary_month: 3 })] });
    for (const y of [2025, 2026, 2027, 2030]) {
      const { from, to } = year(y);
      const found = occurrencesBetween(data, from, to).filter((o) => o.kind === 'gio');
      for (const occurrence of found) {
        const lunar = solarToLunar(occurrence.date);
        expect([lunar.day, lunar.month, lunar.leap]).toEqual([12, 3, false]);
      }
      expect(found.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('ngày 30 thiếu thì giỗ ngày cuối tháng; tháng nhuận giỗ theo tháng thường', () => {
    const data = source({ persons: [person({ is_deceased: true, anniversary_day: 30, anniversary_month: 4 })] });
    const { from, to } = year(2026);
    const dates = occurrencesBetween(data, from, to).map((o) => o.date);
    for (const date of dates) {
      const lunar = solarToLunar(date);
      expect(lunar.month).toBe(4);
      expect(lunar.leap).toBe(false);
      expect(dates).toContainEqual(anniversaryInLunarYear({ day: 30, month: 4 }, lunar.year));
    }
  });

  it('người còn sống không có giỗ', () => {
    const data = source({ persons: [person({ is_deceased: false, anniversary_day: 1, anniversary_month: 1 })] });
    expect(occurrencesBetween(data, year(2026).from, year(2026).to)).toEqual([]);
  });
});

describe('sinh nhật', () => {
  it('theo ngày sinh dương đầy đủ, kèm tuổi tròn', () => {
    const data = source({ persons: [person({ full_name: 'Bình', birth_solar_date: '1990-09-02' })] });
    const [birthday] = occurrencesBetween(data, year(2026).from, year(2026).to);
    expect(birthday).toMatchObject({ kind: 'sinh_nhat', date: { year: 2026, month: 9, day: 2 }, detail: 'Tròn 36 tuổi' });
  });

  it('không có sinh nhật cho người đã mất hoặc chỉ biết năm sinh', () => {
    const data = source({
      persons: [person({ is_deceased: true, birth_solar_date: '1900-01-05' }), person({ id: 'q', birth_solar_date: null })],
    });
    expect(occurrencesBetween(data, year(2026).from, year(2026).to)).toEqual([]);
  });

  it('sinh 29/2 thì năm không nhuận mừng 28/2', () => {
    const data = source({ persons: [person({ birth_solar_date: '2000-02-29' })] });
    expect(occurrencesBetween(data, year(2027).from, year(2027).to)[0]?.date).toEqual({ year: 2027, month: 2, day: 28 });
    expect(occurrencesBetween(data, year(2028).from, year(2028).to)[0]?.date).toEqual({ year: 2028, month: 2, day: 29 });
  });
});

describe('Sự kiện', () => {
  it('âm lặp hằng năm hiện đúng ngày mỗi năm', () => {
    const data = source({ events: [event({ title: 'Họp họ', calendar: 'am', month: 1, day: 10 })] });
    for (const y of [2026, 2027]) {
      const found = occurrencesBetween(data, year(y).from, year(y).to);
      expect(found.length).toBeGreaterThanOrEqual(1);
      for (const o of found) expect(solarToLunar(o.date)).toMatchObject({ day: 10, month: 1 });
    }
  });

  it('dương một lần chỉ hiện đúng năm đó', () => {
    const data = source({
      events: [event({ title: 'Khánh thành', repeats_yearly: false, year: 2026, month: 12, day: 20, start_time: '08:30:00', location: 'Nhà thờ họ' })],
    });
    expect(occurrencesBetween(data, year(2026).from, year(2026).to)).toEqual([
      expect.objectContaining({ date: { year: 2026, month: 12, day: 20 }, detail: '08:30 · Nhà thờ họ', treeName: 'Họ Phạm' }),
    ]);
    expect(occurrencesBetween(data, year(2027).from, year(2027).to)).toEqual([]);
  });

  it('âm một lần trong tháng nhuận', () => {
    // Năm 2025 có tháng 6 nhuận.
    const data = source({ events: [event({ calendar: 'am', repeats_yearly: false, year: 2025, month: 6, day: 15, leap: true })] });
    const [found] = occurrencesBetween(data, year(2025).from, year(2025).to);
    expect(found?.date).toEqual(lunarToSolar({ year: 2025, month: 6, day: 15, leap: true }));
  });
});

describe('sự kiện hằng tháng và năm bắt đầu', () => {
  const monthly = (extra: Partial<CalendarEvent>) =>
    source({ events: [event({ repeats_yearly: false, repeats_monthly: true, month: null, ...extra })] });

  it('dương: mỗi tháng một lần, ngày 31 lùi về cuối tháng ngắn', () => {
    const found = occurrencesBetween(monthly({ day: 31 }), year(2026).from, year(2026).to);
    expect(found).toHaveLength(12);
    expect(found[1]!.date).toEqual({ year: 2026, month: 2, day: 28 });
    expect(found[3]!.date).toEqual({ year: 2026, month: 4, day: 30 });
  });

  it('dương: khoảng ngắn qua hai năm chỉ lấy ngày nằm trong khoảng', () => {
    const found = occurrencesBetween(monthly({ day: 15 }), { year: 2026, month: 12, day: 20 }, { year: 2027, month: 2, day: 10 });
    expect(found.map((o) => o.date)).toEqual([{ year: 2027, month: 1, day: 15 }]);
  });

  it('âm: mỗi tháng âm một lần vào đúng ngày âm đó', () => {
    const found = occurrencesBetween(monthly({ calendar: 'am', day: 1 }), year(2026).from, year(2026).to);
    expect(found.length).toBeGreaterThanOrEqual(12);
    expect(found.length).toBeLessThanOrEqual(13);
    for (const o of found) expect(solarToLunar(o.date).day).toBe(1);
  });

  it('âm: ngày 30 của tháng thiếu rơi vào ngày cuối tháng, mỗi tháng đúng một lần', () => {
    const found = occurrencesBetween(monthly({ calendar: 'am', day: 30 }), year(2026).from, year(2026).to);
    expect(found.length).toBeGreaterThanOrEqual(12);
    const keys = found.map((o) => `${solarToLunar(o.date).year}-${solarToLunar(o.date).month}-${solarToLunar(o.date).leap}`);
    expect(new Set(keys).size).toBe(found.length);
  });

  it('có năm bắt đầu thì không hiện trước năm đó (cả hằng tháng lẫn hằng năm)', () => {
    expect(occurrencesBetween(monthly({ day: 15, year: 2027 }), year(2026).from, year(2026).to)).toEqual([]);
    expect(occurrencesBetween(monthly({ day: 15, year: 2027 }), year(2027).from, year(2027).to)).toHaveLength(12);
    const yearly = source({ events: [event({ month: 5, day: 5, year: 2028 })] });
    expect(occurrencesBetween(yearly, year(2027).from, year(2027).to)).toEqual([]);
    expect(occurrencesBetween(yearly, year(2028).from, year(2028).to)).toHaveLength(1);
  });
});

describe('lịch của sự kiện: chọn âm thì theo ngày âm, chọn dương thì theo ngày dương', () => {
  const lunarOf = (date: { year: number; month: number; day: number }) => solarToLunar(date);
  const range = { from: { year: 2024, month: 1, day: 1 }, to: { year: 2027, month: 12, day: 31 } };
  const found = (e: Partial<CalendarEvent>) => occurrencesBetween(source({ events: [event({ title: 'X', year: 2024, ...e })] }), range.from, range.to);

  it('âm lịch hằng năm: mọi lần đều rơi đúng ngày/tháng âm đó (dương lịch thì khác nhau mỗi năm)', () => {
    const dates = found({ calendar: 'am', repeats_yearly: true, month: 3, day: 15 }).map((o) => o.date);
    expect(dates).toHaveLength(4);
    for (const date of dates) expect(lunarOf(date)).toMatchObject({ month: 3, day: 15, leap: false });
    expect(new Set(dates.map((d) => `${d.month}-${d.day}`)).size).toBeGreaterThan(1);
  });

  it('dương lịch hằng năm: mọi lần đều đúng ngày/tháng dương đó (âm lịch thì khác nhau mỗi năm)', () => {
    const dates = found({ calendar: 'duong', repeats_yearly: true, month: 3, day: 15 }).map((o) => o.date);
    expect(dates.map((d) => [d.year, d.month, d.day])).toEqual([[2024, 3, 15], [2025, 3, 15], [2026, 3, 15], [2027, 3, 15]]);
    expect(new Set(dates.map((d) => `${lunarOf(d).month}-${lunarOf(d).day}`)).size).toBeGreaterThan(1);
  });

  it('âm lịch hằng tháng theo ngày âm; dương lịch hằng tháng theo ngày dương', () => {
    const lunar = found({ calendar: 'am', repeats_monthly: true, repeats_yearly: false, month: null, day: 15 });
    expect(lunar.length).toBeGreaterThanOrEqual(48);
    for (const o of lunar) expect(lunarOf(o.date).day).toBe(15);
    const solar = found({ calendar: 'duong', repeats_monthly: true, repeats_yearly: false, month: null, day: 15 });
    expect(solar).toHaveLength(48);
    for (const o of solar) expect(o.date.day).toBe(15);
  });

  it('một lần: âm lịch đổi ra đúng ngày dương của ngày âm đó; dương lịch giữ nguyên ngày dương', () => {
    const [am] = found({ calendar: 'am', repeats_yearly: false, year: 2025, month: 8, day: 15 });
    expect(am!.date).toEqual(lunarToSolar({ year: 2025, month: 8, day: 15, leap: false }));
    const [duong] = found({ calendar: 'duong', repeats_yearly: false, year: 2025, month: 8, day: 15 });
    expect(duong!.date).toEqual({ year: 2025, month: 8, day: 15 });
  });

  it('năm bắt đầu của sự kiện âm lịch tính theo năm âm: tháng Chạp âm năm 2023 rơi sang tháng 1 dương 2024 vẫn chưa tới', () => {
    const lunarNewYear2024 = lunarToSolar({ year: 2024, month: 1, day: 1, leap: false })!;
    const before = lunarToSolar({ year: 2023, month: 12, day: 20, leap: false })!;
    expect(before.year).toBe(2024); // cuối tháng Chạp âm 2023 nằm trong năm dương 2024
    const dates = occurrencesBetween(
      source({ events: [event({ calendar: 'am', repeats_yearly: true, year: 2024, month: 12, day: 20 })] }),
      { year: 2024, month: 1, day: 1 },
      lunarNewYear2024,
    );
    expect(dates).toEqual([]);
    const dương = occurrencesBetween(
      source({ events: [event({ calendar: 'duong', repeats_yearly: true, year: 2024, month: 1, day: 5 })] }),
      { year: 2024, month: 1, day: 1 },
      { year: 2024, month: 1, day: 31 },
    );
    expect(dương).toHaveLength(1);
  });

  it('âm lịch có tháng nhuận: hằng năm vào tháng thường, hằng tháng có cả tháng nhuận', () => {
    // 2025 có tháng 6 nhuận.
    const yearly = found({ calendar: 'am', repeats_yearly: true, month: 6, day: 10 }).filter((o) => o.date.year === 2025);
    expect(yearly).toHaveLength(1);
    expect(lunarOf(yearly[0]!.date)).toMatchObject({ month: 6, leap: false });
    const monthly = found({ calendar: 'am', repeats_monthly: true, repeats_yearly: false, month: null, day: 10 });
    expect(monthly.some((o) => lunarOf(o.date).leap)).toBe(true);
  });
});

describe('nhiều Gia phả và "Sắp tới"', () => {
  const data = source({
    persons: [
      person({ id: 'a', tree_id: 't1', full_name: 'An', birth_solar_date: '1980-10-20' }),
      person({ id: 'b', tree_id: 't2', full_name: 'Bảo', birth_solar_date: '1985-10-18' }),
      person({ id: 'c', tree_id: 't2', full_name: 'Cường', birth_solar_date: '1985-12-01' }),
    ],
    events: [event({ id: 'e1', tree_id: 't1', title: 'Họp họ', month: 11, day: 1 })],
  });

  it('gộp mọi Gia phả, đúng thứ tự thời gian trong 30 ngày', () => {
    const list = upcoming(data, { year: 2026, month: 10, day: 16 });
    expect(list.map((o) => [o.title, o.treeName])).toEqual([
      ['Sinh nhật Bảo', 'Họ Lê'],
      ['Sinh nhật An', 'Họ Phạm'],
      ['Họp họ', 'Họ Phạm'],
    ]);
  });
});

describe('kỷ niệm cưới', () => {
  const marriage = { id: 'u1', tree_id: 't1', partner_a: 'p1', names: 'Ông A & Bà B', marriage_year: 1975, marriage_month: 4, marriage_day: 30 };

  it('nhắc hằng năm vào ngày cưới dương, kèm số năm', () => {
    const { from, to } = year(2026);
    const found = occurrencesBetween(source({ marriages: [marriage] }), from, to).filter((o) => o.kind === 'cuoi');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ date: { year: 2026, month: 4, day: 30 }, title: 'Kỷ niệm cưới Ông A & Bà B', detail: 'Tròn 51 năm ngày cưới', personId: 'p1' });
  });

  it('chưa biết đủ ngày thì không nhắc; năm cưới chính nó không tính là kỷ niệm', () => {
    const { from, to } = year(1975);
    expect(occurrencesBetween(source({ marriages: [marriage] }), from, to)).toEqual([]);
    expect(occurrencesBetween(source({ marriages: [{ ...marriage, marriage_day: null }] }), year(2026).from, year(2026).to)).toEqual([]);
  });
});
