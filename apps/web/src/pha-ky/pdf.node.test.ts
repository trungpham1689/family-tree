import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blankPerson } from '../test-support/person';
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

const meta = { treeName: 'Gia phả họ Phạm', date: '2026-10-20' };

describe('xuất PDF Phả ký', () => {
  it('khổ A4, nhúng font tiếng Việt, vẽ được thẻ trước/sau cùng các Đời', () => {
    const generations = buildNarrative(family());
    const front = [{ kind: 'intro' as const, heading: 'Lời mở đầu', text: 'Dòng họ ta vốn ở Làng Đông.' }];
    const doc = narrativeToPdf(generations, fonts, meta, front, 'Mong con cháu tiếp tục bổ sung.');

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
    const plain = narrativeToPdf(generations, fonts, meta, [], null).output('arraybuffer').byteLength;
    const withPhotos = narrativeToPdf(generations, fonts, meta, [], null, {
      cover: jpeg,
      people: new Map([['to', jpeg]]),
    }).output('arraybuffer').byteLength;
    expect(withPhotos).toBeGreaterThan(plain);
  });
});
