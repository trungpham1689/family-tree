import type { Drawing } from './drawing';
import { PT_PER_MM } from './drawing';

// Ký tự điều khiển (trừ tab, xuống dòng) không hợp lệ trong XML: một ký tự như vậy trong tên làm SVG không đọc được khi xuất PNG.
// oxlint-disable-next-line no-control-regex -- khớp ký tự điều khiển là chủ đích
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
const escape = (text: string) => text.replace(XML_INVALID, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttr = (text: string) => escape(text).replaceAll('"', '&quot;');
const n = (value: number) => Number(value.toFixed(3));

/** Font nhúng thẳng vào SVG (base64 TTF), cần khi vẽ SVG lên canvas để xuất PNG. */
export type EmbeddedFonts = { regularBase64: string; boldBase64: string };

/** Bản vẽ → SVG đúng kích thước giấy (mm), dùng để xem trước và xuất PNG. */
export const drawingToSvg = (drawing: Drawing, fonts?: EmbeddedFonts, previewFontFamily?: string): string => {
  const parts = drawing.items.map((item, index) => {
    switch (item.type) {
      case 'rect':
        return `<rect x="${n(item.x)}" y="${n(item.y)}" width="${n(item.width)}" height="${n(item.height)}" rx="${n(item.radius)}" fill="${escapeAttr(item.fill)}" stroke="${escapeAttr(item.stroke)}" stroke-width="${n(item.strokeWidth)}"${item.dash ? ` stroke-dasharray="${item.dash.map(n).join(' ')}"` : ''}/>`;
      case 'line':
        return `<polyline points="${item.points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${escapeAttr(item.stroke)}" stroke-width="${n(item.strokeWidth)}"${item.seamless ? ' stroke-linecap="square" stroke-linejoin="miter"' : ''}/>`;
      case 'text':
        return `<text x="${n(item.x)}" y="${n(item.y)}" font-size="${n(item.sizePt / PT_PER_MM)}" font-weight="${item.bold ? 700 : 400}" fill="${escapeAttr(item.color)}" text-anchor="${item.align === 'start' ? 'start' : 'middle'}" dominant-baseline="central">${escape(item.text)}</text>`;
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
    `<svg xmlns="http://www.w3.org/2000/svg" width="${drawing.width}mm" height="${drawing.height}mm" viewBox="0 0 ${drawing.width} ${drawing.height}" font-family="${fonts ? "'PhaDo'" : (previewFontFamily ?? "'Noto Serif', serif")}">`,
    fonts
      ? `<style>@font-face{font-family:'PhaDo';font-weight:400;src:url(data:font/ttf;base64,${fonts.regularBase64}) format('truetype')}@font-face{font-family:'PhaDo';font-weight:700;src:url(data:font/ttf;base64,${fonts.boldBase64}) format('truetype')}</style>`
      : '',
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    ...parts,
    '</svg>',
  ].join('\n');
};
