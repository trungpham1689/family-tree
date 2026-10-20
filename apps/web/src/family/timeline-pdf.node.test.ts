import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTimeline } from './timeline';
import { timelineToPdf } from './timeline-pdf';

const fontDir = join(import.meta.dirname, '..', '..', 'public', 'fonts');
const fonts = {
  regular: readFileSync(join(fontDir, 'NotoSerif-400Regular.ttf')).toString('binary'),
  bold: readFileSync(join(fontDir, 'NotoSerif-700Bold.ttf')).toString('binary'),
};

const persons = Array.from({ length: 60 }, (_, index) => ({
  id: `p${index}`,
  full_name: `Phạm Văn Người ${index}`,
  birth_year: 1900 + index * 2,
  death_year: index % 3 === 0 ? 1960 + index * 2 : null,
}));

describe('xuất PDF Dòng thời gian', () => {
  it('khổ A4, nhúng font, tràn sang nhiều trang khi dài', () => {
    const doc = timelineToPdf(buildTimeline(persons, [{ partner_a: 'p0', partner_b: 'p1', status: 'con', marriage_year: 1920 }], true), fonts, { treeName: 'Gia phả họ Phạm', date: '2026-10-20' });
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 1);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(doc.output()).toMatch(/NotoSerif/);
  });

  it('mốc sự kiện có mô tả và ảnh đầu tiên vẫn vẽ được và đưa ảnh vào file', () => {
    const entries = buildTimeline(persons.slice(0, 3), [], false);
    entries.push({
      year: 1960,
      kind: 'su_kien',
      text: 'Khánh thành nhà thờ họ',
      subject: 'Khánh thành nhà thờ họ',
      eventId: 'e1',
      detail: 'Ngày 20/12/1960 · chủ trì: Cụ Tổ',
      description: 'Cả họ về dự lễ khánh thành, có đông đủ các chi. '.repeat(4),
      photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    });
    entries.sort((a, b) => a.year - b.year);
    const meta = { treeName: 'Gia phả họ Phạm', date: '2026-10-20' };
    const withPhoto = timelineToPdf(entries, fonts, meta).output('arraybuffer').byteLength;
    const withoutPhoto = timelineToPdf(
      entries.map(({ photo: _photo, ...entry }) => entry),
      fonts,
      meta,
    ).output('arraybuffer').byteLength;
    expect(withPhoto).toBeGreaterThan(withoutPhoto);
  });
});
