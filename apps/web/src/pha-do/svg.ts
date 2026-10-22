import { DECOR_FONTS, resolveBold, type DecorFontId } from './decoration-fonts';
import type { Drawing } from './drawing';
import { BASELINE_OFFSET_EM, PT_PER_MM } from './drawing';

// Ký tự điều khiển (trừ tab, xuống dòng) không hợp lệ trong XML: một ký tự như vậy trong tên làm SVG không đọc được khi xuất PNG.
// oxlint-disable-next-line no-control-regex -- khớp ký tự điều khiển là chủ đích
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const escape = (text: string) => text.replace(XML_INVALID, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttr = (text: string) => escape(text).replaceAll('"', '&quot;');
const n = (value: number) => Number(value.toFixed(3));

/**
 * Xem trước, PNG (cùng vẽ bằng trình duyệt) và PDF (jsPDF) phải ra cùng nét chữ: jsPDF xếp chữ theo độ rộng từng ký tự, không có kerning hay chữ nối (ligature),
 * nên trình duyệt cũng tắt hai thứ đó. Độ rộng ước lượng trong glyph-widths cũng tính theo cách này.
 */
export const TEXT_STYLE = "font-kerning:none;font-variant-ligatures:none;font-feature-settings:'kern' 0,'liga' 0,'clig' 0,'calt' 0;text-rendering:optimizeSpeed";

/** Font nhúng thẳng vào SVG (base64 TTF), cần khi vẽ SVG lên canvas để xuất PNG. */
export type EmbeddedFonts = {
  regularBase64: string;
  boldBase64: string;
  /** Phông trang trí đã nạp (chỉ những mặt chữ bản vẽ dùng). */
  decor?: Partial<Record<DecorFontId, { regularBase64?: string; boldBase64?: string }>>;
};

const decorFaces = (decor: NonNullable<EmbeddedFonts['decor']>): string =>
  (Object.entries(decor) as [DecorFontId, { regularBase64?: string; boldBase64?: string }][])
    .flatMap(([id, faces]) =>
      ([[400, faces.regularBase64], [700, faces.boldBase64]] as const)
        .filter((face): face is readonly [400 | 700, string] => face[1] !== undefined)
        .map(([weight, base64]) => `@font-face{font-family:'PhaDo-${id}';font-weight:${weight};src:url(data:font/ttf;base64,${base64}) format('truetype')}`),
    )
    .join('');

/** Bản vẽ → SVG đúng kích thước giấy (mm), dùng để xem trước và xuất PNG. */
export const drawingToSvg = (drawing: Drawing, fonts?: EmbeddedFonts, previewFontFamily?: string): string => {
  const parts = drawing.items.map((item, index) => {
    switch (item.type) {
      case 'rect':
        return `<rect x="${n(item.x)}" y="${n(item.y)}" width="${n(item.width)}" height="${n(item.height)}" rx="${n(item.radius)}" fill="${escapeAttr(item.fill)}" stroke="${escapeAttr(item.stroke)}" stroke-width="${n(item.strokeWidth)}"${item.dash ? ` stroke-dasharray="${item.dash.map(n).join(' ')}"` : ''}/>`;
      case 'line':
        return `<polyline points="${item.points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${escapeAttr(item.stroke)}" stroke-width="${n(item.strokeWidth)}"${item.seamless ? ' stroke-linecap="square" stroke-linejoin="miter"' : ''}/>`;
      case 'text':
        // Chữ trang trí có phông riêng: xem trước dùng phông CSS, xuất dùng phông đã nhúng (`PhaDo-<phông>`).
        const family = item.font ? ` font-family="${escapeAttr(fonts ? `'PhaDo-${item.font}'` : DECOR_FONTS[item.font].css)}"` : '';
        const bold = item.font ? resolveBold(item.font, item.bold) : item.bold;
        const em = item.sizePt / PT_PER_MM;
        return `<text x="${n(item.x)}" y="${n(item.y + em * BASELINE_OFFSET_EM)}"${family} font-size="${n(em)}" font-weight="${bold ? 700 : 400}" fill="${escapeAttr(item.color)}" text-anchor="${item.align === 'start' ? 'start' : 'middle'}">${escape(item.text)}</text>`;
      case 'image': {
        // href là data URL (ảnh đã tải sẵn thành base64) nên không cần CORS khi vẽ SVG lên canvas để xuất PNG.
        const img = `<image x="${n(item.x)}" y="${n(item.y)}" width="${n(item.width)}" height="${n(item.height)}" href="${escapeAttr(item.href)}" preserveAspectRatio="xMidYMid slice"${item.round ? ` clip-path="url(#avatar-${index})"` : ''}/>`;
        if (!item.round) return img;
        const cx = n(item.x + item.width / 2);
        const cy = n(item.y + item.height / 2);
        const r = n(item.width / 2);
        const ring = `<circle cx="${cx}" cy="${cy}" r="${n(r - item.round.borderWidth / 2)}" fill="none" stroke="${escapeAttr(item.round.borderColor)}" stroke-width="${n(item.round.borderWidth)}"/>`;
        return `<clipPath id="avatar-${index}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>${img}${ring}`;
      }
    }
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${drawing.width}mm" height="${drawing.height}mm" viewBox="0 0 ${drawing.width} ${drawing.height}" font-family="${fonts ? "'PhaDo'" : (previewFontFamily ?? "'PhaDo Noto Serif', serif")}" style="${TEXT_STYLE}">`,
    fonts
      ? `<style>@font-face{font-family:'PhaDo';font-weight:400;src:url(data:font/ttf;base64,${fonts.regularBase64}) format('truetype')}@font-face{font-family:'PhaDo';font-weight:700;src:url(data:font/ttf;base64,${fonts.boldBase64}) format('truetype')}${fonts.decor ? decorFaces(fonts.decor) : ''}</style>`
      : '',
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    ...parts,
    '</svg>',
  ].join('\n');
};
