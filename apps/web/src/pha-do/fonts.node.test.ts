import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_FAMILY_CSS, FONT_FAMILY_EXPORT_FILES } from './config';
import { DECOR_FONTS, type DecorFontId } from './decoration-fonts';
import { BASELINE_OFFSET_EM, PT_PER_MM } from './drawing';
import { drawingToSvg, TEXT_STYLE } from './svg';

/**
 * Bản xem trước trên trang và bản xuất PDF/PNG phải ra cùng nét chữ: cùng file phông (fonts.css nạp đúng các file public/fonts mà bản xuất nhúng),
 * cùng độ đậm, cùng cách xếp chữ (không kerning, không chữ nối).
 */
const publicDir = join(import.meta.dirname, '..', '..', 'public');
const css = readFileSync(join(import.meta.dirname, 'fonts.css'), 'utf8');

type Face = { family: string; weight: number; file: string };
const faces: Face[] = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => {
  const body = match[1]!;
  return {
    family: /font-family:\s*'([^']+)'/.exec(body)![1]!,
    weight: Number(/font-weight:\s*(\d+)/.exec(body)![1]),
    file: /url\('([^']+)'\)/.exec(body)![1]!,
  };
});
const familyOf = (cssValue: string) => /^'([^']+)'/.exec(cssValue)![1]!;

describe('phông xem trước và phông xuất là cùng một file', () => {
  it.each(Object.keys(DECOR_FONTS) as DecorFontId[])('%s: mỗi mặt chữ có đúng một @font-face cùng họ chữ, độ đậm và file với bản xuất', (id) => {
    const font = DECOR_FONTS[id];
    const family = familyOf(font.css);
    const own = faces.filter((face) => face.family === family);
    expect(own.map((face) => `${face.weight}:${face.file}`).sort()).toEqual(
      [font.regular ? `400:${font.regular}` : '', font.bold ? `700:${font.bold}` : ''].filter(Boolean).sort(),
    );
    for (const face of own) expect(existsSync(join(publicDir, face.file)), face.file).toBe(true);
  });

  it('mọi file trong fonts.css đều thuộc một phông trang trí (không thừa mặt chữ)', () => {
    const known = new Set(Object.values(DECOR_FONTS).flatMap((font) => [font.regular, font.bold].filter(Boolean)));
    for (const face of faces) expect(known.has(face.file), face.file).toBe(true);
  });

  it('phông chung của chữ không có phông riêng: họ chữ xem trước khớp file xuất', () => {
    for (const [name, family] of Object.entries(FONT_FAMILY_CSS)) {
      const own = faces.filter((face) => face.family === familyOf(family));
      const files = FONT_FAMILY_EXPORT_FILES[name as keyof typeof FONT_FAMILY_EXPORT_FILES];
      expect(own.find((face) => face.weight === 400)?.file, name).toBe(files.regular);
      expect(own.find((face) => face.weight === 700)?.file, name).toBe(files.bold);
    }
  });

  it('SVG tắt kerning và chữ nối như jsPDF; chữ trang trí mang họ chữ riêng ở xem trước và bản nhúng ở xuất', () => {
    const drawing = {
      width: 100,
      height: 100,
      items: [{ type: 'text' as const, x: 50, y: 50, text: 'Gia phả', sizePt: 20, bold: true, color: '#000000', font: 'playfair' as const }],
    };
    const preview = drawingToSvg(drawing);
    expect(preview).toContain(TEXT_STYLE);
    expect(preview).toContain(`font-family="${DECOR_FONTS.playfair.css}"`);
    expect(preview).toContain('font-weight="700"');
    const exported = drawingToSvg(drawing, { regularBase64: 'AA==', boldBase64: 'AA==', decor: { playfair: { boldBase64: 'AA==' } } });
    expect(exported).toContain(TEXT_STYLE);
    expect(exported).toContain(`font-family="'PhaDo-playfair'"`);
    expect(exported).toContain("font-family:'PhaDo-playfair';font-weight:700");
  });

  it('phông chỉ có một độ đậm: xem trước và xuất cùng lấy độ đậm đó', () => {
    const drawing = (bold: boolean) => ({ width: 10, height: 10, items: [{ type: 'text' as const, x: 1, y: 1, text: 'a', sizePt: 10, bold, color: '#000', font: 'great-vibes' as const }] });
    for (const bold of [true, false]) expect(drawingToSvg(drawing(bold))).toContain('font-weight="400"');
    for (const bold of [true, false]) expect(drawingToSvg({ ...drawing(bold), items: drawing(bold).items.map((item) => ({ ...item, font: 'playfair' as const })) })).toContain('font-weight="700"');
  });

  it('chữ vẽ ở đường cơ sở cách y đúng BASELINE_OFFSET_EM em (không nhờ canh "giữa" riêng của từng nơi), khớp với PDF', () => {
    const sizePt = 30;
    const svg = drawingToSvg({ width: 100, height: 100, items: [{ type: 'text', x: 50, y: 40, text: 'Họ', sizePt, bold: false, color: '#000' }] });
    const em = sizePt / PT_PER_MM;
    expect(svg).toContain(`y="${Number((40 + em * BASELINE_OFFSET_EM).toFixed(3))}"`);
    expect(svg).not.toContain('dominant-baseline');
  });
});
