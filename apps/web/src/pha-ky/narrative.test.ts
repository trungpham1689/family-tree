import { describe, expect, it } from 'vitest';
import { blankPerson } from '../data/blank-person';
import { buildFamilyGraph } from '../family/family-graph';
import { buildNarrative } from './narrative';

const sample = () =>
  buildFamilyGraph({
    persons: [
      blankPerson({ id: 'to', full_name: 'Nguyễn Văn Tổ', gender: 'nam', birth_year: 1850, is_deceased: true, death_year: 1920 }),
      blankPerson({ id: 'vo', full_name: 'Trần Thị Hoa', gender: 'nu', birth_year: 1855 }),
      blankPerson({
        id: 'con',
        full_name: 'Nguyễn Văn An',
        gender: 'nam',
        birth_year: 1875,
        birth_order: 1,
        occupation: 'Lý trưởng',
        biography: 'Người có công khai khẩn đất làng.',
      }),
    ],
    parentLinks: [
      { child_id: 'con', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con', parent_id: 'vo', kind: 'ruot' },
    ],
    unions: [{ id: 'u1', partner_a: 'to', partner_b: 'vo', order_for_a: 1, order_for_b: 1, status: 'con' }],
    positions: [
      { person_id: 'to', generation: 1, branch_id: null, kind: 'thuy_to' },
      { person_id: 'vo', generation: 1, branch_id: null, kind: 'dau_re' },
      { person_id: 'con', generation: 2, branch_id: 'con', kind: 'dinh' },
    ],
  });

describe('buildNarrative', () => {
  it('nhóm theo Đời, đúng thứ tự', () => {
    const generations = buildNarrative(sample());
    expect(generations.map((g) => g.generation)).toEqual([1, 2]);
    expect(generations[0]!.items.map((i) => i.personId)).toEqual(['to', 'vo']);
  });

  it('Thuỷ tổ: lifespan, câu Thuỷ tổ, hưởng thọ', () => {
    const generations = buildNarrative(sample());
    const text = generations[0]!.items.find((i) => i.personId === 'to')!.text;
    expect(text).toContain('Nguyễn Văn Tổ (1850 – 1920).');
    expect(text).toContain('Thuỷ tổ của dòng họ');
    expect(text).toContain('hưởng thọ 71 tuổi');
    expect(text).toContain('Kết hôn với Trần Thị Hoa');
  });

  it('con: thứ tự con, cha mẹ, nghề nghiệp, tiểu sử', () => {
    const generations = buildNarrative(sample());
    const text = generations[1]!.items[0]!.text;
    expect(text).toContain('Con trưởng.');
    expect(text).toContain('Con của Nguyễn Văn Tổ và Trần Thị Hoa.');
    expect(text).toContain('Nghề nghiệp: Lý trưởng.');
    expect(text).toContain('Người có công khai khẩn đất làng.');
  });
});
