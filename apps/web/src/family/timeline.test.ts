import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timeline';

const persons = [
  { id: 'a', full_name: 'Cụ Tổ', birth_year: 1900, death_year: 1975 },
  { id: 'b', full_name: 'Cụ Bà', birth_year: 1905, birth_approx: true, death_year: null },
  { id: 'c', full_name: 'Người lạ', birth_year: null, death_year: null },
];

describe('buildTimeline', () => {
  it('sinh, mất, cưới theo năm; hưởng thọ tính tuổi mụ; bỏ người chưa biết năm', () => {
    const entries = buildTimeline(persons, [{ partner_a: 'a', partner_b: 'b', status: 'con', marriage_year: 1925 }], false);
    expect(entries.map((e) => [e.year, e.kind, e.text])).toEqual([
      [1900, 'sinh', 'Cụ Tổ chào đời'],
      [1905, 'sinh', 'Cụ Bà chào đời'],
      [1925, 'cuoi', 'Cụ Tổ & Cụ Bà kết hôn'],
      [1975, 'mat', 'Cụ Tổ qua đời'],
    ]);
    expect(entries[0]!.personId).toBe('a');
    expect(entries[1]!.detail).toBe('khoảng');
    expect(entries[3]!.detail).toBe('hưởng thọ 76 tuổi');
  });

  it('xen mốc lịch sử chỉ trong khoảng năm của gia đình, và tắt được', () => {
    const on = buildTimeline(persons, [], true).filter((e) => e.kind === 'lich_su').map((e) => e.year);
    expect(on).toEqual([1945, 1954, 1975]);
    expect(buildTimeline(persons, [], false).some((e) => e.kind === 'lich_su')).toBe(false);
    expect(buildTimeline([persons[2]!], [], true)).toEqual([]);
  });

  it('cùng năm: sinh → cưới → mất', () => {
    const entries = buildTimeline(
      [
        { id: 'x', full_name: 'X', birth_year: 1950, death_year: 1950 },
        { id: 'y', full_name: 'Y', birth_year: 1950, death_year: null },
      ],
      [{ partner_a: 'x', partner_b: 'y', status: 'con', marriage_year: 1950 }],
      false,
    );
    expect(entries.map((e) => e.kind)).toEqual(['sinh', 'sinh', 'cuoi', 'mat']);
  });
});
