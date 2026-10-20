import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { fitSize, GLYPH_TABLES, textWidthEm, truncateToFit } from './glyph-widths';

const fontDir = join(import.meta.dirname, '..', '..', 'public', 'fonts');
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
for (const [name, file] of [['NR', 'NotoSerif-400Regular.ttf'], ['NB', 'NotoSerif-700Bold.ttf'], ['VR', 'BeVietnamPro-400Regular.ttf'], ['VB', 'BeVietnamPro-700Bold.ttf']] as const) {
  doc.addFileToVFS(file, readFileSync(join(fontDir, file)).toString('binary'));
  doc.addFont(file, name, 'normal');
}
const measure = (font: string, text: string) => {
  doc.setFont(font, 'normal');
  doc.setFontSize(100);
  return doc.getTextWidth(text) / (100 * 0.3528);
};

describe('độ rộng chữ ước lượng', () => {
  it('mỗi ký tự trong bảng không nhỏ hơn độ rộng thật ở cả hai phông', () => {
    for (const [fonts, table] of [[['NR', 'VR'], GLYPH_TABLES.REGULAR], [['NB', 'VB'], GLYPH_TABLES.BOLD]] as const) {
      for (const [char, width] of Object.entries(table)) {
        for (const font of fonts) expect(width / 1000, `${font} "${char}"`).toBeGreaterThanOrEqual(measure(font, char) - 0.001);
      }
    }
  });

  it('cả dòng: ước lượng ≥ thật, và sát (không quá 12% dư) với tên người thường gặp', () => {
    for (const name of ['Phạm Văn Tổ', 'Nguyễn Hoàng Thiên Phương Thảo Nguyên', 'TRẦN THỊ MƯỜI MỘT', 'Mmmmmmmmmmmmmm', 'Quỳnh Như', 'Ngô Bảo Châu']) {
      for (const [fonts, bold] of [[['NR', 'VR'], false], [['NB', 'VB'], true]] as const) {
        const estimate = textWidthEm(name, bold);
        const real = Math.max(...fonts.map((font) => measure(font, name)));
        expect(estimate, name).toBeGreaterThanOrEqual(real - 0.001);
        if (name === 'Phạm Văn Tổ') expect(estimate / real).toBeLessThan(1.12);
      }
    }
  });

  it('dấu kết hợp (NFD) không tính thêm chiều rộng', () => {
    expect(textWidthEm('Việt'.normalize('NFD'), false)).toBeCloseTo(textWidthEm('Việt'.normalize('NFC'), false), 1);
  });

  it('fitSize và truncateToFit đảm bảo dòng vừa khung', () => {
    const text = 'Xã Nghĩa Hưng, huyện Nghĩa Đàn, tỉnh Nghệ An';
    expect(textWidthEm(text, false) * fitSize(text, 12, false, 100)).toBeLessThanOrEqual(100 + 0.001);
    expect(fitSize('Họ', 12, false, 100)).toBe(12);
    const cut = truncateToFit(text, 12, false, 100);
    expect(cut.endsWith('…')).toBe(true);
    expect(textWidthEm(cut, false) * 12).toBeLessThanOrEqual(100);
  });
});
