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

  it('mục Sự kiện của dòng họ: vẽ tên, thời gian, chủ trì, mô tả và ảnh đầu tiên', () => {
    const front = [
      {
        kind: 'events' as const,
        heading: 'Sự kiện của dòng họ',
        items: [
          { id: 'e1', title: 'Khánh thành nhà thờ họ', when: 'Ngày 20/12/1960 · Nhà thờ họ', host: 'Phạm Văn Tổ – Đời 1', description: 'Cả họ về dự lễ khánh thành. '.repeat(10) },
          { id: 'e2', title: 'Họp họ đầu xuân', when: 'Ngày 10 tháng 1 âm lịch, hằng năm', host: null, description: null },
        ],
      },
    ];
    const photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const generations = buildNarrative(family());
    const without = narrativeToPdf(generations, fonts, meta, front, null).output('arraybuffer').byteLength;
    const withPhoto = narrativeToPdf(generations, fonts, meta, front, null, { events: new Map([['e1', photo]]) }).output('arraybuffer').byteLength;
    expect(withPhoto).toBeGreaterThan(without);
  });
});
