import type { Drawing } from './drawing';
import { PT_PER_MM } from './drawing';

const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const n = (value: number) => Number(value.toFixed(3));

/** Bản vẽ → SVG đúng kích thước giấy (mm), dùng để xem trước. */
export const drawingToSvg = (drawing: Drawing): string => {
  const parts = drawing.items.map((item) => {
    switch (item.type) {
      case 'rect':
        return `<rect x="${n(item.x)}" y="${n(item.y)}" width="${n(item.width)}" height="${n(item.height)}" rx="${n(item.radius)}" fill="${item.fill}" stroke="${item.stroke}" stroke-width="${n(item.strokeWidth)}"/>`;
      case 'line':
        return `<polyline points="${item.points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="none" stroke="${item.stroke}" stroke-width="${n(item.strokeWidth)}"/>`;
      case 'text':
        return `<text x="${n(item.x)}" y="${n(item.y)}" font-size="${n(item.sizePt / PT_PER_MM)}" font-weight="${item.bold ? 700 : 400}" fill="${item.color}" text-anchor="middle" dominant-baseline="central">${escape(item.text)}</text>`;
    }
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${drawing.width}mm" height="${drawing.height}mm" viewBox="0 0 ${drawing.width} ${drawing.height}" font-family="'Noto Serif', serif">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    ...parts,
    '</svg>',
  ].join('\n');
};
