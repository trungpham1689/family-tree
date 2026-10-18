import { jsPDF } from 'jspdf';
import type { PdfFonts } from '../pha-do/pdf';
import type { NarrativeGeneration } from './narrative';

const FONT = 'NotoSerif';
const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LINE_HEIGHT = 6;

/** Phả ký ra PDF khổ A4, chữ thật (NotoSerif, có dấu tiếng Việt), tự sang trang khi hết chỗ. */
export const narrativeToPdf = (generations: readonly NarrativeGeneration[], fonts: PdfFonts, title: string): jsPDF => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.addFileToVFS('NotoSerif-Regular.ttf', fonts.regular);
  doc.addFileToVFS('NotoSerif-Bold.ttf', fonts.bold);
  doc.addFont('NotoSerif-Regular.ttf', FONT, 'normal');
  doc.addFont('NotoSerif-Bold.ttf', FONT, 'bold');
  doc.setProperties({ title, creator: 'Gia Phả' });

  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let y = MARGIN;
  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setFont(FONT, 'bold');
  doc.setFontSize(18);
  ensureSpace(LINE_HEIGHT * 2);
  doc.text(title, PAGE_WIDTH / 2, y, { align: 'center' });
  y += LINE_HEIGHT * 2;

  for (const group of generations) {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    ensureSpace(LINE_HEIGHT * 1.5);
    doc.text(`Đời ${group.generation}`, MARGIN, y);
    y += LINE_HEIGHT * 1.5;

    doc.setFont(FONT, 'normal');
    doc.setFontSize(11);
    for (const item of group.items) {
      const lines = doc.splitTextToSize(item.text, maxWidth) as string[];
      ensureSpace(lines.length * LINE_HEIGHT + LINE_HEIGHT * 0.5);
      doc.text(lines, MARGIN, y);
      y += lines.length * LINE_HEIGHT + LINE_HEIGHT * 0.5;
    }
    y += LINE_HEIGHT * 0.5;
  }

  return doc;
};
