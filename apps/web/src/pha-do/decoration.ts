import { DECOR_FONTS, resolveBold, type DecorFontId } from './decoration-fonts';
import { LOOK_STYLES, MEMBER_COLORS, MEMBER_FONTS, type DecorLook, type MemberColors } from './decoration-looks';
import { decorationPxToMm, PT_PER_MM, type DrawItem } from './drawing';
import { fitSize, textWidthEm } from './glyph-widths';

export { DECOR_LOOKS, LOOK_LABELS, type DecorLook } from './decoration-looks';

/**
 * Trang trí Phả đồ (ticket 17): khung truyền thống, tiêu đề, phụ đề, câu đối hai bên.
 * Trả về các phần tử vẽ (mm) và vùng còn trống ở giữa để đặt cây.
 */

export type FrameStyle =
  | 'son-kim'
  | 'moc'
  | 'thanh-nha'
  | 'lam-ngoc'
  | 'hoang-gia'
  | 'trieu-nguyen'
  | 'tram-huong'
  | 'cuon-thu'
  | 'hoanh-phi'
  | 'dong-son'
  | 'gam-hoa'
  | 'none';

export const FRAME_LABELS: Record<FrameStyle, string> = {
  'son-kim': 'Đỏ son – vàng kim',
  moc: 'Mộc (nâu gỗ)',
  'thanh-nha': 'Thanh nhã (mực đen)',
  'lam-ngoc': 'Lam ngọc (xanh ngọc)',
  'hoang-gia': 'Hoàng gia (tím – vàng)',
  'trieu-nguyen': 'Triều Nguyễn (huyết dụ – vàng)',
  'tram-huong': 'Trầm hương (nâu bronze)',
  'cuon-thu': 'Cuốn thư (giấy da, trục gỗ)',
  'hoanh-phi': 'Hoành phi (viền son, tròn vàng)',
  'dong-son': 'Đông Sơn (trống đồng)',
  'gam-hoa': 'Gấm hoa (nền gấm ô thoi)',
  none: 'Không khung',
};

export type Decoration = {
  frame: FrameStyle;
  /** Phương án nền, màu chữ, phông chữ của khung (xem `decoration-looks.ts`). */
  look: DecorLook;
  /** Để trống thì dùng "Gia phả <tên gia phả>". */
  title: string;
  subtitle: string;
  coupletLeft: string;
  coupletRight: string;
  /** Cỡ chữ tối đa (xem `decorationPxToMm`); tiêu đề và câu đối vẫn tự co lại nếu không đủ chỗ. */
  titleSize: number;
  subtitleSize: number;
  coupletSize: number;
};

export const DEFAULT_DECORATION: Decoration = {
  frame: 'son-kim',
  look: 'A',
  title: '',
  subtitle: '',
  coupletLeft: '',
  coupletRight: '',
  titleSize: 50,
  subtitleSize: 30,
  coupletSize: 30,
};

type FrameColors = { outer: string; inner: string; ornament: string };
type Palette = FrameColors & { background: string; title: string; text: string; titleFont: DecorFontId; bodyFont: DecorFontId };

/** Màu viền và hoạ tiết của khung; nền, màu chữ và phông chữ theo phương án (xem `decoration-looks.ts`). */
const FRAME_COLORS: Record<FrameStyle, FrameColors> = {
  'son-kim': { outer: '#8a1c1c', inner: '#b8892b', ornament: '#b8892b' },
  moc: { outer: '#6b4a2b', inner: '#a27b4f', ornament: '#6b4a2b' },
  'thanh-nha': { outer: '#1f1a17', inner: '#1f1a17', ornament: '#1f1a17' },
  'lam-ngoc': { outer: '#2b5c54', inner: '#3f8f7a', ornament: '#3f8f7a' },
  'hoang-gia': { outer: '#5b2a86', inner: '#b8892b', ornament: '#b8892b' },
  'trieu-nguyen': { outer: '#5c1414', inner: '#c99a3e', ornament: '#c99a3e' },
  'tram-huong': { outer: '#4a3018', inner: '#8a6a3f', ornament: '#8a6a3f' },
  'cuon-thu': { outer: '#5a3a1f', inner: '#8a6a3f', ornament: '#b8892b' },
  'hoanh-phi': { outer: '#8a1c1c', inner: '#c99a3e', ornament: '#c99a3e' },
  'dong-son': { outer: '#2f5d50', inner: '#8a6a3f', ornament: '#8a6a3f' },
  'gam-hoa': { outer: '#8a1c1c', inner: '#c99a3e', ornament: '#c99a3e' },
  none: { outer: '#ffffff', inner: '#ffffff', ornament: '#ffffff' },
};

export const paletteOf = (frame: FrameStyle, look: DecorLook): Palette => ({ ...FRAME_COLORS[frame], ...LOOK_STYLES[frame][look] });

/** Màu ô thành viên mặc định theo khung (kiểu "Sáng"); người dùng chọn màu riêng thì màu đó thay thế. */
export const memberColorsOf = (frame: FrameStyle): MemberColors => MEMBER_COLORS[frame];

/** Phông chữ ô thành viên theo khung (dùng khi cấu hình chọn "Theo kiểu khung"). */
export const memberFontOf = (frame: FrameStyle): DecorFontId => MEMBER_FONTS[frame];

/** Nền lớp gấm (viền ngoài ô trắng) của khung Gấm hoa; ô giữa dùng nền của phương án. */
const GAM_HOA_MAT = '#f6e9c8';

/**
 * Cỡ chữ trang trí khi khổ giấy tự động: giữ nguyên tới khổ A1 (cạnh ngắn 594 mm), lớn hơn thì giảm dần theo cạnh ngắn^-0,3 — chiều cao chữ thật
 * chỉ tăng theo cạnh ngắn^0,7 (khổ gấp đôi, chữ to hơn khoảng 1,6 lần), vì khoảng cách xem tăng chậm hơn khổ và tiêu đề không nên át cả cây.
 * Cỡ chữ ô vẫn cố định 14 px nên phần trang trí không phình theo tỉ lệ thẳng.
 */
export const autoDecorationScale = (shortSideMm: number): number => Math.min(1, Math.pow(shortSideMm / 594, -0.3));

/** Khung có dải hồi văn chữ công chạy quanh 4 cạnh (ngoài hoạ tiết góc) — kiểu trang trọng, cổ điển hơn. */
const RUNNING_BORDER_STYLES = new Set<FrameStyle>(['son-kim', 'moc', 'lam-ngoc', 'hoang-gia', 'trieu-nguyen', 'tram-huong']);

/**
 * Dải hồi văn chữ công, dạng điểm cục bộ (dọc theo cạnh, lệch vào trong). Bắt đầu và kết thúc trên đường nền
 * (lệch 0) để nối thẳng vào cạnh của hoạ tiết góc; mỗi nhịp đối xứng: nền 1/4, nhô 1/2, nền 1/4.
 */
const meanderPoints = (length: number, idealUnit: number, h: number): [number, number][] => {
  const count = Math.max(2, Math.round(length / idealUnit));
  const u = length / count;
  const points: [number, number][] = [[0, 0]];
  for (let i = 0; i < count; i += 1) {
    const x0 = i * u;
    points.push([x0 + u * 0.25, 0], [x0 + u * 0.25, h], [x0 + u * 0.75, h], [x0 + u * 0.75, 0], [x0 + u, 0]);
  }
  return points;
};

/** Đặt một dải điểm cục bộ (dọc trục, lệch theo pháp tuyến) lên trang, theo một cạnh bất kỳ. */
const placeStrip = (origin: [number, number], axis: [number, number], normal: [number, number], local: [number, number][]): [number, number][] =>
  local.map(([along, offset]): [number, number] => [
    origin[0] + along * axis[0] + offset * normal[0],
    origin[1] + along * axis[1] + offset * normal[1],
  ]);

/** Dải hồi văn chữ công chạy quanh 4 cạnh của trang, giữa các hoạ tiết góc. */
const runningBorder = (page: { width: number; height: number }, unit: number, runStart: number, band: number, color: string, width: number): DrawItem[] => {
  const topLen = page.width - 2 * runStart;
  const sideLen = page.height - 2 * runStart;
  const h = unit * 2.2;
  const idealUnit = unit * 6;
  const strips: [number, number][][] = [
    placeStrip([runStart, band], [1, 0], [0, 1], meanderPoints(topLen, idealUnit, h)),
    placeStrip([runStart, page.height - band], [1, 0], [0, -1], meanderPoints(topLen, idealUnit, h)),
    placeStrip([band, runStart], [0, 1], [1, 0], meanderPoints(sideLen, idealUnit, h)),
    placeStrip([page.width - band, runStart], [0, 1], [-1, 0], meanderPoints(sideLen, idealUnit, h)),
  ];
  return strips.map((points) => ({ type: 'line', stroke: color, strokeWidth: width, points, seamless: true }));
};

export type Region = { x: number; y: number; width: number; height: number };

export type DecorationLayout = {
  /** Vẽ trước cây (nền, viền). */
  below: DrawItem[];
  /** Vẽ sau cây (chữ tiêu đề, câu đối). */
  above: DrawItem[];
  /** Vùng dành cho cây. */
  content: Region;
  /** Tỉ lệ nhỏ nhất giữa cỡ chữ thực tế và cỡ người dùng đặt của tiêu đề, phụ đề, câu đối (1 = không chữ nào phải co lại). */
  fit: number;
};

/** Hoạ tiết hồi văn (móc vuông) ở một góc; `sx`, `sy` là hướng quay vào trong trang. */
const cornerKey = (cx: number, cy: number, size: number, sx: 1 | -1, sy: 1 | -1, color: string, width: number): DrawItem[] => {
  const step = size / 4;
  const p = (dx: number, dy: number): [number, number] => [cx + sx * dx, cy + sy * dy];
  return [
    {
      type: 'line',
      stroke: color,
      strokeWidth: width,
      seamless: true,
      points: [p(0, size), p(0, 0), p(size, 0), p(size, step), p(step, step), p(step, size - step), p(size - step, size - step), p(size - step, step * 2), p(step * 2, step * 2)],
    },
  ];
};

/** Các khung "hoạ tiết riêng" (không theo mẫu hai khung + hồi văn góc): cuốn thư, hoành phi, Đông Sơn, gấm hoa. */
const SIGNATURE_STYLES = new Set<FrameStyle>(['cuon-thu', 'hoanh-phi', 'dong-son', 'gam-hoa']);

type Page = { width: number; height: number };

const rectItem = (x: number, y: number, width: number, height: number, stroke: string, strokeWidth: number, extra: Partial<Extract<DrawItem, { type: 'rect' }>> = {}): DrawItem => ({
  type: 'rect',
  x,
  y,
  width,
  height,
  radius: 0,
  fill: 'none',
  stroke,
  strokeWidth,
  ...extra,
});
/** Hình tròn = ô vuông bo hết cỡ (bản vẽ không có hình tròn riêng). */
const circleItem = (cx: number, cy: number, r: number, fill: string, stroke: string, strokeWidth: number): DrawItem =>
  rectItem(cx - r, cy - r, 2 * r, 2 * r, stroke, strokeWidth, { radius: r, fill });
const strokeItem = (points: [number, number][], stroke: string, strokeWidth: number, seamless = true): DrawItem => ({ type: 'line', points, stroke, strokeWidth, seamless });
const diamondItem = (cx: number, cy: number, r: number, stroke: string, strokeWidth: number): DrawItem =>
  strokeItem([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy], [cx, cy - r]], stroke, strokeWidth);

/** Đường gấp khúc răng cưa dọc một đoạn thẳng (`from`→`to`), nhô vào phía `normal` một khoảng `depth`. */
const zigzag = (from: [number, number], to: [number, number], normal: [number, number], depth: number, idealPeriod: number): [number, number][] => {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const teeth = Math.max(1, Math.round(length / idealPeriod));
  return Array.from({ length: teeth * 2 + 1 }, (_, index): [number, number] => {
    const t = index / (teeth * 2);
    const out = index % 2 === 1 ? depth : 0;
    return [from[0] + (to[0] - from[0]) * t + normal[0] * out, from[1] + (to[1] - from[1]) * t + normal[1] * out];
  });
};

/** Lưới ô thoi (hai họ đường chéo) chỉ nằm trong dải giữa hình chữ nhật ngoài (`outer` lề) và trong (`inner` lề). */
const latticeBand = (page: Page, outer: number, inner: number, period: number, color: string, width: number): DrawItem[] => {
  const items: DrawItem[] = [];
  const { width: w, height: h } = page;
  for (const slope of [1, -1] as const) {
    // Đường y = slope·x + k; đoạn trong khung [lề, kích thước − lề] theo x.
    const span = (margin: number, k: number): [number, number] =>
      slope === 1 ? [Math.max(margin, margin - k), Math.min(w - margin, h - margin - k)] : [Math.max(margin, k - h + margin), Math.min(w - margin, k - margin)];
    const first = slope === 1 ? -w : 0;
    const last = slope === 1 ? h : w + h;
    for (let k = first; k <= last; k += period) {
      const [x1, x2] = span(outer, k);
      if (x2 - x1 < 1e-6) continue;
      const [i1, i2] = span(inner, k);
      const pieces: [number, number][] = i2 - i1 > 1e-6 ? [[x1, Math.min(x2, i1)], [Math.max(x1, i2), x2]] : [[x1, x2]];
      for (const [from, to] of pieces) {
        if (to - from > 1e-6) items.push(strokeItem([[from, slope * from + k], [to, slope * to + k]], color, width, false));
      }
    }
  }
  return items;
};

/**
 * Cuốn thư: giấy da giữa hai trục cuộn gỗ có núm vàng, viền đôi mảnh, góc vuông.
 * Hoành phi: viền dày đỏ son kiểu bức hoành phi, chỉ vàng, tròn vàng ở góc và giữa cạnh trên/dưới.
 * Đông Sơn: viền xanh gỉ đồng, dải chấm, dải răng cưa, bốn mặt trời trống đồng ở góc.
 * Gấm hoa: viền đỏ son, nền gấm ô thoi vàng nhạt làm khung lót quanh ô trắng sạch cho cây và chữ.
 */
const signatureFrame = (page: Page, style: FrameStyle, unit: number, palette: Palette): { items: DrawItem[]; inset: number } => {
  const { width: w, height: h } = page;
  const u = unit;
  const pageFill = style === 'gam-hoa' ? GAM_HOA_MAT : palette.background;
  const items: DrawItem[] = [rectItem(0, 0, w, h, pageFill, 0, { fill: pageFill })];

  if (style === 'cuon-thu') {
    const roller = palette.outer;
    for (const top of [true, false]) {
      const y = top ? 2.6 * u : h - 5.8 * u;
      items.push(rectItem(4 * u, y, w - 8 * u, 3.2 * u, roller, 0, { radius: 1.6 * u, fill: roller }));
      items.push(strokeItem([[6 * u, y + 0.9 * u], [w - 6 * u, y + 0.9 * u]], '#a27b4f', 0.25 * u, false));
      for (const x of [3.2 * u, w - 3.2 * u]) items.push(circleItem(x, y + 1.6 * u, 2.2 * u, palette.ornament, roller, 0.4 * u));
    }
    for (const x of [6.5 * u, w - 6.5 * u]) items.push(strokeItem([[x, 5.8 * u], [x, h - 5.8 * u]], palette.inner, 0.3 * u, false));
    items.push(rectItem(8 * u, 8.5 * u, w - 16 * u, h - 17 * u, palette.ornament, 0.2 * u), rectItem(8.9 * u, 9.4 * u, w - 17.8 * u, h - 18.8 * u, palette.inner, 0.1 * u));
    const arm = 2.4 * u;
    for (const [x, y, sx, sy] of [[9.9 * u, 11 * u, 1, 1], [w - 9.9 * u, 11 * u, -1, 1], [9.9 * u, h - 11 * u, 1, -1], [w - 9.9 * u, h - 11 * u, -1, -1]] as const) {
      items.push(strokeItem([[x, y + sy * arm], [x, y], [x + sx * arm, y]], palette.ornament, 0.25 * u));
    }
    return { items, inset: 14 * u };
  }

  if (style === 'hoanh-phi') {
    items.push(
      rectItem(1.6 * u, 1.6 * u, w - 3.2 * u, h - 3.2 * u, palette.inner, 0.2 * u),
      rectItem(3.3 * u, 3.3 * u, w - 6.6 * u, h - 6.6 * u, palette.outer, 3.2 * u),
      rectItem(5 * u, 5 * u, w - 10 * u, h - 10 * u, palette.inner, 0.33 * u),
      rectItem(3.3 * u, 3.3 * u, w - 6.6 * u, h - 6.6 * u, palette.inner, 0.13 * u, { dash: [0.26 * u, 0.9 * u] }),
      rectItem(6.8 * u, 6.8 * u, w - 13.6 * u, h - 13.6 * u, palette.outer, 0.2 * u),
    );
    const roundels: [number, number, number][] = [
      [3.4 * u, 3.4 * u, 3.4 * u],
      [w - 3.4 * u, 3.4 * u, 3.4 * u],
      [3.4 * u, h - 3.4 * u, 3.4 * u],
      [w - 3.4 * u, h - 3.4 * u, 3.4 * u],
      [w / 2, 3.3 * u, 2.2 * u],
      [w / 2, h - 3.3 * u, 2.2 * u],
    ];
    for (const [cx, cy, r] of roundels) items.push(circleItem(cx, cy, r, palette.outer, palette.inner, 0.4 * u), circleItem(cx, cy, r * 0.5, 'none', palette.inner, 0.26 * u));
    const size = 3 * u;
    const at = 7.8 * u;
    for (const [x, y, sx, sy] of [[at, at, 1, 1], [w - at, at, -1, 1], [at, h - at, 1, -1], [w - at, h - at, -1, -1]] as const) {
      items.push(strokeItem([[x, y + sy * size], [x, y], [x + sx * size, y], [x + sx * size, y + sy * u * 0.8], [x + sx * u * 0.8, y + sy * u * 0.8], [x + sx * u * 0.8, y + sy * size]], palette.inner, 0.3 * u));
    }
    return { items, inset: 11.8 * u };
  }

  if (style === 'dong-son') {
    const centers: [number, number][] = [[7.6 * u, 7.6 * u], [w - 7.6 * u, 7.6 * u], [7.6 * u, h - 7.6 * u], [w - 7.6 * u, h - 7.6 * u]];
    items.push(
      rectItem(2.2 * u, 2.2 * u, w - 4.4 * u, h - 4.4 * u, palette.outer, 0.8 * u),
      rectItem(3.6 * u, 3.6 * u, w - 7.2 * u, h - 7.2 * u, palette.inner, 0.2 * u),
      rectItem(4.8 * u, 4.8 * u, w - 9.6 * u, h - 9.6 * u, palette.inner, 0.7 * u, { dash: [0.7 * u, 1.3 * u] }),
      rectItem(6 * u, 6 * u, w - 12 * u, h - 12 * u, palette.inner, 0.2 * u),
      rectItem(9.7 * u, 9.7 * u, w - 19.4 * u, h - 19.4 * u, palette.outer, 0.2 * u),
    );
    const from = 13.2 * u;
    const period = 3.7 * u;
    items.push(
      strokeItem(zigzag([from, 7.4 * u], [w - from, 7.4 * u], [0, 1], 1.4 * u, period), palette.inner, 0.2 * u),
      strokeItem(zigzag([from, h - 7.4 * u], [w - from, h - 7.4 * u], [0, -1], 1.4 * u, period), palette.inner, 0.2 * u),
      strokeItem(zigzag([7.4 * u, from], [7.4 * u, h - from], [1, 0], 1.4 * u, period), palette.inner, 0.2 * u),
      strokeItem(zigzag([w - 7.4 * u, from], [w - 7.4 * u, h - from], [-1, 0], 1.4 * u, period), palette.inner, 0.2 * u),
    );
    for (const [cx, cy] of centers) {
      items.push(
        circleItem(cx, cy, 5 * u, palette.background, palette.background, 0),
        circleItem(cx, cy, 3.4 * u, 'none', palette.outer, 0.4 * u),
        circleItem(cx, cy, 2.4 * u, 'none', palette.inner, 0.2 * u),
        circleItem(cx, cy, 1.4 * u, 'none', palette.outer, 0.4 * u),
        circleItem(cx, cy, 0.5 * u, palette.inner, palette.inner, 0),
      );
      for (let ray = 0; ray < 12; ray += 1) {
        const angle = (ray * Math.PI) / 6;
        const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
        items.push(strokeItem([[cx + dx * 3.7 * u, cy + dy * 3.7 * u], [cx + dx * 4.7 * u, cy + dy * 4.7 * u]], palette.inner, 0.3 * u));
      }
    }
    return { items, inset: 13 * u };
  }

  // gam-hoa
  const matOuter = 5.3 * u;
  const panel = 9.2 * u;
  items.push(...latticeBand(page, matOuter, panel, 3.95 * u, '#dcc58f', 0.15 * u));
  items.push(
    rectItem(2.9 * u, 2.9 * u, w - 5.8 * u, h - 5.8 * u, palette.outer, 0.8 * u),
    rectItem(4.7 * u, 4.7 * u, w - 9.4 * u, h - 9.4 * u, palette.inner, 0.2 * u),
    rectItem(panel, panel, w - 2 * panel, h - 2 * panel, palette.inner, 0.33 * u, { fill: palette.background }),
    rectItem(10.5 * u, 10.5 * u, w - 21 * u, h - 21 * u, palette.outer, 0.13 * u),
  );
  const corner = 6.6 * u;
  for (const [cx, cy] of [[corner, corner], [w - corner, corner], [corner, h - corner], [w - corner, h - corner]] as const) {
    items.push(diamondItem(cx, cy, 1.5 * u, palette.outer, 1.5 * u), diamondItem(cx, cy, 2.6 * u, palette.inner, 0.3 * u));
  }
  return { items, inset: 11.5 * u };
};

const frameItems = (page: { width: number; height: number }, style: FrameStyle, unit: number, palette: Palette): { items: DrawItem[]; inset: number } => {
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
  if (style === 'none') return { items: [background], inset: unit * 2 };
  if (SIGNATURE_STYLES.has(style)) return signatureFrame(page, style, unit, palette);

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
  let innerRectInset = outerInset;
  if (style === 'son-kim') {
    innerRectInset = outerInset + unit * 1.4;
    items.push(rect(outerInset, palette.outer, unit * 0.9), rect(innerRectInset, palette.inner, unit * 0.25));
  } else if (style === 'moc') {
    innerRectInset = outerInset + unit * 0.9;
    items.push(rect(outerInset, palette.outer, unit * 0.5), rect(innerRectInset, palette.inner, unit * 0.5));
  } else if (style === 'lam-ngoc') {
    innerRectInset = outerInset + unit * 1.1;
    items.push(rect(outerInset, palette.outer, unit * 0.6), rect(innerRectInset, palette.inner, unit * 0.6));
  } else if (style === 'hoang-gia') {
    innerRectInset = outerInset + unit * 2.3;
    items.push(
      rect(outerInset, palette.outer, unit * 1.2),
      rect(outerInset + unit * 1.8, palette.inner, unit * 0.4),
      rect(innerRectInset, palette.ornament, unit * 0.15),
    );
  } else if (style === 'trieu-nguyen') {
    innerRectInset = outerInset + unit * 2.0;
    items.push(
      rect(outerInset, palette.outer, unit * 1.3),
      rect(outerInset + unit * 1.4, palette.inner, unit * 0.2),
      rect(innerRectInset, palette.inner, unit * 0.2),
    );
  } else if (style === 'tram-huong') {
    innerRectInset = outerInset + unit * 1.0;
    items.push(rect(outerInset, palette.outer, unit * 0.7), rect(innerRectInset, palette.inner, unit * 0.3));
  } else {
    items.push(rect(outerInset, palette.outer, unit * 0.2), rect(outerInset + unit * 0.6, palette.inner, unit * 0.1));
  }

  // Hoạ tiết góc nằm trong khung trong cùng, cách một khoảng đều cho mọi kiểu khung.
  const cornerInset = innerRectInset + unit * 1.2;
  const size = unit * 5;
  const width = style === 'thanh-nha' ? unit * 0.12 : unit * 0.3;
  if (RUNNING_BORDER_STYLES.has(style)) {
    // Dải chạy cùng đường nền với cạnh hoạ tiết góc và bắt đầu đúng chỗ cạnh đó kết thúc → liền một nét.
    items.push(...runningBorder(page, unit, cornerInset + size, cornerInset, palette.ornament, width));
  }
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

/** Bố trí trang trí trên trang; mọi kích thước co giãn theo khổ giấy. Không có trạng thái: cùng đầu vào cho cùng kết quả (xem `layoutDecoration`, có nhớ). */
const computeDecoration = (page: { width: number; height: number }, decoration: Decoration, treeName: string, sizeScale: number): DecorationLayout => {
  // Đơn vị trang trí: ~1/100 cạnh ngắn (A3 ≈ 3 mm, A0 ≈ 8,4 mm).
  const unit = Math.min(page.width, page.height) / 100;
  const palette = paletteOf(decoration.frame, decoration.look);
  const { items: below, inset } = frameItems(page, decoration.frame, unit, palette);
  const above: DrawItem[] = [];

  let top = inset;
  let textBottom = top;
  let fit = 1;
  const title = decoration.title.trim() || defaultTitle(treeName);
  if (title) {
    const bold = resolveBold(palette.titleFont, true);
    const wantedMm = decorationPxToMm(page, decoration.titleSize * sizeScale) * DECOR_FONTS[palette.titleFont].titleScale;
    const sizeMm = fitSize(title, wantedMm, bold, page.width - 2 * inset, palette.titleFont);
    fit = Math.min(fit, sizeMm / wantedMm);
    above.push({ type: 'text', x: page.width / 2, y: top + sizeMm * 0.6, text: title, sizePt: sizeMm * PT_PER_MM, bold, color: palette.title, font: palette.titleFont });
    textBottom = top + sizeMm * 1.05;
    top += sizeMm * 1.3;
  }
  const subtitle = decoration.subtitle.trim();
  if (subtitle) {
    const bold = resolveBold(palette.bodyFont, false);
    const wantedMm = decorationPxToMm(page, decoration.subtitleSize * sizeScale);
    const sizeMm = fitSize(subtitle, wantedMm, bold, page.width - 2 * inset, palette.bodyFont);
    fit = Math.min(fit, sizeMm / wantedMm);
    above.push({ type: 'text', x: page.width / 2, y: top + sizeMm * 0.6, text: subtitle, sizePt: sizeMm * PT_PER_MM, bold, color: palette.text, font: palette.bodyFont });
    textBottom = top + sizeMm * 1.05;
    top += sizeMm * 1.4;
  }
  if (SIGNATURE_STYLES.has(decoration.frame) && (title || subtitle)) {
    // Vạch ngăn dưới tiêu đề: gạch – thoi – gạch.
    // Chữ tiêu đề/phụ đề nhỏ (người dùng đặt cỡ nhỏ) thì đẩy vạch xuống để thoi không đè lên chữ.
    const y = Math.max(top + unit * 0.6, textBottom + unit * 1.05);
    const arm = unit * 11;
    const gap = unit * 3;
    above.push(
      strokeItem([[page.width / 2 - gap - arm, y], [page.width / 2 - gap, y]], palette.ornament, unit * 0.2, false),
      strokeItem([[page.width / 2 + gap, y], [page.width / 2 + gap + arm, y]], palette.ornament, unit * 0.2, false),
      diamondItem(page.width / 2, y, unit * 0.8, palette.ornament, unit * 0.5),
    );
    top = y + unit * 1.8;
  }
  if (title || subtitle) top += unit * 2;

  let left = inset;
  let right = inset;
  const columns = [words(decoration.coupletLeft), words(decoration.coupletRight)];
  if (columns.some((column) => column.length > 0)) {
    const availableHeight = page.height - top - inset;
    const longest = Math.max(...columns.map((column) => column.length), 1);
    // Cột rộng theo chữ thật (độ rộng đo theo phông, không ước theo số ký tự): chữ không bao giờ tràn sang vùng cây.
    const coupletBold = resolveBold(palette.bodyFont, true);
    const widestEm = Math.max(...columns.flat().map((word) => textWidthEm(word, coupletBold, palette.bodyFont)));
    const padding = unit * 1.2;
    const maxColumn = page.width * 0.18;
    const wantedMm = decorationPxToMm(page, decoration.coupletSize * sizeScale);
    let sizeMm = Math.min(wantedMm, availableHeight / (longest * 1.45));
    if (widestEm * sizeMm + padding > maxColumn) sizeMm = (maxColumn - padding) / widestEm;
    fit = Math.min(fit, Math.max(sizeMm, 0) / wantedMm);
    const columnWidth = Math.max(unit * 7, widestEm * sizeMm + padding);
    const drawColumn = (column: string[], centerX: number) => {
      const blockHeight = column.length * sizeMm * 1.45;
      let y = top + (availableHeight - blockHeight) / 2 + sizeMm * 0.7;
      for (const word of column) {
        above.push({ type: 'text', x: centerX, y, text: word, sizePt: sizeMm * PT_PER_MM, bold: coupletBold, color: palette.title, font: palette.bodyFont });
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
    fit,
  };
};

// Một lần tính khổ tự động hỏi ~40 tỉ lệ × tới 5 hệ số cỡ chữ (xem `fitPaperToFont`): giữ đủ chỗ để lần tính lại sau đó đều trúng bộ nhớ.
const DECORATION_CACHE_LIMIT = 512;
const decorationCache = new Map<string, DecorationLayout>();

/**
 * `computeDecoration` có nhớ kết quả theo (khổ trang, trang trí, tên gia phả): hàm thuần nên cùng đầu vào cho cùng kết quả, và việc tự co giãn khổ giấy
 * hỏi lại cùng một trang tham chiếu rất nhiều lần (đổi người, đổi dòng thêm… không đụng tới trang trí). Kết quả được dùng chung: bên gọi chỉ đọc, không sửa
 * các mảng trả về. Giữ tối đa 512 kết quả gần nhất.
 *
 * `sizeScale` nhân vào cỡ chữ tiêu đề, phụ đề, câu đối; khổ tự động truyền `autoDecorationScale(cạnh ngắn)`, khổ cố định để 1.
 */
export const layoutDecoration = (page: { width: number; height: number }, decoration: Decoration, treeName: string, sizeScale = 1): DecorationLayout => {
  const key = `${page.width}x${page.height}|${treeName}|${sizeScale.toFixed(4)}|${JSON.stringify(decoration)}`;
  const cached = decorationCache.get(key);
  if (cached) {
    // Dùng gần đây nhất thì chuyển xuống cuối để bị loại sau cùng.
    decorationCache.delete(key);
    decorationCache.set(key, cached);
    return cached;
  }
  const layout = computeDecoration(page, decoration, treeName, sizeScale);
  decorationCache.set(key, layout);
  if (decorationCache.size > DECORATION_CACHE_LIMIT) decorationCache.delete(decorationCache.keys().next().value!);
  return layout;
};
