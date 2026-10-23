import { describe, expect, it } from 'vitest';
import { findInconsistencies, type CheckedPerson } from './inconsistencies';

const p = (id: string, fields: Partial<CheckedPerson> = {}): CheckedPerson => ({
  id,
  full_name: id,
  gender: 'nam',
  is_deceased: false,
  birth_year: null,
  birth_calendar: 'duong',
  birth_approx: false,
  death_year: null,
  death_calendar: 'duong',
  death_approx: false,
  ...fields,
});
const ruot = (child_id: string, parent_id: string) => ({ child_id, parent_id, kind: 'ruot' });
const problemsOf = (result: ReturnType<typeof findInconsistencies>, id: string) => result.find((entry) => entry.person.id === id)?.problems ?? [];

describe('findInconsistencies', () => {
  it('dữ liệu hợp lý thì không báo', () => {
    const persons = [p('cha', { birth_year: 1920, death_year: 1990, is_deceased: true }), p('me', { gender: 'nu', birth_year: 1925 }), p('con', { birth_year: 1950 })];
    expect(findInconsistencies(persons, [ruot('con', 'cha'), ruot('con', 'me')], [{ partner_a: 'cha', partner_b: 'me', marriage_year: 1945 }], 2026)).toEqual([]);
  });

  it('khác lịch thì nới 1 năm: cha sinh 1950 âm, con sinh 1962 dương không báo; cùng lịch thì báo', () => {
    const child = p('con', { birth_year: 1962 });
    expect(findInconsistencies([p('cha', { birth_year: 1950, birth_calendar: 'am' }), child], [ruot('con', 'cha')], [], 2026)).toEqual([]);
    expect(findInconsistencies([p('cha', { birth_year: 1950 }), child], [ruot('con', 'cha')], [], 2026)).toHaveLength(1);
  });

  it('con sinh trước hoặc quá sát cha mẹ, và mẹ quá tuổi', () => {
    const persons = [p('cha', { birth_year: 1960 }), p('me', { gender: 'nu', birth_year: 1900 }), p('con', { birth_year: 1965 })];
    const result = findInconsistencies(persons, [ruot('con', 'cha'), ruot('con', 'me')], [], 2026);
    expect(problemsOf(result, 'con')).toEqual([
      'Sinh năm 1965, khi cha cha (sinh 1960) chưa tới 13 tuổi',
      'Sinh năm 1965, khi mẹ me (sinh 1900) đã ngoài 55 tuổi',
    ]);
  });

  it('con nuôi không bị xét tuổi cha mẹ', () => {
    const persons = [p('cha', { birth_year: 1960 }), p('con', { birth_year: 1955 })];
    expect(findInconsistencies(persons, [{ child_id: 'con', parent_id: 'cha', kind: 'nuoi' }], [], 2026)).toEqual([]);
  });

  it('sinh sau khi cha mất quá 1 năm', () => {
    const persons = [p('cha', { birth_year: 1900, death_year: 1940, is_deceased: true }), p('con', { birth_year: 1945 }), p('con2', { birth_year: 1941 })];
    const result = findInconsistencies(persons, [ruot('con', 'cha'), ruot('con2', 'cha')], [], 2026);
    expect(problemsOf(result, 'con')).toEqual(['Sinh năm 1945, sau khi cha cha mất (1940)']);
    expect(problemsOf(result, 'con2')).toEqual([]);
  });

  it('cưới khi chưa tới tuổi và cưới sau khi mất', () => {
    const persons = [p('a', { birth_year: 1950 }), p('b', { gender: 'nu', birth_year: 1930, death_year: 1955, is_deceased: true })];
    const result = findInconsistencies(persons, [], [{ partner_a: 'a', partner_b: 'b', marriage_year: 1960 }], 2026);
    expect(problemsOf(result, 'a')).toEqual(['Cưới năm 1960, khi chưa tới 13 tuổi (sinh 1950)']);
    expect(problemsOf(result, 'b')).toEqual(['Cưới năm 1960, sau năm mất (1955)']);
  });

  it('còn sống mà quá 110 tuổi', () => {
    const result = findInconsistencies([p('cu', { birth_year: 1880 })], [], [], 2026);
    expect(problemsOf(result, 'cu')).toEqual(['Đang ghi còn sống nhưng đã 146 tuổi: có thể quên đánh dấu đã mất']);
  });

  it('bỏ qua năm ghi "khoảng"', () => {
    const persons = [p('cha', { birth_year: 1960, birth_approx: true }), p('con', { birth_year: 1965 })];
    expect(findInconsistencies(persons, [ruot('con', 'cha')], [], 2026)).toEqual([]);
  });
});
