import { jsPDF } from 'jspdf';
import { resolveBold, type DecorFontId } from './decoration-fonts';
import { BASELINE_OFFSET_EM, PT_PER_MM, type Drawing } from './drawing';

/** Font nhúng vào PDF (TTF, dạng chuỗi nhị phân base64), có đủ dấu tiếng Việt. */
export type PdfFonts = {
  regular: string;
  bold: string;
  /** Phông trang trí đã nạp (chỉ những mặt chữ bản vẽ dùng); thiếu thì chữ trang trí dùng phông chính. */
  decor?: Partial<Record<DecorFontId, { regular?: string; bold?: string }>>;
};

const FONT = 'NotoSerif';

const hexToRgb = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** Bản vẽ → PDF vector đúng khổ giấy, chữ là chữ thật (chọn, tìm được), phóng to vẫn sắc. */
export const drawingToPdf = (drawing: Drawing, fonts: PdfFonts, title: string): jsPDF => {
  const doc = new jsPDF({
    unit: 'mm',
    format: [drawing.width, drawing.height],
    orientation: drawing.width > drawing.height ? 'landscape' : 'portrait',
    compress: true,
  });
  doc.addFileToVFS('NotoSerif-Regular.ttf', fonts.regular);
  doc.addFileToVFS('NotoSerif-Bold.ttf', fonts.bold);
  doc.addFont('NotoSerif-Regular.ttf', FONT, 'normal');
  doc.addFont('NotoSerif-Bold.ttf', FONT, 'bold');
  const decorFamily = (id: DecorFontId) => `PhaDo-${id}`;
  for (const [id, faces] of Object.entries(fonts.decor ?? {}) as [DecorFontId, { regular?: string; bold?: string }][]) {
    if (faces.regular) {
      doc.addFileToVFS(`${id}-Regular.ttf`, faces.regular);
      doc.addFont(`${id}-Regular.ttf`, decorFamily(id), 'normal');
    }
    if (faces.bold) {
      doc.addFileToVFS(`${id}-Bold.ttf`, faces.bold);
      doc.addFont(`${id}-Bold.ttf`, decorFamily(id), 'bold');
    }
  }
  doc.setProperties({ title, creator: 'Gia Phả' });

  for (const item of drawing.items) {
    switch (item.type) {
      case 'rect': {
        const filled = item.fill !== 'none';
        const stroked = item.strokeWidth > 0;
        if (!filled && !stroked) break;
        if (stroked) {
          doc.setDrawColor(...hexToRgb(item.stroke));
          doc.setLineWidth(item.strokeWidth);
          if (item.dash) doc.setLineDashPattern([...item.dash], 0);
        }
        if (filled) doc.setFillColor(...hexToRgb(item.fill));
        const style = filled && stroked ? 'FD' : filled ? 'F' : 'S';
        if (item.radius > 0) doc.roundedRect(item.x, item.y, item.width, item.height, item.radius, item.radius, style);
        else doc.rect(item.x, item.y, item.width, item.height, style);
        if (item.dash) doc.setLineDashPattern([], 0);
        break;
      }
      case 'line': {
        doc.setDrawColor(...hexToRgb(item.stroke));
        doc.setLineWidth(item.strokeWidth);
        if (item.seamless) {
          // Một đường liền (không phải từng đoạn rời): góc được nối nhọn, hai đầu vuông nên giáp nhau không hở.
          const [startX, startY] = item.points[0] ?? [0, 0];
          let previous: [number, number] = [startX, startY];
          const deltas = item.points.slice(1).map(([x, y]): [number, number] => {
            const delta: [number, number] = [x - previous[0], y - previous[1]];
            previous = [x, y];
            return delta;
          });
          doc.setLineCap('square');
          doc.setLineJoin('miter');
          doc.lines(deltas, startX, startY, [1, 1], 'S', false);
          doc.setLineCap('butt');
        } else {
          for (let index = 1; index < item.points.length; index += 1) {
            const [x1, y1] = item.points[index - 1]!;
            const [x2, y2] = item.points[index]!;
            doc.line(x1, y1, x2, y2);
          }
        }
        break;
      }
      case 'text':
        if (item.font && fonts.decor?.[item.font]) doc.setFont(decorFamily(item.font), resolveBold(item.font, item.bold) ? 'bold' : 'normal');
        else doc.setFont(FONT, item.bold ? 'bold' : 'normal');
        doc.setFontSize(item.sizePt);
        doc.setTextColor(...hexToRgb(item.color));
        doc.text(item.text, item.x, item.y + (item.sizePt / PT_PER_MM) * BASELINE_OFFSET_EM, { align: item.align === 'start' ? 'left' : 'center' });
        break;
      case 'image': {
        const cx = item.x + item.width / 2;
        const cy = item.y + item.height / 2;
        const r = item.width / 2;
        if (item.round) {
          doc.saveGraphicsState();
          doc.circle(cx, cy, r, null);
          doc.clip();
          doc.discardPath();
        }
        doc.addImage(item.href, item.x, item.y, item.width, item.height);
        if (item.round) {
          doc.restoreGraphicsState();
          doc.setDrawColor(...hexToRgb(item.round.borderColor));
          doc.setLineWidth(item.round.borderWidth);
          doc.circle(cx, cy, r - item.round.borderWidth / 2, 'S');
        }
        break;
      }
    }
  }
  return doc;
};
