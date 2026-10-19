import { describe, expect, it } from 'vitest';
import { isCalendarPerson, marriageNames, parseCalendarSource, toCalendarMarriages, type MarriageRow } from './calendar-source';

const row = (extra: Partial<MarriageRow>): MarriageRow => ({
  id: 'u1', tree_id: 't1', partner_a: 'p1', marriage_year: 1950, marriage_month: 8, marriage_day: 15, status: 'con',
  a: { full_name: 'Ông A' }, b: { full_name: 'Bà B' }, ...extra,
});

describe('nguồn lịch', () => {
  it('chỉ người đã mất hoặc có ngày sinh dương đi vào lịch', () => {
    expect(isCalendarPerson({ is_deceased: true, birth_solar_date: null })).toBe(true);
    expect(isCalendarPerson({ is_deceased: false, birth_solar_date: '1990-01-01' })).toBe(true);
    expect(isCalendarPerson({ is_deceased: false, birth_solar_date: null })).toBe(false);
  });

  it('hôn phối: bỏ ly hôn và chưa đủ ngày, ghép tên "A & B", thiếu tên một bên vẫn không có dấu & thừa', () => {
    const result = toCalendarMarriages([row({}), row({ id: 'u2', status: 'ly_hon' }), row({ id: 'u3', marriage_day: null }), row({ id: 'u4', b: null })]);
    expect(result.map((m) => [m.id, m.names])).toEqual([['u1', 'Ông A & Bà B'], ['u4', 'Ông A']]);
    expect(marriageNames(undefined, undefined)).toBe('');
  });

  it('parseCalendarSource: nhận JSON đúng hình dạng, từ chối JSON sai', () => {
    const ok = { trees: [{ id: 't', name: 'Họ' }], persons: [], events: [], marriages: [] };
    expect(parseCalendarSource(ok)).not.toBeNull();
    expect(parseCalendarSource({ ...ok, marriages: undefined })?.marriages).toEqual([]);
    expect(parseCalendarSource(null)).toBeNull();
    expect(parseCalendarSource({ ...ok, trees: 'x' })).toBeNull();
    expect(parseCalendarSource({ ...ok, persons: [{ id: 'p', tree_id: 't', full_name: 'A' }] })).toBeNull(); // thiếu is_deceased
  });
});
