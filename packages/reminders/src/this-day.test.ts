import { describe, expect, it } from 'vitest';
import type { CalendarPerson, CalendarSource } from './occurrences';
import { onThisDay } from './this-day';

const person = (extra: Partial<CalendarPerson>): CalendarPerson => ({
  id: 'p',
  tree_id: 't1',
  full_name: 'Cụ A',
  is_deceased: true,
  anniversary_day: null,
  anniversary_month: null,
  birth_solar_date: null,
  death_solar_date: null,
  ...extra,
});
const source = (persons: CalendarPerson[]): CalendarSource => ({ trees: [{ id: 't1', name: 'Họ Phạm' }], persons, events: [] });
const today = { year: 2026, month: 10, day: 19 };

describe('onThisDay', () => {
  it('người đã mất sinh/mất đúng ngày-tháng này của năm trước, mới nhất trước', () => {
    const items = onThisDay(
      source([
        person({ id: 'a', full_name: 'Cụ A', birth_solar_date: '1900-10-19' }),
        person({ id: 'b', full_name: 'Cụ B', death_solar_date: '1999-10-19' }),
        person({ id: 'c', full_name: 'Cụ C', death_solar_date: '1999-10-20' }),
      ]),
      today,
    );
    expect(items.map((item) => [item.personId, item.kind, item.yearsAgo])).toEqual([
      ['b', 'mat', 27],
      ['a', 'sinh', 126],
    ]);
    expect(items[1]!.text).toBe('Cụ A chào đời');
  });

  it('bỏ người còn sống (đã có sinh nhật) và mốc của chính năm nay', () => {
    expect(onThisDay(source([person({ is_deceased: false, birth_solar_date: '1990-10-19' })]), today)).toEqual([]);
    expect(onThisDay(source([person({ death_solar_date: '2026-10-19' })]), today)).toEqual([]);
  });
});
