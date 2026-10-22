import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { DECOR_FONTS, decorFaceFile, type DecorFontId } from './decoration-fonts';
import { fitSize, GLYPH_TABLES, textWidthEm, truncateToFit } from './glyph-widths';
import { FACE_WIDTHS, GLYPH_CHARS } from './glyph-tables';

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

describe('độ rộng chữ ước lượng của phông trang trí', () => {
  const faces = (Object.keys(DECOR_FONTS) as DecorFontId[]).flatMap((id) =>
    ([false, true] as const).filter((bold) => DECOR_FONTS[id][bold ? 'bold' : 'regular']).map((bold) => ({ id, bold, name: `${id}:${bold ? 'b' : 'r'}` })),
  );
  for (const { id, bold, name } of faces) {
    const file = decorFaceFile(id, bold).split('/').pop()!;
    doc.addFileToVFS(file, readFileSync(join(fontDir, file)).toString('binary'));
    doc.addFont(file, name, 'normal');
  }

  it('mỗi mặt chữ có bảng đủ ký tự', () => {
    for (const { name } of faces) expect(FACE_WIDTHS[name]?.length, name).toBe([...GLYPH_CHARS].length);
  });

  it('mỗi ký tự trong bảng không nhỏ hơn độ rộng thật của chính phông đó (trừ ký tự phông không có)', () => {
    for (const { name } of faces) {
      const widths = FACE_WIDTHS[name]!;
      [...GLYPH_CHARS].forEach((char, index) => {
        // Ký tự phông không có: bảng lấy đúng giá trị của bảng chung (xem glyph-tables.ts), không đo được bằng phông này.
        const shared = (name.endsWith(':b') ? GLYPH_TABLES.BOLD : GLYPH_TABLES.REGULAR)[char];
        if (shared === widths[index]) return;
        expect(widths[index]! / 1000, `${name} "${char}"`).toBeGreaterThanOrEqual(measure(name, char) - 0.001);
      });
    }
  });

  it('tiêu đề tiếng Việt: ước lượng ≥ thật và sát (không dư quá 15%)', () => {
    for (const { id, bold, name } of faces) {
      for (const text of ['Gia phả họ Nguyễn', 'Kính dâng tổ tiên – năm 2026', 'Trường tồn', 'Phúc ấm con cháu vạn thuở bền']) {
        const estimate = textWidthEm(text, bold, id);
        const real = measure(name, text);
        expect(estimate, `${name} "${text}"`).toBeGreaterThanOrEqual(real - 0.001);
        expect(estimate / real, `${name} "${text}"`).toBeLessThan(1.15);
      }
    }
  });
});
