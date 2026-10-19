import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blankPerson } from '../data/blank-person';
import { buildFamilyGraph } from '../family/family-graph';
import { buildNarrative } from './narrative';
import { narrativeToPdf } from './pdf';

const family = () =>
  buildFamilyGraph({
    persons: [
      blankPerson({ id: 'to', full_name: 'Phạm Văn Tổ', gender: 'nam', is_deceased: true, death_year: 1970, hometown: 'Làng Đông' }),
      blankPerson({ id: 'con', full_name: 'Phạm Thị Đặng Ưởng', gender: 'nu', title: 'Liệt sĩ', role_note: 'Trưởng chi 1' }),
    ],
    parentLinks: [{ parent_id: 'to', child_id: 'con', kind: 'ruot' }],
    unions: [],
    positions: [
      { person_id: 'to', generation: 1, branch_id: null, kind: 'thuy_to' },
      { person_id: 'con', generation: 2, branch_id: 'con', kind: 'dinh' },
    ],
  });

const fontDir = join(import.meta.dirname, '..', '..', 'public', 'fonts');
const fonts = {
  regular: readFileSync(join(fontDir, 'NotoSerif-400Regular.ttf')).toString('binary'),
  bold: readFileSync(join(fontDir, 'NotoSerif-700Bold.ttf')).toString('binary'),
};

describe('xuất PDF Phả ký', () => {
  it('khổ A4, nhúng font tiếng Việt, vẽ được thẻ trước/sau cùng các Đời', () => {
    const generations = buildNarrative(family());
    const before = [{ heading: 'Lời mở đầu', paragraphs: ['Dòng họ ta vốn ở Làng Đông.'] }];
    const after = [{ heading: 'Lời kết', paragraphs: ['Mong con cháu tiếp tục bổ sung.'] }];
    const doc = narrativeToPdf(generations, fonts, 'Phả ký họ Phạm', before, after);

    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 1);
    const output = doc.output();
    expect(output).toContain('/FontFile2');
    expect(output).toMatch(/NotoSerif/);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(10_000);
  });

  it('nhúng được ảnh gia phả và ảnh đại diện từng Người', () => {
    const jpeg =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const generations = buildNarrative(family());
    const plain = narrativeToPdf(generations, fonts, 'Phả ký họ Phạm').output('arraybuffer').byteLength;
    const withPhotos = narrativeToPdf(generations, fonts, 'Phả ký họ Phạm', [], [], {
      cover: jpeg,
      people: new Map([['to', jpeg]]),
    }).output('arraybuffer').byteLength;
    expect(withPhotos).toBeGreaterThan(plain);
  });
});
