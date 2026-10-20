import { COLOR, CONTENT_BOTTOM, CONTENT_TOP, createOfficialPdf, MARGIN, MID, PAGE_W, type Rgb } from '../export/official-pdf';
import { kindLabel } from '../family/labels';
import type { PdfFonts } from '../pha-do/pdf';
import type { NarrativeGeneration } from './narrative';
import type { PhaKyEvent, PhaKySection } from './sections';

/** Ảnh nhúng vào PDF (data URL JPEG): ảnh cả gia phả dưới tiêu đề bìa, ảnh đại diện từng Người theo personId. */
export type PdfPhotos = {
  cover?: string | undefined;
  people?: ReadonlyMap<string, string> | undefined;
  /** Ảnh đầu tiên của từng sự kiện, theo id sự kiện. */
  events?: ReadonlyMap<string, string> | undefined;
};

const WIDTH = PAGE_W - MARGIN * 2;
const SECTION_GAP = 9.5;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const BODY = { size: 12, lineHeight: 6.98 };
const ROW_LINE = 6.35;
const ROW_PAD = 2.1;
const TEXT_X = MARGIN + 9;
const PHOTO = 19;
const NAME_LINE = 6.67;
/** Màu viền chấm giới tính (nền trắng): vàng kim = Nam, đỏ son = Nữ, xám = chưa rõ. */
const GENDER_BORDER: Record<'nam' | 'nu' | 'unknown', Rgb> = { nam: COLOR.kim, nu: COLOR.son, unknown: [163, 154, 143] };
const RAIL_X = MARGIN + 1.6;

type Meta = { treeName: string; /** Ngày lập, YYYY-MM-DD. */ date: string };

/**
 * Phả ký ra PDF khổ A4 theo dạng văn bản chính thức, cùng khung với Dòng thời gian (bìa viền kép, đầu/chân trang, khối xác nhận):
 * các mục I–IV (đoạn văn, bảng), từng Đời với chấm tròn giới tính và ảnh, chú giải, Lời kết. Bố cục theo trang web Phả ký.
 */
export const narrativeToPdf = (
  generations: readonly NarrativeGeneration[],
  fonts: PdfFonts,
  { treeName, date }: Meta,
  front: readonly PhaKySection[],
  closing: string | null,
  photos: PdfPhotos = {},
) => {
  const { doc, font, stroke, spaced, ornament, coverTop, coverBottom, newPage: startPage, signature, signatureHeight, finish } = createOfficialPdf(fonts, {
    title: `Phả ký ${treeName}`,
    runningTitle: 'PHẢ KÝ',
    treeName,
    date,
  });

  // ── Trang bìa ────────────────────────────────────────────────────────────────
  coverTop();
  font(54, true, COLOR.son);
  spaced('PHẢ KÝ', MID, 99, 0.1, 'center');
  ornament(115.3, 23.8, 6.8);
  let nameSize = 27;
  font(nameSize, true, COLOR.ink);
  while (nameSize > 14 && doc.getTextWidth(treeName) > 150) {
    nameSize -= 1;
    doc.setFontSize(nameSize);
  }
  doc.text(treeName, MID, 137, { align: 'center' });
  font(13.5, false, COLOR.inkMuted);
  doc.text('Nguồn gốc, các chi, nhân vật tiêu biểu', MID, 148, { align: 'center' });
  doc.text('và tường thuật từng đời', MID, 155.6, { align: 'center' });
  if (photos.cover) {
    const { width, height } = doc.getImageProperties(photos.cover);
    const h = Math.min(50, (90 * height) / width);
    const w = (h * width) / height;
    doc.addImage(photos.cover, 'JPEG', MID - w / 2, 168, w, h);
  }
  const progenitor = front.find((section) => section.kind === 'origin');
  if (progenitor?.kind === 'origin') {
    font(9, true, COLOR.kimText);
    spaced('THUỶ TỔ', MID, 236, 0.2, 'center');
    font(15, true, COLOR.son);
    doc.text(progenitor.progenitorName, MID, 244.5, { align: 'center' });
  }
  coverBottom();

  // ── Các trang nội dung ───────────────────────────────────────────────────────
  let y = CONTENT_TOP;
  /** Đường kẻ dọc nối các chấm của một Đời: vẽ từng đoạn theo từng trang; chấm vẽ sau cùng để nằm đè lên đường. */
  let railFrom: number | null = null;
  const deferredDots: { page: number; cy: number; gender: string | null; dashed: boolean }[] = [];
  let railLast = 0;
  /** Vẽ đoạn đường từ chấm đầu đến chấm cuối của trang hiện tại (không thò ra ngoài hai chấm). */
  const flushRail = () => {
    if (railFrom !== null && railLast > railFrom) {
      stroke(0.5, COLOR.rule);
      doc.line(RAIL_X, railFrom, RAIL_X, railLast);
    }
    railFrom = null;
  };
  const newPage = () => {
    flushRail();
    startPage();
    y = CONTENT_TOP;
  };
  startPage();
  const ensure = (height: number) => {
    if (y + height > CONTENT_BOTTOM) newPage();
  };
  const gap = (amount = SECTION_GAP) => {
    if (y > CONTENT_TOP) y += amount;
  };

  /** Dòng căn đều hai bên: giãn đều khoảng trắng giữa các từ. */
  const justified = (line: string, x: number, baseline: number, width: number) => {
    const words = line.split(' ');
    const extra = words.length > 1 ? (width - doc.getTextWidth(line)) / (words.length - 1) : 0;
    let cursor = x;
    for (const word of words) {
      doc.text(word, cursor, baseline);
      cursor += doc.getTextWidth(`${word} `) + extra;
    }
  };
  /** Đoạn văn căn đều (dòng cuối căn trái), tự sang trang giữa hai dòng. */
  const paragraph = (text: string, x: number, width: number, size: number, lineHeight: number, color: Rgb) => {
    font(size, false, color);
    const lines = doc.splitTextToSize(text, width) as string[];
    for (const [index, line] of lines.entries()) {
      ensure(lineHeight);
      font(size, false, color);
      const baseline = y + lineHeight * 0.72;
      if (index < lines.length - 1) justified(line, x, baseline, width);
      else doc.text(line, x, baseline);
      y += lineHeight;
    }
  };

  /** Tiêu đề mục: số La Mã vàng kim + tên son đậm, gạch chân vàng kim. */
  const sectionHeading = (numeral: string | null, title: string) => {
    gap();
    ensure(12.9 + 18);
    let x = MARGIN;
    if (numeral) {
      font(10.5, true, COLOR.kimText);
      x += spaced(`${numeral}.`, MARGIN, y + 5.8, 0.1, 'left') + 3.7;
    }
    font(16.5, true, COLOR.son);
    doc.text(title, x, y + 5.8);
    stroke(0.26, COLOR.kim);
    doc.line(MARGIN, y + 9.2, PAGE_W - MARGIN, y + 9.2);
    y += 12.9;
  };
  const rowRule = (color: Rgb) => {
    stroke(0.26, color);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  };

  const factsTable = (facts: readonly { label: string; value: string }[]) => {
    const labelW = 39.7;
    const valueX = MARGIN + labelW + 3.2;
    y += 3.2;
    rowRule(COLOR.rule);
    for (const [index, fact] of facts.entries()) {
      font(12, false, COLOR.ink);
      const lines = doc.splitTextToSize(fact.value, PAGE_W - MARGIN - valueX) as string[];
      const height = ROW_PAD * 2 + lines.length * ROW_LINE;
      ensure(height);
      const baseline = y + ROW_PAD + ROW_LINE * 0.72;
      font(8.25, true, COLOR.kimText);
      spaced(fact.label.toUpperCase(), MARGIN, baseline, 0.14, 'left');
      font(12, false, COLOR.ink);
      doc.text(lines, valueX, baseline, { lineHeightFactor: ROW_LINE / (12 * 0.3528) });
      y += height;
      rowRule(index === facts.length - 1 ? COLOR.rule : COLOR.line);
    }
  };

  const branchesTable = (items: readonly { name: string; memberCount: number }[]) => {
    const nameX = MARGIN + 23.8 + 3.2;
    y += 3.2;
    ensure(7.6 + ROW_PAD * 2 + ROW_LINE);
    stroke(0.53, COLOR.son);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    font(8.25, true, COLOR.inkMuted);
    const head = y + 1.6 + 3.1;
    spaced('CHI', MARGIN, head, 0.14, 'left');
    spaced('NGƯỜI ĐỨNG ĐẦU CHI', nameX, head, 0.14, 'left');
    const right = 'THÀNH VIÊN';
    const width = doc.getTextWidth(right) + 0.14 * 8.25 * 0.3528 * (right.length - 1);
    spaced(right, PAGE_W - MARGIN - width, head, 0.14, 'left');
    y += 7.6;
    rowRule(COLOR.rule);
    for (const [index, item] of items.entries()) {
      const height = ROW_PAD * 2 + ROW_LINE;
      ensure(height);
      const baseline = y + ROW_PAD + ROW_LINE * 0.72;
      font(12, true, COLOR.son);
      doc.text(`Chi ${index + 1}`, MARGIN, baseline);
      font(12, false, COLOR.ink);
      doc.text(item.name, nameX, baseline);
      doc.text(`${item.memberCount} người`, PAGE_W - MARGIN, baseline, { align: 'right' });
      y += height;
      rowRule(index === items.length - 1 ? COLOR.rule : COLOR.line);
    }
  };

  const notableList = (items: readonly { name: string; title: string }[]) => {
    y += 2.1;
    for (const [index, item] of items.entries()) {
      const height = ROW_PAD * 2 + ROW_LINE;
      ensure(height);
      const baseline = y + ROW_PAD + ROW_LINE * 0.72;
      font(12, true, COLOR.ink);
      doc.text(item.name, MARGIN, baseline);
      font(12, false, COLOR.inkMuted);
      doc.text(item.title, PAGE_W - MARGIN, baseline, { align: 'right' });
      y += height;
      rowRule(index === items.length - 1 ? COLOR.rule : COLOR.line);
    }
  };

  /** Mỗi sự kiện: tên đậm, thời gian, chủ trì, mô tả; ảnh đầu tiên (nếu có) nằm bên phải. */
  const eventsList = (items: readonly PhaKyEvent[]) => {
    const PHOTO_W = 34;
    const PHOTO_H = 25.5;
    y += 2.1;
    for (const [index, item] of items.entries()) {
      const photo = photos.events?.get(item.id);
      const textW = photo ? WIDTH - PHOTO_W - 4 : WIDTH;
      font(12, true, COLOR.ink);
      const titleLines = doc.splitTextToSize(item.title, textW) as string[];
      font(10.5, false, COLOR.inkMuted);
      const whenLines = doc.splitTextToSize(item.when, textW) as string[];
      font(11, false, COLOR.ink);
      const hostLines = item.host ? (doc.splitTextToSize(`Chủ trì: ${item.host}`, textW) as string[]) : [];
      font(11.5, false, COLOR.ink);
      const descLines = item.description ? (doc.splitTextToSize(item.description, textW) as string[]) : [];
      const textHeight = titleLines.length * ROW_LINE + (whenLines.length + hostLines.length) * 5.4 + descLines.length * 6;
      const height = ROW_PAD * 2 + Math.max(textHeight, photo ? PHOTO_H : 0);
      ensure(height);
      let lineY = y + ROW_PAD + ROW_LINE * 0.72;
      font(12, true, COLOR.ink);
      for (const line of titleLines) {
        doc.text(line, MARGIN, lineY);
        lineY += ROW_LINE;
      }
      font(10.5, false, COLOR.inkMuted);
      lineY -= ROW_LINE - 5.4;
      for (const line of whenLines) {
        doc.text(line, MARGIN, lineY);
        lineY += 5.4;
      }
      font(11, false, COLOR.ink);
      for (const line of hostLines) {
        doc.text(line, MARGIN, lineY);
        lineY += 5.4;
      }
      font(11.5, false, COLOR.ink);
      for (const line of descLines) {
        doc.text(line, MARGIN, lineY + 0.6);
        lineY += 6;
      }
      if (photo) {
        const { width, height: imageHeight } = doc.getImageProperties(photo);
        const scale = Math.min(PHOTO_W / width, PHOTO_H / imageHeight);
        const w = width * scale;
        const h = imageHeight * scale;
        doc.addImage(photo, 'JPEG', PAGE_W - MARGIN - w, y + ROW_PAD, w, h);
      }
      y += height;
      rowRule(index === items.length - 1 ? COLOR.rule : COLOR.line);
    }
  };

  for (const [index, section] of front.entries()) {
    sectionHeading(ROMAN[index] ?? null, section.heading);
    y += 0.5;
    switch (section.kind) {
      case 'intro':
        for (const text of section.text.split('\n').filter((line) => line.trim())) {
          paragraph(text.trim(), MARGIN, WIDTH, BODY.size, BODY.lineHeight, COLOR.ink);
          y += 1.5;
        }
        break;
      case 'origin':
        paragraph(`${section.before}${section.progenitorName}${section.after}`, MARGIN, WIDTH, BODY.size, BODY.lineHeight, COLOR.ink);
        if (section.facts.length > 0) factsTable(section.facts);
        break;
      case 'branches':
        branchesTable(section.items);
        break;
      case 'notable':
        notableList(section.items);
        break;
      case 'events':
        eventsList(section.items);
        break;
    }
  }

  /** Chấm tròn giới tính: viền vàng = Nam, đỏ = Nữ, xám = chưa rõ, nền trắng; nét đứt = Dâu/Rể (cùng quy ước Phả đồ). */
  const dot = (cx: number, cy: number, gender: string | null, dashed: boolean) => {
    stroke(0.53, gender === 'nam' ? GENDER_BORDER.nam : gender === 'nu' ? GENDER_BORDER.nu : GENDER_BORDER.unknown);
    doc.setFillColor(255, 255, 255);
    if (dashed) doc.setLineDashPattern([0.7, 0.5], 0);
    doc.circle(cx, cy, 1.35, 'FD');
    doc.setLineDashPattern([], 0);
  };

  /** Một Người: chấm tròn, tên đậm + (năm sinh–mất) + nhãn vai trò, đoạn mô tả căn đều, ảnh bên phải. */
  const person = (item: NarrativeGeneration['items'][number]) => {
    const photo = photos.people?.get(item.personId);
    const textRight = photo ? PAGE_W - MARGIN - PHOTO - 2.1 : PAGE_W - MARGIN;
    const textWidth = textRight - TEXT_X;
    font(11.25, false, COLOR.ink);
    const detailLines = item.detail ? (doc.splitTextToSize(item.detail, textWidth) as string[]) : [];
    ensure(3.7 + NAME_LINE + (detailLines.length > 0 ? 1.06 + ROW_LINE * Math.min(2, detailLines.length) : 0));

    const rowTop = y;
    const startPageNumber = doc.getCurrentPageInfo().pageNumber;
    if (railFrom === null) railFrom = rowTop + 7.15;
    railLast = rowTop + 7.15;
    deferredDots.push({ page: startPageNumber, cy: rowTop + 7.15, gender: item.gender, dashed: item.kind === 'dau_re' });

    // Dòng tên: tên, chấm con nuôi, (năm), nhãn vai trò; hết chỗ thì xuống dòng.
    let x = TEXT_X;
    let baseline = rowTop + 3.7 + 4.9;
    const place = (width: number, draw: (at: number) => void) => {
      if (x > TEXT_X && x + width > textRight) {
        x = TEXT_X;
        baseline += NAME_LINE;
      }
      draw(x);
      x += width;
    };
    font(13.5, true, COLOR.ink);
    place(doc.getTextWidth(item.name), (at) => doc.text(item.name, at, baseline));
    if (item.adopted) {
      x += 1.6;
      place(1.1, (at) => {
        doc.setFillColor(...COLOR.inkMuted);
        doc.circle(at + 0.55, baseline - 1.3, 0.55, 'F');
      });
    }
    if (item.lifespan) {
      x += 2.65;
      font(10.5, false, COLOR.inkMuted);
      const text = `(${item.lifespan})`;
      place(doc.getTextWidth(text), (at) => doc.text(text, at, baseline));
    }
    if (item.kind !== 'dinh') {
      x += 2.65;
      const label = kindLabel(item.kind, item.gender).toUpperCase();
      font(8.25, true, COLOR.son);
      const width = doc.getTextWidth(label) + 0.12 * 8.25 * 0.3528 * (label.length - 1);
      place(width + 4.2, (at) => {
        doc.setFillColor(...COLOR.sonPill);
        doc.roundedRect(at, baseline - 3.6, width + 4.2, 4.8, 2.4, 2.4, 'F');
        font(8.25, true, COLOR.son);
        spaced(label, at + 2.1, baseline - 0.3, 0.12, 'left');
      });
    }
    y = baseline - 4.9 + NAME_LINE;

    if (detailLines.length > 0) {
      y += 1.06;
      font(11.25, false, COLOR.ink);
      for (const [index, line] of detailLines.entries()) {
        ensure(ROW_LINE);
        font(11.25, false, COLOR.ink);
        const lineBase = y + ROW_LINE * 0.72;
        if (index < detailLines.length - 1) justified(line, TEXT_X, lineBase, textWidth);
        else doc.text(line, TEXT_X, lineBase);
        y += ROW_LINE;
      }
    }
    if (photo) {
      // Ảnh cạnh đầu mục; nếu mô tả đã tràn sang trang khác thì ảnh nằm ở trang của đầu mục.
      const current = doc.getCurrentPageInfo().pageNumber;
      doc.setPage(startPageNumber);
      doc.addImage(photo, 'JPEG', PAGE_W - MARGIN - PHOTO, rowTop + 3.7, PHOTO, PHOTO);
      doc.setPage(current);
      if (current === startPageNumber) y = Math.max(y, rowTop + 3.7 + PHOTO);
    }
    y += 3.7;
  };

  for (const group of generations) {
    gap();
    ensure(11.8 + 28);
    font(21, true, COLOR.son);
    doc.text(`Đời ${group.generation}`, MARGIN, y + 6.9);
    font(9.75, false, COLOR.inkMuted);
    const stat = `${group.total} người${group.male + group.female > 0 ? ` · ${group.male} nam · ${group.female} nữ` : ''}`;
    doc.text(stat, PAGE_W - MARGIN, y + 6.9, { align: 'right' });
    stroke(0.26, COLOR.son);
    doc.line(MARGIN, y + 11, PAGE_W - MARGIN, y + 11);
    doc.line(MARGIN, y + 11.8, PAGE_W - MARGIN, y + 11.8);
    y += 11.8;
    railFrom = null;
    for (const item of group.items) person(item);
    flushRail();
  }
  const lastPage = doc.getNumberOfPages();
  for (const { page, cy, gender, dashed } of deferredDots) {
    doc.setPage(page);
    dot(RAIL_X, cy, gender, dashed);
  }
  doc.setPage(lastPage);

  /** Chú giải chấm tròn (bảng 2×2), cùng nội dung với trang web. */
  if (generations.length > 0) {
    gap(10.6);
    ensure(4.6 + 9.4 * 2 + 2);
    font(9, true, COLOR.inkMuted);
    spaced('CHÚ GIẢI', MARGIN, y + 3, 0.14, 'left');
    y += 4.6;
    rowRule(COLOR.rule);
    const cells: { label: string; draw: (cx: number, cy: number) => void }[] = [
      { label: 'Nam', draw: (cx, cy) => dot(cx, cy, 'nam', false) },
      { label: 'Nữ', draw: (cx, cy) => dot(cx, cy, 'nu', false) },
      { label: 'Dâu / Rể (vào họ, không cùng huyết thống)', draw: (cx, cy) => dot(cx, cy, 'nu', true) },
      {
        label: 'Con nuôi (chấm đặc cạnh tên)',
        draw: (cx, cy) => {
          doc.setFillColor(...COLOR.inkMuted);
          doc.circle(cx, cy, 1.05, 'F');
        },
      },
    ];
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const cell = cells[row * 2 + col]!;
        const left = MARGIN + col * (WIDTH / 2);
        cell.draw(left + 1.6, y + 4.7);
        font(9.75, false, COLOR.inkMuted);
        doc.text(cell.label, left + 3.2 + 2.65, y + 4.7 + 1.2);
      }
      y += 9.4;
      rowRule(row === 1 ? COLOR.rule : COLOR.line);
    }
  }

  if (closing) {
    sectionHeading(null, 'Lời kết');
    y += 0.5;
    paragraph(closing, MARGIN, WIDTH, BODY.size, BODY.lineHeight, COLOR.ink);
  }

  if (generations.length > 0) {
    ensure(signatureHeight(true));
    signature(y, true);
  }
  return finish();
};
