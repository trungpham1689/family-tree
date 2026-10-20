import { describe, expect, it } from 'vitest';
import { buildFrontSections } from './sections';

const origin = {
  progenitorId: 'p0', progenitorName: 'Phạm Tổ', hometown: 'Nam Định', anniversaryDay: 7, anniversaryMonth: 8,
  worshipPlace: 'Nhà thờ họ', worshipKeeper: 'Phạm Trưởng', burialPlace: 'Núi X',
};
const today = { year: 2026, month: 10, day: 20 };

describe('khối Phả ký', () => {
  it('đủ dữ liệu: bốn khối theo thứ tự, nơi thờ/mộ tổ thành từng dòng nhãn–giá trị', () => {
    const sections = buildFrontSections({
      description: 'Lời mở',
      origin,
      branches: [{ branchId: 'b1', founderName: 'Chi Cả', memberCount: 12 }],
      notable: [{ personId: 'n1', fullName: 'Cụ Nghè', title: 'Tiến sĩ', generation: 3 }],
      today,
    });
    expect(sections.map((s) => s.kind)).toEqual(['intro', 'origin', 'branches', 'notable']);
    const origin_ = sections[1]!;
    expect(origin_.kind === 'origin' && origin_.facts).toContainEqual({ label: 'Nơi thờ', value: 'Nhà thờ họ (người phụ trách: Phạm Trưởng)' });
    expect(origin_.kind === 'origin' && origin_.facts).toContainEqual({ label: 'Mộ tổ', value: 'Núi X' });
  });

  it('thiếu dữ liệu thì bỏ khối đó', () => {
    const sections = buildFrontSections({ description: null, origin: { ...origin, progenitorName: null, progenitorId: null }, branches: [], notable: [], today });
    expect(sections).toEqual([]);
  });
});
