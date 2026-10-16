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
