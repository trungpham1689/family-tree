import { describe, expect, it } from 'vitest';
import { computeFunStats } from './fun-stats';

const p = (id: string, full_name: string, birth_year: number | null, death_year: number | null) => ({
  id, full_name, birth_year, death_year, is_deceased: death_year !== null,
});

describe('computeFunStats', () => {
  const persons = [
    p('a', 'Phạm Văn Tổ', 1900, 1980), // thọ 81 (tuổi mụ)
    p('b', 'Phạm Thị Lan', 1910, 1960), // 51
    p('c', 'Phạm Văn An', 1950, null), // còn sống, 77
    p('d', 'Lê Văn Bình', 1990, null), // 37
    p('e', 'Vô Danh', null, null),
  ];
  const links = [
    { child_id: 'b', parent_id: 'a', kind: 'ruot' },
    { child_id: 'c', parent_id: 'a', kind: 'ruot' },
    { child_id: 'd', parent_id: 'b', kind: 'ruot' },
    { child_id: 'e', parent_id: 'b', kind: 'nuoi' },
  ];

  it('tuổi thọ, người thọ nhất, người cao tuổi nhất còn sống', () => {
    const stats = computeFunStats(persons, links, 2026);
    expect(stats.averageLifespan).toBe((81 + 51) / 2);
    expect(stats.longestLived?.person.id).toBe('a');
    expect(stats.oldestLiving).toMatchObject({ age: 77, person: { id: 'c' } });
  });

  it('số con ruột trung bình (bỏ con nuôi) và họ/tên phổ biến', () => {
    const stats = computeFunStats(persons, links, 2026);
    expect(stats.averageChildren).toBe(1.5); // a có 2, b có 1 con ruột
    expect(stats.topSurnames[0]).toEqual({ name: 'Phạm', count: 3 });
    expect(stats.topGivenNames[0]).toEqual({ name: 'An', count: 1 });
  });

  it('không có dữ liệu thì null / rỗng', () => {
    expect(computeFunStats([p('x', 'Một', null, null)], [], 2026)).toEqual({
      averageLifespan: null, longestLived: null, oldestLiving: null, averageChildren: null, topSurnames: [], topGivenNames: [],
    });
  });
});
