import { PT_PER_MM, type DrawItem } from './drawing';

/**
 * Trang trí Phả đồ (ticket 17): khung truyền thống, tiêu đề, phụ đề, câu đối hai bên.
 * Trả về các phần tử vẽ (mm) và vùng còn trống ở giữa để đặt cây.
 */

export type FrameStyle = 'son-kim' | 'moc' | 'thanh-nha' | 'none';

export const FRAME_LABELS: Record<FrameStyle, string> = {
  'son-kim': 'Đỏ son – vàng kim',
  moc: 'Mộc (nâu gỗ)',
  'thanh-nha': 'Thanh nhã (mực đen)',
  none: 'Không khung',
};

export type Decoration = {
  frame: FrameStyle;
  /** Để trống thì dùng "Gia phả <tên gia phả>". */
  title: string;
  subtitle: string;
  coupletLeft: string;
  coupletRight: string;
};

export const DEFAULT_DECORATION: Decoration = { frame: 'son-kim', title: '', subtitle: '', coupletLeft: '', coupletRight: '' };

type Palette = { background: string; outer: string; inner: string; ornament: string; title: string; text: string };

const PALETTES: Record<FrameStyle, Palette> = {
  'son-kim': { background: '#fbf4e4', outer: '#8a1c1c', inner: '#b8892b', ornament: '#b8892b', title: '#8a1c1c', text: '#5a2a12' },
  moc: { background: '#f3eadb', outer: '#6b4a2b', inner: '#a27b4f', ornament: '#6b4a2b', title: '#4a3018', text: '#4a3018' },
  'thanh-nha': { background: '#ffffff', outer: '#1f1a17', inner: '#1f1a17', ornament: '#1f1a17', title: '#1f1a17', text: '#1f1a17' },
  none: { background: '#ffffff', outer: '#ffffff', inner: '#ffffff', ornament: '#ffffff', title: '#8a1c1c', text: '#1f1a17' },
};

export type Region = { x: number; y: number; width: number; height: number };

export type DecorationLayout = {
  /** Vẽ trước cây (nền, viền). */
  below: DrawItem[];
  /** Vẽ sau cây (chữ tiêu đề, câu đối). */
  above: DrawItem[];
  /** Vùng dành cho cây. */
  content: Region;
};

const BASE_MARGIN = 12;

/** Hoạ tiết hồi văn (móc vuông) ở một góc; `sx`, `sy` là hướng quay vào trong trang. */
const cornerKey = (cx: number, cy: number, size: number, sx: 1 | -1, sy: 1 | -1, color: string, width: number): DrawItem[] => {
  const step = size / 4;
  const p = (dx: number, dy: number): [number, number] => [cx + sx * dx, cy + sy * dy];
  return [
    {
      type: 'line',
      stroke: color,
      strokeWidth: width,
      points: [p(0, size), p(0, 0), p(size, 0), p(size, step), p(step, step), p(step, size - step), p(size - step, size - step), p(size - step, step * 2), p(step * 2, step * 2)],
    },
  ];
};

const frameItems = (page: { width: number; height: number }, style: FrameStyle, unit: number): { items: DrawItem[]; inset: number } => {
  const palette = PALETTES[style];
  const background: DrawItem = {
    type: 'rect',
    x: 0,
    y: 0,
    width: page.width,
    height: page.height,
    radius: 0,
    fill: palette.background,
    stroke: palette.background,
    strokeWidth: 0,
  };
  if (style === 'none') return { items: [background], inset: BASE_MARGIN };

  const rect = (inset: number, stroke: string, width: number): DrawItem => ({
    type: 'rect',
    x: inset,
    y: inset,
    width: page.width - 2 * inset,
    height: page.height - 2 * inset,
    radius: 0,
    fill: 'none',
    stroke,
    strokeWidth: width,
  });

  const outerInset = unit * 1.2;
  const items: DrawItem[] = [background];
  if (style === 'son-kim') {
    items.push(rect(outerInset, palette.outer, unit * 0.9), rect(outerInset + unit * 1.4, palette.inner, unit * 0.25));
  } else if (style === 'moc') {
    items.push(rect(outerInset, palette.outer, unit * 0.5), rect(outerInset + unit * 0.9, palette.inner, unit * 0.5));
  } else {
    items.push(rect(outerInset, palette.outer, unit * 0.2), rect(outerInset + unit * 0.6, palette.inner, unit * 0.1));
  }

  const cornerInset = outerInset + unit * 2.2;
  const size = unit * 5;
  const width = style === 'thanh-nha' ? unit * 0.12 : unit * 0.3;
  items.push(
    ...cornerKey(cornerInset, cornerInset, size, 1, 1, palette.ornament, width),
    ...cornerKey(page.width - cornerInset, cornerInset, size, -1, 1, palette.ornament, width),
    ...cornerKey(cornerInset, page.height - cornerInset, size, 1, -1, palette.ornament, width),
    ...cornerKey(page.width - cornerInset, page.height - cornerInset, size, -1, -1, palette.ornament, width),
  );
  return { items, inset: cornerInset + size + unit };
};

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/** "Gia phả <tên>", không lặp "Gia phả" nếu tên đã có sẵn. */
export const defaultTitle = (treeName: string) => (treeName ? `Gia phả ${treeName}`.replace(/^Gia phả gia phả /i, 'Gia phả ') : '');

/** Bố trí trang trí trên trang; mọi kích thước co giãn theo khổ giấy. */
export const layoutDecoration = (page: { width: number; height: number }, decoration: Decoration, treeName: string): DecorationLayout => {
  // Đơn vị trang trí: ~1/100 cạnh ngắn (A3 ≈ 3 mm, A0 ≈ 8,4 mm).
  const unit = Math.min(page.width, page.height) / 100;
  const palette = PALETTES[decoration.frame];
  const { items: below, inset } = frameItems(page, decoration.frame, unit);
  const above: DrawItem[] = [];

  let top = inset;
  const title = decoration.title.trim() || defaultTitle(treeName);
  if (title) {
    const sizeMm = Math.min(unit * 7, (page.width - 2 * inset) / Math.max(8, title.length * 0.55));
    above.push({ type: 'text', x: page.width / 2, y: top + sizeMm * 0.6, text: title, sizePt: sizeMm * PT_PER_MM, bold: true, color: palette.title });
    top += sizeMm * 1.3;
  }
  const subtitle = decoration.subtitle.trim();
  if (subtitle) {
    const sizeMm = Math.min(unit * 3, (page.width - 2 * inset) / Math.max(10, subtitle.length * 0.5));
    above.push({ type: 'text', x: page.width / 2, y: top + sizeMm * 0.6, text: subtitle, sizePt: sizeMm * PT_PER_MM, bold: false, color: palette.text });
    top += sizeMm * 1.4;
  }
  if (title || subtitle) top += unit * 2;

  let left = inset;
  let right = inset;
  const columns = [words(decoration.coupletLeft), words(decoration.coupletRight)];
  if (columns.some((column) => column.length > 0)) {
    const columnWidth = unit * 7;
    const availableHeight = page.height - top - inset;
    const longest = Math.max(...columns.map((column) => column.length), 1);
    const sizeMm = Math.min(columnWidth * 0.55, availableHeight / (longest * 1.45));
    const drawColumn = (column: string[], centerX: number) => {
      const blockHeight = column.length * sizeMm * 1.45;
      let y = top + (availableHeight - blockHeight) / 2 + sizeMm * 0.7;
      for (const word of column) {
        above.push({ type: 'text', x: centerX, y, text: word, sizePt: sizeMm * PT_PER_MM, bold: true, color: palette.title });
        y += sizeMm * 1.45;
      }
    };
    drawColumn(columns[0]!, inset + columnWidth / 2);
    drawColumn(columns[1]!, page.width - inset - columnWidth / 2);
    left += columnWidth + unit;
    right += columnWidth + unit;
  }

  return {
    below,
    above,
    content: { x: left, y: top, width: page.width - left - right, height: page.height - top - inset },
  };
};
