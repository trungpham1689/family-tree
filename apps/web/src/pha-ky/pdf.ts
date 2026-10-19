import { jsPDF } from 'jspdf';
import type { PdfFonts } from '../pha-do/pdf';
import type { NarrativeGeneration } from './narrative';

const FONT = 'NotoSerif';
const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const LINE_HEIGHT = 6;
const PARA_LINE = LINE_HEIGHT * 0.85;
const PARA_GAP = 2;
const CARD_HEADING_GAP = LINE_HEIGHT * 1.3;
const CARD_PAD = 6;

/** Màu thương hiệu, lấy đúng từ `--color-*` trong index.css, để PDF cùng tông với trang web. */
const COLOR = {
  son: [138, 28, 28] as const,
  kim: [184, 137, 43] as const,
  ink: [31, 26, 23] as const,
  inkMuted: [92, 83, 76] as const,
  line: [228, 220, 209] as const,
  paper: [251, 248, 243] as const,
};

/** Một khối trước/sau phần theo Đời: Lời mở đầu, Nguồn gốc, Các chi, Người tiêu biểu, Lời kết. */
export type PdfSection = { heading: string; paragraphs: readonly string[] };

/** Phả ký ra PDF khổ A4, chữ thật (NotoSerif, có dấu tiếng Việt), cùng tông màu và bố cục với trang web. */
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
  doc.setTextColor(...COLOR.son);
  doc.setFontSize(20);
  ensureSpace(LINE_HEIGHT * 2.6);
  doc.text(title, PAGE_WIDTH / 2, y, { align: 'center' });
  y += LINE_HEIGHT * 1.1;
  doc.setDrawColor(...COLOR.kim);
  doc.setLineWidth(0.6);
  doc.line(PAGE_WIDTH / 2 - 16, y, PAGE_WIDTH / 2 + 16, y);
  y += LINE_HEIGHT * 1.6;

  /** Lời mở đầu, Nguồn gốc, Các chi, Người tiêu biểu, Lời kết: thẻ nền giấy, viền mảnh — như card trên web. */
  const writeCard = (heading: string, paragraphs: readonly string[]) => {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(13);
    const lineSets = paragraphs.map((paragraph) => doc.splitTextToSize(paragraph, maxWidth - CARD_PAD * 2) as string[]);
    const bodyHeight = lineSets.reduce((total, lines) => total + lines.length * PARA_LINE + PARA_GAP, 0);
    const cardHeight = CARD_PAD + CARD_HEADING_GAP + bodyHeight + CARD_PAD * 0.5;
    ensureSpace(cardHeight + LINE_HEIGHT * 0.5);

    const cardTop = y;
    doc.setFillColor(...COLOR.paper);
    doc.setDrawColor(...COLOR.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, cardTop, maxWidth, cardHeight, 3, 3, 'FD');

    let cy = cardTop + CARD_PAD;
    doc.setFont(FONT, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COLOR.son);
    doc.text(heading, MARGIN + CARD_PAD, cy);
    cy += CARD_HEADING_GAP;

    doc.setFont(FONT, 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...COLOR.ink);
    for (const lines of lineSets) {
      doc.text(lines, MARGIN + CARD_PAD, cy);
      cy += lines.length * PARA_LINE + PARA_GAP;
    }
    y = cardTop + cardHeight + LINE_HEIGHT * 0.7;
  };

  for (const section of before) writeCard(section.heading, section.paragraphs);

  /** Theo từng Đời: tiêu đề + thống kê + dòng kẻ, mỗi người một chấm tròn, tên đậm, chi tiết bên dưới — như timeline trên web. */
  for (const group of generations) {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(15);
    ensureSpace(LINE_HEIGHT * 2.2);
    doc.setTextColor(...COLOR.son);
    doc.text(`Đời ${group.generation}`, MARGIN, y);

    doc.setFont(FONT, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR.inkMuted);
    const stat = `${group.total} người${group.male + group.female > 0 ? ` · ${group.male} nam · ${group.female} nữ` : ''}`;
    doc.text(stat, PAGE_WIDTH - MARGIN, y, { align: 'right' });

    y += 2;
    doc.setDrawColor(...COLOR.line);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += LINE_HEIGHT * 1.3;

    const indent = 7;
    for (const item of group.items) {
      doc.setFont(FONT, 'bold');
      doc.setFontSize(11.5);
      const nameWidth = doc.getTextWidth(item.name);
      ensureSpace(LINE_HEIGHT);
      const dotColor: readonly [number, number, number] = item.kind === 'thuy_to' ? COLOR.kim : COLOR.son;
      doc.setFillColor(...dotColor);
      doc.circle(MARGIN + 1.3, y - 1.3, 1.1, 'F');
      doc.setTextColor(...COLOR.ink);
      doc.text(item.name, MARGIN + indent, y);

      if (item.lifespan) {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR.inkMuted);
        doc.text(` (${item.lifespan})`, MARGIN + indent + nameWidth, y);
      }
      y += LINE_HEIGHT * 1.05;

      if (item.detail) {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(...COLOR.ink);
        const lines = doc.splitTextToSize(item.detail, maxWidth - indent) as string[];
        ensureSpace(lines.length * PARA_LINE);
        doc.text(lines, MARGIN + indent, y);
        y += lines.length * PARA_LINE;
      }
      y += LINE_HEIGHT * 0.6;
    }
    y += LINE_HEIGHT * 0.5;
  }

  for (const section of after) writeCard(section.heading, section.paragraphs);

  return doc;
};
