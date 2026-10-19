import { describe, expect, it } from 'vitest';
import { buildFrontSections, toPdfSections } from './sections';

const origin = {
  progenitorId: 'p0', progenitorName: 'Phạm Tổ', hometown: 'Nam Định', anniversaryDay: 7, anniversaryMonth: 8,
  worshipPlace: 'Nhà thờ họ', worshipKeeper: 'Phạm Trưởng', burialPlace: 'Núi X',
};
const today = { year: 2026, month: 10, day: 20 };

describe('khối Phả ký', () => {
  it('đủ dữ liệu: bốn khối theo thứ tự; PDF có cùng chữ với trang web', () => {
    const sections = buildFrontSections({
      description: 'Lời mở',
      origin,
      branches: [{ branchId: 'b1', founderName: 'Chi Cả', memberCount: 12 }],
      notable: [{ personId: 'n1', fullName: 'Cụ Nghè', title: 'Tiến sĩ', generation: 3 }],
      today,
    });
    expect(sections.map((s) => s.kind)).toEqual(['intro', 'origin', 'branches', 'notable']);
    const pdf = toPdfSections(sections);
    expect(pdf[1]!.paragraphs[0]).toBe('Dòng họ tôn Phạm Tổ làm Thuỷ tổ — người đời đầu tiên còn ghi lại được. Quê quán tại Nam Định.');
    expect(pdf[1]!.paragraphs).toContain('Nơi thờ: Nhà thờ họ (người phụ trách: Phạm Trưởng)');
    expect(pdf[1]!.paragraphs).toContain('Mộ tổ: Núi X');
    expect(pdf[2]!.paragraphs).toEqual(['Chi Cả — 12 người.']);
    expect(pdf[3]!.paragraphs).toEqual(['Cụ Nghè — Tiến sĩ']);
  });

  it('thiếu dữ liệu thì bỏ khối đó', () => {
    const sections = buildFrontSections({ description: null, origin: { ...origin, progenitorName: null, progenitorId: null }, branches: [], notable: [], today });
    expect(sections).toEqual([]);
  });
});
