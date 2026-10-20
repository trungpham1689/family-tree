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
});
