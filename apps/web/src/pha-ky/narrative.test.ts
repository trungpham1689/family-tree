import { describe, expect, it } from 'vitest';
import { blankPerson } from '../data/blank-person';
import { buildFamilyGraph } from '../family/family-graph';
import { branchSummaries, buildNarrative, closingNote, notablePersons, originSummary } from './narrative';

const sample = () =>
  buildFamilyGraph({
    persons: [
      blankPerson({
        id: 'to',
        full_name: 'Nguyễn Văn Tổ',
        gender: 'nam',
        birth_year: 1850,
        is_deceased: true,
        death_year: 1920,
        hometown: 'Làng Đông, Thái Bình',
        anniversary_day: 12,
        anniversary_month: 3,
        worship_place: 'Nhà thờ họ Nguyễn',
        worship_keeper: 'Nguyễn Văn Trưởng',
        burial_place: 'Nghĩa trang dòng họ',
      }),
      blankPerson({ id: 'vo', full_name: 'Trần Thị Hoa', gender: 'nu', birth_year: 1855 }),
      blankPerson({
        id: 'con',
        full_name: 'Nguyễn Văn An',
        gender: 'nam',
        birth_year: 1875,
        birth_order: 1,
        occupation: 'Lý trưởng',
        title: 'Liệt sĩ chống Pháp',
        role_note: 'Trưởng chi 1',
        education: 'Cử nhân Nho học',
        residence: 'Hà Nội',
        biography: 'Người có công khai khẩn đất làng.',
      }),
      blankPerson({ id: 'con2', full_name: 'Nguyễn Văn Bình', gender: 'nam', birth_year: 1878, birth_order: 2 }),
    ],
    parentLinks: [
      { child_id: 'con', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con', parent_id: 'vo', kind: 'ruot' },
      { child_id: 'con2', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con2', parent_id: 'vo', kind: 'ruot' },
    ],
    unions: [{ id: 'u1', partner_a: 'to', partner_b: 'vo', order_for_a: 1, order_for_b: 1, status: 'con' }],
    positions: [
      { person_id: 'to', generation: 1, branch_id: null, kind: 'thuy_to' },
      { person_id: 'vo', generation: 1, branch_id: null, kind: 'dau_re' },
      { person_id: 'con', generation: 2, branch_id: 'con', kind: 'dinh' },
      { person_id: 'con2', generation: 2, branch_id: 'con2', kind: 'dinh' },
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

  it('con: thứ tự con, cha mẹ, chức tước, vai vế, học vấn, nơi ở, nghề nghiệp, tiểu sử', () => {
    const generations = buildNarrative(sample());
    const text = generations[1]!.items[0]!.text;
    expect(text).toContain('Con trưởng.');
    expect(text).toContain('Con của Nguyễn Văn Tổ và Trần Thị Hoa.');
    expect(text).toContain('Liệt sĩ chống Pháp.');
    expect(text).toContain('Trưởng chi 1.');
    expect(text).toContain('Nghề nghiệp: Lý trưởng.');
    expect(text).toContain('Học vấn: Cử nhân Nho học.');
    expect(text).toContain('Sinh sống tại Hà Nội.');
    expect(text).toContain('Người có công khai khẩn đất làng.');
  });

  it('Thuỷ tổ: quê quán, mộ tổ, nơi thờ', () => {
    const generations = buildNarrative(sample());
    const text = generations[0]!.items.find((i) => i.personId === 'to')!.text;
    expect(text).toContain('Quê quán Làng Đông, Thái Bình.');
    expect(text).toContain('An táng tại Nghĩa trang dòng họ.');
    expect(text).toContain('Thờ phụng tại Nhà thờ họ Nguyễn.');
  });
});

describe('notablePersons', () => {
  it('chỉ lấy người có điền Chức vụ/danh hiệu, kèm Đời', () => {
    const result = notablePersons(sample());
    expect(result).toEqual([{ personId: 'con', fullName: 'Nguyễn Văn An', title: 'Liệt sĩ chống Pháp', generation: 2 }]);
  });
});

describe('originSummary', () => {
  it('suy từ hồ sơ Thuỷ tổ: quê quán, giỗ, nơi thờ, mộ tổ', () => {
    expect(originSummary(sample())).toEqual({
      progenitorId: 'to',
      progenitorName: 'Nguyễn Văn Tổ',
      hometown: 'Làng Đông, Thái Bình',
      anniversaryDay: 12,
      anniversaryMonth: 3,
      worshipPlace: 'Nhà thờ họ Nguyễn',
      worshipKeeper: 'Nguyễn Văn Trưởng',
      burialPlace: 'Nghĩa trang dòng họ',
    });
  });
});

describe('branchSummaries', () => {
  it('mỗi con Đời 2 của Thuỷ tổ lập một chi, kèm số người', () => {
    const result = branchSummaries(sample());
    expect(result).toEqual(
      expect.arrayContaining([
        { branchId: 'con', founderName: 'Nguyễn Văn An', memberCount: 1 },
        { branchId: 'con2', founderName: 'Nguyễn Văn Bình', memberCount: 1 },
      ]),
    );
    expect(result).toHaveLength(2);
  });
});

describe('closingNote', () => {
  it('kèm ngày xem, nhắn gửi con cháu bổ sung', () => {
    const text = closingNote({ day: 19, month: 10, year: 2026 });
    expect(text).toContain('19/10/2026');
    expect(text).toContain('Gia phả điện tử');
  });
});
