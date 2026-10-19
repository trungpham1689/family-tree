import { jsPDF } from 'jspdf';
import type { PdfFonts } from '../pha-do/pdf';
import { kindLabel } from '../family/labels';
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
const SECTION_GAP = 9;
const ITEM_GAP = 3.5;

/** Màu thương hiệu, lấy đúng từ `--color-*` trong index.css, để PDF cùng tông với trang web. */
const COLOR = {
  son: [138, 28, 28] as const,
  kim: [184, 137, 43] as const,
  ink: [31, 26, 23] as const,
  inkMuted: [92, 83, 76] as const,
  line: [228, 220, 209] as const,
  paper: [251, 248, 243] as const,
  neutral: [163, 154, 143] as const,
  /** son pha giấy: 20% cho gạch chân tiêu đề Đời, 10% cho nhãn vai trò. */
  sonSoft: [228, 204, 200] as const,
  sonSoft10: [240, 226, 222] as const,
};

/** Một khối trước/sau phần theo Đời: Lời mở đầu, Nguồn gốc, Các chi, Người tiêu biểu, Lời kết. */
export type PdfSection = { heading: string; paragraphs: readonly string[] };

/** Ảnh nhúng vào PDF (data URL JPEG): ảnh cả gia phả dưới tiêu đề, ảnh đại diện từng Người theo personId. */
export type PdfPhotos = { cover?: string | undefined; people?: ReadonlyMap<string, string> | undefined };

const COVER_WIDTH = 110;
const COVER_MAX_HEIGHT = 75;
const PERSON_PHOTO = 18;

/** Phả ký ra PDF khổ A4, chữ thật (NotoSerif, có dấu tiếng Việt), cùng tông màu và bố cục với trang web. */
export const narrativeToPdf = (
  generations: readonly NarrativeGeneration[],
  fonts: PdfFonts,
  title: string,
  before: readonly PdfSection[] = [],
  after: readonly PdfSection[] = [],
  photos: PdfPhotos = {},
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

  if (photos.cover) {
    const { width, height } = doc.getImageProperties(photos.cover);
    const coverHeight = Math.min(COVER_MAX_HEIGHT, (COVER_WIDTH * height) / width);
    const coverWidth = (coverHeight * width) / height;
    ensureSpace(coverHeight + LINE_HEIGHT);
    doc.addImage(photos.cover, 'JPEG', (PAGE_WIDTH - coverWidth) / 2, y, coverWidth, coverHeight);
    y += coverHeight + LINE_HEIGHT * 1.2;
  }

  /** Lời mở đầu, Nguồn gốc, Các chi, Người tiêu biểu, Lời kết: thẻ nền giấy, viền mảnh — như card trên web. */
  const writeCard = (heading: string, paragraphs: readonly string[]) => {
    // Đo xuống dòng bằng đúng cỡ chữ thân bài sẽ vẽ (không phải cỡ tiêu đề, to hơn nên làm xuống dòng quá sớm).
    doc.setFont(FONT, 'normal');
    doc.setFontSize(10.5);
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

  /** Chú thích chấm tròn, cùng nội dung với trang web, ở cuối trên Lời kết. */
  const writeLegend = () => {
    const entries: { label: string; draw: (cx: number, cy: number) => void }[] = [
      { label: 'Nam', draw: (cx, cy) => dot(cx, cy, { gender: 'nam', kind: 'dinh' }) },
      { label: 'Nữ', draw: (cx, cy) => dot(cx, cy, { gender: 'nu', kind: 'dinh' }) },
      { label: 'Dâu/Rể (viền đứt — vào họ, không cùng huyết thống)', draw: (cx, cy) => dot(cx, cy, { gender: 'nam', kind: 'dau_re' }) },
      {
        label: 'Con nuôi (chấm đặc cạnh tên)',
        draw: (cx, cy) => {
          doc.setFillColor(...COLOR.inkMuted);
          doc.circle(cx, cy, 0.9, 'F');
        },
      },
    ];
    doc.setFont(FONT, 'normal');
    doc.setFontSize(9);
    const cardHeight = CARD_PAD + LINE_HEIGHT * 1.1 + entries.length * 5.2 + CARD_PAD * 0.4;
    ensureSpace(cardHeight + LINE_HEIGHT * 0.5);
    doc.setFillColor(...COLOR.paper);
    doc.setDrawColor(...COLOR.line);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, maxWidth, cardHeight, 3, 3, 'FD');
    let cy = y + CARD_PAD;
    doc.setTextColor(...COLOR.inkMuted);
    doc.text('Chấm tròn trước mỗi tên dùng chung quy ước với Phả đồ:', MARGIN + CARD_PAD, cy);
    cy += LINE_HEIGHT * 1.1;
    for (const entry of entries) {
      entry.draw(MARGIN + CARD_PAD + 1.5, cy - 1.2);
      doc.setTextColor(...COLOR.inkMuted);
      doc.text(entry.label, MARGIN + CARD_PAD + 6, cy);
      cy += 5.2;
    }
    y += cardHeight + LINE_HEIGHT * 0.9;
  };

  for (const section of before) writeCard(section.heading, section.paragraphs);

  /**
   * Theo từng Đời, đúng bố cục trang web: tiêu đề Đời + thống kê + gạch chân đỏ nhạt; bên dưới là đường kẻ dọc,
   * mỗi người một chấm tròn nằm trên đường (viền vàng = Nam, đỏ = Nữ, nét đứt = Dâu/Rể), tên đậm,
   * nhãn vai trò dạng viên thuốc, chi tiết bên dưới.
   */
  const indent = 7;
  const railX = MARGIN + 1.3;
  const dot = (cx: number, cy: number, item: { gender: string | null; kind: NarrativeGeneration['items'][number]['kind'] }) => {
    const border: readonly [number, number, number] = item.gender === 'nam' ? COLOR.kim : item.gender === 'nu' ? COLOR.son : COLOR.neutral;
    doc.setFillColor(...COLOR.paper);
    doc.setDrawColor(...border);
    doc.setLineWidth(0.45);
    if (item.kind === 'dau_re') doc.setLineDashPattern([0.7, 0.5], 0);
    doc.circle(cx, cy, 1.5, 'FD');
    doc.setLineDashPattern([], 0);
  };

  if (before.length > 0 && generations.length > 0) y += SECTION_GAP - LINE_HEIGHT * 0.7;
  for (const group of generations) {
    doc.setFont(FONT, 'bold');
    doc.setFontSize(17);
    ensureSpace(LINE_HEIGHT * 5);
    doc.setTextColor(...COLOR.son);
    doc.text(`Đời ${group.generation}`, MARGIN, y);

    doc.setFont(FONT, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLOR.inkMuted);
    const stat = `${group.total} người${group.male + group.female > 0 ? ` · ${group.male} nam · ${group.female} nữ` : ''}`;
    doc.text(stat, PAGE_WIDTH - MARGIN, y, { align: 'right' });

    y += 2.5;
    doc.setDrawColor(...COLOR.sonSoft);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += LINE_HEIGHT * 1.4;

    let railFromY: number | null = null;
    let railPage = doc.getCurrentPageInfo().pageNumber;
    for (const [index, item] of group.items.entries()) {
      const photo = photos.people?.get(item.personId);
      const textWidth = maxWidth - indent - (photo ? PERSON_PHOTO + 3 : 0);
      doc.setFont(FONT, 'normal');
      doc.setFontSize(10.5);
      const detailLines = item.detail ? (doc.splitTextToSize(item.detail, textWidth) as string[]) : [];
      const headerHeight = LINE_HEIGHT * 1.05;
      const bodyHeight = detailLines.length * PARA_LINE;
      const itemHeight = Math.max(headerHeight + bodyHeight, photo ? PERSON_PHOTO : 0);
      ensureSpace(Math.min(itemHeight + ITEM_GAP, 90));

      const page = doc.getCurrentPageInfo().pageNumber;
      if (page !== railPage) {
        railPage = page;
        railFromY = null;
      }
      const itemTop = y;
      const dotY = itemTop - 1.3;
      const rowEnd = itemTop - LINE_HEIGHT * 0.75 + itemHeight + ITEM_GAP;
      // Đường kẻ dọc liền từ người này sang người kế (kể cả qua khoảng cách giữa hai người).
      doc.setDrawColor(...COLOR.line);
      doc.setLineWidth(0.5);
      // Người đầu danh sách: đường kẻ bắt đầu đúng tâm chấm tròn, không thò lên trên chấm.
      doc.line(railX, railFromY ?? dotY, railX, index === group.items.length - 1 ? rowEnd - ITEM_GAP : rowEnd);
      railFromY = rowEnd;

      dot(railX, dotY, item);

      doc.setFont(FONT, 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(...COLOR.ink);
      doc.text(item.name, MARGIN + indent, itemTop);
      let cursor = MARGIN + indent + doc.getTextWidth(item.name);

      if (item.adopted) {
        doc.setFillColor(...COLOR.inkMuted);
        doc.circle(cursor + 2, itemTop - 1.3, 0.9, 'F');
        cursor += 3.6;
      }
      if (item.lifespan) {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR.inkMuted);
        const lifespan = ` (${item.lifespan})`;
        doc.text(lifespan, cursor, itemTop);
        cursor += doc.getTextWidth(lifespan);
      }
      if (item.kind !== 'dinh') {
        const label = kindLabel(item.kind, item.gender);
        doc.setFont(FONT, 'bold');
        doc.setFontSize(8);
        const pillWidth = doc.getTextWidth(label) + 4;
        doc.setFillColor(...COLOR.sonSoft10);
        doc.roundedRect(cursor + 2.5, itemTop - 3.9, pillWidth, 4.6, 2.3, 2.3, 'F');
        doc.setTextColor(...COLOR.son);
        doc.text(label, cursor + 2.5 + pillWidth / 2, itemTop - 0.6, { align: 'center' });
      }

      // Ảnh nằm bên phải; chi tiết đã được xuống dòng hẹp lại cho vừa chỗ.
      if (photo) doc.addImage(photo, 'JPEG', PAGE_WIDTH - MARGIN - PERSON_PHOTO, itemTop - LINE_HEIGHT * 0.75, PERSON_PHOTO, PERSON_PHOTO);

      if (detailLines.length > 0) {
        doc.setFont(FONT, 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(...COLOR.ink);
        doc.text(detailLines, MARGIN + indent, itemTop + headerHeight);
      }
      y = rowEnd + LINE_HEIGHT * 0.75;
    }
    y += SECTION_GAP;
  }

  if (generations.length > 0) writeLegend();

  for (const section of after) writeCard(section.heading, section.paragraphs);

  // Số trang "n / tổng" giữa chân mỗi trang, nằm dưới vùng nội dung (lề dưới MARGIN).
  const pageCount = doc.getNumberOfPages();
  doc.setFont(FONT, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR.inkMuted);
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.text(`${page} / ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - MARGIN / 2, { align: 'center' });
  }

  return doc;
};
