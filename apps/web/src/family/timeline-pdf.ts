import type { PdfFonts } from '../pha-do/pdf';
import { COLOR, CONTENT_BOTTOM, CONTENT_TOP, createOfficialPdf, MARGIN, MID, PAGE_W, type Rgb } from '../export/official-pdf';
import { KIND_LABEL, type TimelineEntry, type TimelineKind } from './timeline';

/** Màu nhãn từng loại mốc: đúng các màu `text-la/kim-text/son/tram` của trang web. */
const KIND_COLOR: Record<TimelineKind, Rgb> = { sinh: [47, 111, 78], cuoi: COLOR.kimText, mat: COLOR.son, su_kien: [38, 102, 110], lich_su: [43, 92, 138] };

const YEAR_W = 24.3;
const YEAR_MIN_H = 14;
const ENTRY_X = MARGIN + YEAR_W + 5.3;
const TEXT_X = ENTRY_X + 23.3;
const TEXT_W = PAGE_W - MARGIN - TEXT_X;
const PAD = 1.6;
const PHOTO_W = 52;
const PHOTO_H = 36;

type Meta = { treeName: string; /** Ngày lập, YYYY-MM-DD. */ date: string };

/**
 * Dòng thời gian ra PDF khổ A4 theo dạng văn bản chính thức, cùng bố cục với trang web (cột năm, nhãn loại mốc, mốc lịch sử
 * nền kem): trang bìa viền kép, các trang bảng có đầu/chân trang, trang cuối có khối xác nhận.
 */
export const timelineToPdf = (entries: readonly TimelineEntry[], fonts: PdfFonts, { treeName, date }: Meta) => {
  const { doc, font, stroke, spaced, ornament, coverTop, coverBottom, newPage: startPage, signature, signatureHeight, finish } = createOfficialPdf(fonts, {
    title: `Dòng thời gian ${treeName}`,
    runningTitle: 'DÒNG THỜI GIAN',
    treeName,
    date,
  });

  // ── Trang bìa ────────────────────────────────────────────────────────────────
  coverTop();

  font(40.5, true, COLOR.son);
  spaced('DÒNG', MID, 92, 0.06, 'center');
  spaced('THỜI GIAN', MID, 109.5, 0.06, 'center');
  ornament(128, 23.8, 6.8);

  let nameSize = 27;
  font(nameSize, true, COLOR.ink);
  while (nameSize > 14 && doc.getTextWidth(treeName) > 150) {
    nameSize -= 1;
    doc.setFontSize(nameSize);
  }
  // Tên dài xuống tối đa hai dòng thay vì tràn ra ngoài khung bìa.
  const nameLines = (doc.splitTextToSize(treeName, 150) as string[]).slice(0, 2);
  nameLines.forEach((line, index) => doc.text(line, MID, 146 - (nameLines.length - 1) * 5 + index * 10, { align: 'center' }));
  font(13.5, false, COLOR.inkMuted);
  doc.text('Các mốc sinh, kết hôn, qua đời và sự kiện', MID, 157, { align: 'center' });
  doc.text('của gia đình theo năm', MID, 164.6, { align: 'center' });

  if (entries.length > 0) {
    font(15, true, COLOR.son);
    // Danh sách đã xếp theo năm: năm đầu và năm cuối là hai đầu mảng.
    spaced(`${entries[0]!.year} — ${entries.at(-1)!.year}`, MID, 246, 0.12, 'center');
  }
  coverBottom();

  // ── Các trang bảng ───────────────────────────────────────────────────────────
  let y = CONTENT_TOP;
  let blockTop = 0;
  let blockOpen = false;

  const newPage = () => {
    startPage();
    y = CONTENT_TOP;
  };
  /** Một khối = một năm trên một trang: kẻ trên, số năm, rồi (khi đóng) kẻ dọc phân cách cột năm. */
  const openBlock = (year: number) => {
    stroke(0.26, COLOR.rule);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    blockTop = y;
    font(18, true, COLOR.son);
    doc.text(String(year), MARGIN, y + 8.6);
    y += PAD;
    blockOpen = true;
  };
  const closeBlock = () => {
    if (!blockOpen) return;
    y = Math.max(y + PAD, blockTop + YEAR_MIN_H);
    stroke(0.26, COLOR.rule);
    doc.line(MARGIN + YEAR_W, blockTop, MARGIN + YEAR_W, y);
    blockOpen = false;
  };

  /** Xuống dòng theo cỡ chữ đậm (rộng hơn) rồi tách mỗi dòng thành phần tên (đậm) + phần còn lại (thường). */
  const layout = (entry: TimelineEntry) => {
    const history = entry.kind === 'lich_su';
    const size = history ? 11.25 : 12;
    const lineHeight = history ? 5.75 : 6.1;
    const subjectLength = history ? 0 : (entry.subject?.length ?? 0);
    font(size, !history, COLOR.ink);
    const wrapped = doc.splitTextToSize(entry.text, TEXT_W) as string[];
    let from = 0;
    const lines = wrapped.map((line) => {
      // splitTextToSize bỏ khoảng trắng ở chỗ ngắt dòng; không tìm thấy thì coi như dòng nối tiếp.
      const found = entry.text.indexOf(line, from);
      const start = found === -1 ? from : found;
      from = start + line.length;
      const cut = Math.max(0, Math.min(line.length, subjectLength - start));
      return [
        { text: line.slice(0, cut), bold: true },
        { text: line.slice(cut), bold: false },
      ].filter((run) => run.text);
    });
    const runWidth = (run: { text: string; bold: boolean }) => (font(size, run.bold, COLOR.ink), doc.getTextWidth(run.text));
    const lastWidth = (lines.at(-1) ?? []).reduce((total, run) => total + runWidth(run), 0);
    const detail = entry.detail ? `— ${entry.detail}` : '';
    font(10.5, false, COLOR.inkMuted);
    const inline = detail !== '' && lastWidth + doc.getTextWidth(` ${detail}`) <= TEXT_W;
    const detailLines = detail === '' || inline ? [] : (doc.splitTextToSize(detail, TEXT_W) as string[]);
    // Sự kiện: mô tả (chữ nhạt) và ảnh đầu tiên bên dưới, rộng tối đa PHOTO_W, cao tối đa PHOTO_H.
    font(10.5, false, COLOR.inkMuted);
    let descLines = entry.description ? (doc.splitTextToSize(entry.description, TEXT_W) as string[]) : [];
    let photoW = 0;
    let photoH = 0;
    if (entry.photo) {
      const { width, height: imageHeight } = doc.getImageProperties(entry.photo);
      const scale = Math.min(PHOTO_W / width, PHOTO_H / imageHeight);
      photoW = width * scale;
      photoH = imageHeight * scale;
    }
    // Một mốc không được dài hơn một trang (không có chỗ ngắt giữa mốc): mô tả quá dài bị cắt bớt, thêm "…".
    const room = CONTENT_BOTTOM - CONTENT_TOP - PAD * 2 - (photoH > 0 ? photoH + 1.5 : 0);
    const maxLines = Math.max(lines.length + detailLines.length + 1, Math.floor(room / lineHeight));
    const descAllowed = maxLines - lines.length - detailLines.length;
    if (descLines.length > descAllowed) {
      descLines = descLines.slice(0, descAllowed);
      descLines[descAllowed - 1] = `${descLines[descAllowed - 1]!.trimEnd().replace(/[.,;:]+$/, '')}…`;
    }
    const height = PAD * 2 + (lines.length + detailLines.length + descLines.length) * lineHeight + (photoH > 0 ? photoH + 1.5 : 0);
    return { history, size, lineHeight, lines, lastWidth, detail, inline, detailLines, descLines, photoW, photoH, height };
  };
  const drawEntry = (entry: TimelineEntry, item: ReturnType<typeof layout>) => {
    const { history, size, lineHeight, lines, lastWidth, detail, inline, detailLines, descLines, photoW, photoH, height } = item;
    if (history) {
      doc.setFillColor(...COLOR.tint);
      doc.rect(ENTRY_X - 2.1, y, PAGE_W - MARGIN - ENTRY_X + 2.1, height, 'F');
    }
    const baseline = y + PAD + lineHeight * 0.71;
    font(8, true, KIND_COLOR[entry.kind]);
    spaced(KIND_LABEL[entry.kind].toUpperCase(), ENTRY_X, baseline, 0.14, 'left');

    let lineY = baseline;
    for (const runs of lines) {
      let x = TEXT_X;
      for (const run of runs) {
        font(size, run.bold, history ? COLOR.inkMuted : COLOR.ink);
        doc.text(run.text, x, lineY);
        x += doc.getTextWidth(run.text);
      }
      lineY += lineHeight;
    }
    font(10.5, false, COLOR.inkMuted);
    if (inline) doc.text(` ${detail}`, TEXT_X + lastWidth, lineY - lineHeight);
    for (const line of detailLines) {
      doc.text(line, TEXT_X, lineY);
      lineY += lineHeight;
    }
    for (const line of descLines) {
      doc.text(line, TEXT_X, lineY);
      lineY += lineHeight;
    }
    if (entry.photo && photoH > 0) doc.addImage(entry.photo, doc.getImageProperties(entry.photo).fileType, TEXT_X, lineY - lineHeight * 0.71 + 1, photoW, photoH);
    y += height;
  };

  const byYear = new Map<number, TimelineEntry[]>();
  for (const entry of entries) byYear.set(entry.year, [...(byYear.get(entry.year) ?? []), entry]);

  newPage();
  for (const [year, items] of byYear) {
    const laid = items.map((entry) => ({ entry, item: layout(entry) }));
    // Mốc đầu của năm phải vừa trang cùng số năm; không thì cả năm sang trang mới.
    if (y + Math.max(YEAR_MIN_H, laid[0]!.item.height + PAD) > CONTENT_BOTTOM) newPage();
    openBlock(year);
    for (const { entry, item } of laid) {
      if (y + item.height + PAD > CONTENT_BOTTOM) {
        closeBlock();
        newPage();
        openBlock(year);
      }
      drawEntry(entry, item);
    }
    closeBlock();
  }
  stroke(0.26, COLOR.rule);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  // ── Khối xác nhận ────────────────────────────────────────────────────────────
  if (y + signatureHeight(false) > CONTENT_BOTTOM) newPage();
  signature(y, false);
  return finish();
};
