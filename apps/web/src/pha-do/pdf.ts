import { jsPDF } from 'jspdf';
import type { Drawing } from './drawing';

/** Font nhúng vào PDF (TTF, dạng chuỗi nhị phân base64), có đủ dấu tiếng Việt. */
export type PdfFonts = { regular: string; bold: string };

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
  doc.setProperties({ title, creator: 'Gia Phả' });

  for (const item of drawing.items) {
    switch (item.type) {
      case 'rect':
        doc.setDrawColor(...hexToRgb(item.stroke));
        doc.setFillColor(...hexToRgb(item.fill));
        doc.setLineWidth(item.strokeWidth);
        doc.roundedRect(item.x, item.y, item.width, item.height, item.radius, item.radius, 'FD');
        break;
      case 'line': {
        doc.setDrawColor(...hexToRgb(item.stroke));
        doc.setLineWidth(item.strokeWidth);
        for (let index = 1; index < item.points.length; index += 1) {
          const [x1, y1] = item.points[index - 1]!;
          const [x2, y2] = item.points[index]!;
          doc.line(x1, y1, x2, y2);
        }
        break;
      }
      case 'text':
        doc.setFont(FONT, item.bold ? 'bold' : 'normal');
        doc.setFontSize(item.sizePt);
        doc.setTextColor(...hexToRgb(item.color));
        doc.text(item.text, item.x, item.y, { align: 'center', baseline: 'middle' });
        break;
    }
  }
  return doc;
};
