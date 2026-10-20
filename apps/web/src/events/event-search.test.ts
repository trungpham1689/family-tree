import type { CalendarEvent } from '@gia-pha/reminders';
import { describe, expect, it } from 'vitest';
import { MAX_SEARCH_RESULTS, parseIsoDate, searchEventOccurrences, toIsoDate } from './event-search';

const event = (extra: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e',
  tree_id: 't',
  title: 'Sự kiện',
  calendar: 'duong',
  repeats_yearly: false,
  repeats_monthly: false,
  year: 2020,
  month: 5,
  day: 10,
  leap: false,
  start_time: null,
  location: null,
  ...extra,
});
const source = (events: CalendarEvent[]) => ({ trees: [{ id: 't', name: 'Họ Phạm' }], events });

describe('tìm sự kiện theo khoảng thời gian', () => {
  const events = [
    event({ id: 'a', title: 'Khánh thành nhà thờ họ', year: 2020, month: 5, day: 10 }),
    event({ id: 'b', title: 'Họp họ đầu xuân', repeats_yearly: true, year: 2021, month: 2, day: 1 }),
    event({ id: 'c', title: 'Sinh hoạt mùng một', repeats_monthly: true, month: null, year: 2022, day: 1 }),
  ];

  it('xem lại sự kiện cũ: một lần đúng ngày, lặp thì tính từng lần từ năm bắt đầu', () => {
    const result = searchEventOccurrences(source(events), { from: '2020-01-01', to: '2022-12-31', query: '' });
    expect(result.ok && result.occurrences.map((o) => [toIsoDate(o.date), o.title])).toEqual([
      ['2020-05-10', 'Khánh thành nhà thờ họ'],
      ['2021-02-01', 'Họp họ đầu xuân'],
      ['2022-01-01', 'Sinh hoạt mùng một'],
      ['2022-02-01', 'Họp họ đầu xuân'],
      ['2022-02-01', 'Sinh hoạt mùng một'],
      ...Array.from({ length: 10 }, (_, index) => [`2022-${String(index + 3).padStart(2, '0')}-01`, 'Sinh hoạt mùng một']),
    ]);
  });

  it('lọc theo tên không phân biệt dấu và hoa thường; khoảng hẹp chỉ lấy ngày trong khoảng (gồm hai đầu)', () => {
    const byName = searchEventOccurrences(source(events), { from: '2020-01-01', to: '2020-12-31', query: 'KHANH thanh' });
    expect(byName.ok && byName.occurrences).toHaveLength(1);
    const narrow = searchEventOccurrences(source(events), { from: '2020-05-10', to: '2020-05-10', query: '' });
    expect(narrow.ok && narrow.occurrences).toHaveLength(1);
    expect(searchEventOccurrences(source(events), { from: '2020-05-11', to: '2020-12-31', query: '' })).toMatchObject({ ok: true, occurrences: [] });
  });

  it('báo lỗi ngày thiếu/sai thứ tự/quá dài; cắt bớt khi quá nhiều kết quả', () => {
    expect(searchEventOccurrences(source(events), { from: '', to: '2020-01-01', query: '' })).toMatchObject({ ok: false });
    expect(searchEventOccurrences(source(events), { from: '2021-01-01', to: '2020-01-01', query: '' })).toMatchObject({ ok: false });
    expect(searchEventOccurrences(source(events), { from: '2000-01-01', to: '2025-01-01', query: '' })).toMatchObject({ ok: false });
    const daily = event({ id: 'd', title: 'Hằng tháng', repeats_monthly: true, month: null, year: 1900, day: 1 });
    const many = searchEventOccurrences(source(Array.from({ length: 30 }, (_, index) => ({ ...daily, id: `m${index}` }))), { from: '2020-01-01', to: '2030-12-31', query: '' });
    expect(many).toMatchObject({ ok: true, truncated: true });
    expect(many.ok && many.occurrences).toHaveLength(MAX_SEARCH_RESULTS);
  });

  it('ngày ISO', () => {
    expect(parseIsoDate('2024-02-30')).toBeNull();
    expect(parseIsoDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });
});
