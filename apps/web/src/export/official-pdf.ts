import { jsPDF } from 'jspdf';
import type { PdfFonts } from '../pha-do/pdf';

/**
 * Bộ khung chung của các PDF dạng văn bản chính thức (Dòng thời gian, Phả ký): A4, phông NotoSerif, bìa viền kép son–vàng kim,
 * đầu trang gạch đôi, chân trang "Trang n / N" (bìa tính là trang 1, không in số) và khối xác nhận. Từng loại PDF chỉ vẽ nội dung.
 */
export type Rgb = readonly [number, number, number];

/** Màu thương hiệu, lấy từ `--color-*` trong index.css (kimText = kim-text), cùng tông với trang web. */
export const COLOR = {
  son: [138, 28, 28] as Rgb,
  kim: [184, 137, 43] as Rgb,
  kimText: [138, 106, 31] as Rgb,
  ink: [31, 26, 23] as Rgb,
  inkMuted: [92, 83, 76] as Rgb,
  /** Kẻ ngang/dọc chính; `line` là kẻ nhạt giữa các hàng. */
  rule: [203, 191, 174] as Rgb,
  line: [228, 220, 209] as Rgb,
  /** Nền kem nhạt (mốc lịch sử, ô ảnh) và nền viên thuốc nhãn son. */
  tint: [247, 242, 232] as Rgb,
  sonPill: [244, 232, 229] as Rgb,
};

export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGIN = 19;
export const MID = PAGE_W / 2;
export const CONTENT_TOP = 30;
export const CONTENT_BOTTOM = 275;
const PT_MM = 0.3528;

export const dateLine = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return `Lập ngày ${day} tháng ${month} năm ${year}`;
};

type Meta = {
  /** Thuộc tính tiêu đề của file PDF. */
  title: string;
  /** Chữ in hoa giãn cách ở đầu mỗi trang nội dung, bên trái. */
  runningTitle: string;
  /** Tên gia phả: đầu trang bên phải. */
  treeName: string;
  /** Ngày lập, YYYY-MM-DD. */
  date: string;
};

export const createOfficialPdf = (fonts: PdfFonts, { title, runningTitle, treeName, date }: Meta) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.addFileToVFS('NotoSerif-Regular.ttf', fonts.regular);
  doc.addFileToVFS('NotoSerif-Bold.ttf', fonts.bold);
  doc.addFont('NotoSerif-Regular.ttf', 'NotoSerif', 'normal');
  doc.addFont('NotoSerif-Bold.ttf', 'NotoSerif', 'bold');
  doc.setProperties({ title, creator: 'Gia Phả' });

  const font = (size: number, bold: boolean, color: Rgb) => {
    doc.setFont('NotoSerif', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const stroke = (width: number, color: Rgb) => {
    doc.setLineWidth(width);
    doc.setDrawColor(...color);
  };
  /** Chữ giãn cách (em × cỡ chữ); căn giữa tính bỏ khoảng giãn sau ký tự cuối. Trả bề rộng đã vẽ. */
  const spaced = (text: string, x: number, y: number, em: number, align: 'left' | 'center') => {
    const space = em * doc.getFontSize() * PT_MM;
    const width = doc.getTextWidth(text) + space * (text.length - 1);
    doc.text(text, align === 'center' ? x - width / 2 : x, y, { charSpace: space });
    return width;
  };
  const diamond = (cx: number, cy: number, r: number, color: Rgb) => {
    doc.setFillColor(...color);
    doc.triangle(cx - r, cy, cx + r, cy, cx, cy - r, 'F');
    doc.triangle(cx - r, cy, cx + r, cy, cx, cy + r, 'F');
  };
  const ornament = (cy: number, arm: number, gap: number) => {
    stroke(0.26, COLOR.kim);
    doc.line(MID - gap - arm, cy, MID - gap, cy);
    doc.line(MID + gap, cy, MID + gap + arm, cy);
    diamond(MID, cy, 1.9, COLOR.kim);
  };

  /** Khung bìa, "GIA PHẢ" và gạch đỏ ngắn; tiêu đề và phần còn lại do từng PDF vẽ. */
  const coverTop = () => {
    stroke(0.8, COLOR.son);
    doc.rect(9.9, 9.9, PAGE_W - 19.8, PAGE_H - 19.8);
    stroke(0.26, COLOR.kim);
    doc.rect(12.45, 12.45, PAGE_W - 24.9, PAGE_H - 24.9);
    for (const [cx, cy] of [[10.85, 10.85], [PAGE_W - 10.85, 10.85], [10.85, PAGE_H - 10.85], [PAGE_W - 10.85, PAGE_H - 10.85]] as const) {
      diamond(cx, cy, 2.1, COLOR.kim);
    }
    font(11.25, true, COLOR.kimText);
    spaced('GIA PHẢ', MID, 56, 0.42, 'center');
    stroke(0.53, COLOR.son);
    doc.line(MID - 7.4, 63.5, MID + 7.4, 63.5);
  };
  /** Gạch ngang và ngày lập ở chân bìa. */
  const coverBottom = () => {
    stroke(0.26, COLOR.rule);
    doc.line(33.6, 252, PAGE_W - 33.6, 252);
    font(11.25, false, COLOR.inkMuted);
    doc.text(dateLine(date), MID, 259, { align: 'center' });
  };

  /** Sang trang mới kèm đầu trang (tên loại văn bản bên trái, tên gia phả bên phải, gạch đôi son). */
  const newPage = () => {
    doc.addPage();
    font(9, true, COLOR.son);
    spaced(runningTitle, MARGIN, 17.5, 0.24, 'left');
    font(10, false, COLOR.inkMuted);
    doc.text((doc.splitTextToSize(treeName, 100) as string[])[0] ?? '', PAGE_W - MARGIN, 17.5, { align: 'right' });
    stroke(0.34, COLOR.son);
    doc.line(MARGIN, 21, PAGE_W - MARGIN, 21);
    doc.line(MARGIN, 22, PAGE_W - MARGIN, 22);
  };

  /** Khối "Xác nhận" (người lập, trưởng tộc) từ y trở xuống; `compact` cho ít chỗ ký hơn. Trả y cuối khối. */
  const signature = (top: number, compact: boolean) => {
    let y = top + (compact ? 9.5 : 17);
    ornament(y, 18.5, 3.7);
    y += 8;
    font(10.5, true, COLOR.son);
    spaced('XÁC NHẬN', MID, y, 0.24, 'center');
    y += 9;
    font(11.25, false, COLOR.ink);
    doc.text('………………, ngày ….. tháng ….. năm …….', PAGE_W - MARGIN, y, { align: 'right' });
    y += compact ? 5.3 : 8;
    const columnW = (PAGE_W - MARGIN * 2 - 12.7) / 2;
    const lineAt = compact ? 35.3 : 42.2;
    for (const [index, role] of ['Người lập', 'Trưởng tộc / Trưởng họ'].entries()) {
      const left = MARGIN + index * (columnW + 12.7);
      font(12, true, COLOR.ink);
      doc.text(role, left + columnW / 2, y + 4.3, { align: 'center' });
      font(9.75, false, COLOR.inkMuted);
      doc.text('(Ký, ghi rõ họ tên)', left + columnW / 2, y + 10.2, { align: 'center' });
      stroke(0.26, COLOR.ink);
      doc.line(left, y + lineAt, left + columnW, y + lineAt);
    }
    return y + lineAt;
  };
  const signatureHeight = (compact: boolean) => (compact ? 72 : 90);

  /** Chân trang các trang 2..N: kẻ mảnh, ngày lập bên trái, "Trang n / N" bên phải. */
  const finish = () => {
    const pageCount = doc.getNumberOfPages();
    for (let page = 2; page <= pageCount; page += 1) {
      doc.setPage(page);
      stroke(0.26, COLOR.rule);
      doc.line(MARGIN, 279.6, PAGE_W - MARGIN, 279.6);
      font(9, false, COLOR.inkMuted);
      doc.text(dateLine(date), MARGIN, 284.6);
      doc.text(`Trang ${page} / ${pageCount}`, PAGE_W - MARGIN, 284.6, { align: 'right' });
    }
    return doc;
  };

  return { doc, font, stroke, spaced, diamond, ornament, coverTop, coverBottom, newPage, signature, signatureHeight, finish };
};
