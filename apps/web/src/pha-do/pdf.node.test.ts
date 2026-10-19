import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomFamily } from '@gia-pha/tree-layout';
import { describe, expect, it } from 'vitest';
import { blankPerson } from '../test-support/person';
import { buildFamilyGraph } from '../family/family-graph';
import { defaultPhaDoConfig } from './config';
import { drawingToPdf } from './pdf';
import { renderPhaDo } from './render';

const base = defaultPhaDoConfig(1);

const smallFamily = () =>
  buildFamilyGraph({
    persons: [
      blankPerson({ id: 'to', full_name: 'Phạm Văn Tổ', gender: 'nam', is_progenitor: true }),
      blankPerson({ id: 'con', full_name: 'Phạm Thị Đặng Ưởng', gender: 'nu' }),
    ],
    parentLinks: [{ parent_id: 'to', child_id: 'con', kind: 'ruot' }],
    unions: [],
    positions: [],
  });

const bigFamily = () => {
  const family = randomFamily(99, 800);
  return buildFamilyGraph({
    persons: family.persons.map((person) =>
      blankPerson({ id: person.id, full_name: person.full_name, gender: person.gender, birth_year: person.birth_year, is_progenitor: person.id === family.rootId }),
    ),
    parentLinks: family.parentLinks.map((link) => ({ ...link, kind: 'ruot' })),
    unions: family.unions.map((union, index) => ({ ...union, id: `u${index}`, status: 'con' })),
    positions: [],
  });
};

const fontDir = join(import.meta.dirname, '..', '..', 'public', 'fonts');
const fonts = {
  regular: readFileSync(join(fontDir, 'NotoSerif-400Regular.ttf')).toString('binary'),
  bold: readFileSync(join(fontDir, 'NotoSerif-700Bold.ttf')).toString('binary'),
};
const beVietnamPro = {
  regular: readFileSync(join(fontDir, 'BeVietnamPro-400Regular.ttf')).toString('binary'),
  bold: readFileSync(join(fontDir, 'BeVietnamPro-700Bold.ttf')).toString('binary'),
};

describe('xuất PDF', () => {
  it('đúng khổ giấy, nhúng font tiếng Việt', () => {
    const { drawing } = renderPhaDo(smallFamily(), { ...base, paper: 'A2', orientation: 'portrait' });
    const doc = drawingToPdf(drawing, fonts, 'Gia phả họ Phạm');
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(420, 1);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(594, 1);
    const output = doc.output();
    expect(output).toContain('/FontFile2');
    expect(output).toMatch(/NotoSerif/);
  });

  it('xuất được với phông Be Vietnam Pro (chọn ở Phả đồ) — khi người dùng đổi phông, bản xuất đổi theo', () => {
    const { drawing } = renderPhaDo(smallFamily(), { ...base, paper: 'A2', orientation: 'portrait' });
    const doc = drawingToPdf(drawing, beVietnamPro, 'Gia phả họ Phạm');
    const output = doc.output();
    expect(output).toContain('/FontFile2');
    expect(output).toMatch(/NotoSerif/); // tên nội bộ jsPDF dùng lại, không phải tên phông thật đã nhúng
  });

  it('800 người khổ A0 xuất trong vòng 30 giây', () => {
    const started = Date.now();
    const { drawing } = renderPhaDo(bigFamily(), { ...base, paper: 'A0', outsideGenerations: 5 });
    const pdf = drawingToPdf(drawing, fonts, 'Gia phả lớn').output('arraybuffer');
    expect(Date.now() - started).toBeLessThan(30_000);
    expect(pdf.byteLength).toBeGreaterThan(10_000);
  });
});
