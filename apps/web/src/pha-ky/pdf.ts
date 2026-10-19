import { jsPDF } from 'jspdf';
import type { PdfFonts } from '../pha-do/pdf';
import type { NarrativeGeneration } from './narrative';

const FONT = 'NotoSerif';
const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LINE_HEIGHT = 6;

/** Một khối trước/sau phần theo Đời: Lời mở đầu, Nguồn gốc, Các chi, Người tiêu biểu, Lời kết. */
export type PdfSection = { heading: string; paragraphs: readonly string[] };

/** Phả ký ra PDF khổ A4, chữ thật (NotoSerif, có dấu tiếng Việt), tự sang trang khi hết chỗ. */
export const narrativeToPdf = (
  generations: readonly NarrativeGeneration[],
  fonts: PdfFonts,
  title: string,
  before: readonly PdfSection[] = [],
  after: readonly PdfSection[] = [],
): jsPDF => {
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

  const writeSection = (heading: string, paragraphs: readonly string[]) => {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(14);
    ensureSpace(LINE_HEIGHT * 1.5);
    doc.text(heading, MARGIN, y);
    y += LINE_HEIGHT * 1.5;

    doc.setFont(FONT, 'normal');
    doc.setFontSize(11);
    for (const paragraph of paragraphs) {
      const lines = doc.splitTextToSize(paragraph, maxWidth) as string[];
      ensureSpace(lines.length * LINE_HEIGHT + LINE_HEIGHT * 0.5);
      doc.text(lines, MARGIN, y);
      y += lines.length * LINE_HEIGHT + LINE_HEIGHT * 0.5;
    }
    y += LINE_HEIGHT * 0.5;
  };

  for (const section of before) writeSection(section.heading, section.paragraphs);
  for (const group of generations) writeSection(`Đời ${group.generation}`, group.items.map((item) => item.text));
  for (const section of after) writeSection(section.heading, section.paragraphs);

  return doc;
};
