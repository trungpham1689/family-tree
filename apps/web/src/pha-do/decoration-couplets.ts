import type { FrameStyle } from './decoration';
import { MEMBER_COLORS } from './decoration-looks';
import type { DrawItem } from './drawing';
import { circleItem, diamondItem, GAM_HOA_MAT, rectItem, strokeItem } from './decoration-shapes';

/**
 * Liễn câu đối hai bên Phả đồ: mỗi kiểu khung có một kiểu liễn riêng, lấy màu, viền và đầu liễn từ chính khung đó.
 * Liễn sơn đặc (khung cơ bản, Hoành phi, Đông Sơn) chữ sáng trên nền màu khung; Cuốn thư, Gấm hoa, Không khung là liễn giấy sáng chữ đậm.
 * Kích thước tính theo đơn vị trang trí `unit` (1/100 cạnh ngắn) và cỡ chữ; hai liễn cao bằng nhau, canh trên ngang mép trên vùng cây.
 */

type BoardKind = 'lacquer' | 'scroll' | 'hoanh' | 'dong' | 'gam' | 'none';

type BoardSpec = {
  kind: BoardKind;
  /** Đầu liễn (trên và dưới), bội của `unit`. */
  cap: number;
  /** Lề ngang và lề dọc từ mép liễn tới chữ, bội của `unit` (cộng thêm lề theo cỡ chữ). */
  hPad: number;
  vPad: number;
  /** Phần hoạ tiết nhô ra ngoài mép liễn về hai phía (trục, núm, đầu liễn), bội của `unit`: vùng cây phải chừa thêm. */
  reach: number;
  /** Chỉ viền trong của liễn sơn đặc: [cách mép, độ dày], bội của `unit`. */
  rings: readonly (readonly [number, number])[];
  /** Màu chữ và màu chỉ viền trên nền màu khung (chỉ liễn sơn đặc). */
  text: string;
  accent: string;
};

const spec = (kind: BoardKind, cap: number, hPad: number, vPad: number, text = '', accent = '', rings: BoardSpec['rings'] = [], reach = 0): BoardSpec => ({ kind, cap, hPad, vPad, reach, rings, text, accent });
const lacquer = (text: string, accent: string, rings: BoardSpec['rings']) => spec('lacquer', 1.1, 1.4, 1.3, text, accent, rings, 0.7);

const SPECS: Record<FrameStyle, BoardSpec> = {
  'son-kim': lacquer('#f4dc9a', '#d6a84a', [[0.8, 0.25]]),
  moc: lacquer('#f3e3c3', '#c9a577', [[0.8, 0.5]]),
  'thanh-nha': lacquer('#efe6cf', '#b9ad94', [[0.8, 0.12]]),
  'lam-ngoc': lacquer('#f1e6bf', '#7fc4ac', [[0.7, 0.5]]),
  'hoang-gia': lacquer('#f4dc9a', '#d6a84a', [[0.7, 0.35], [1.3, 0.12]]),
  'trieu-nguyen': lacquer('#f0d28a', '#dcb25c', [[0.7, 0.2], [1.5, 0.2]]),
  'tram-huong': lacquer('#efdcb4', '#b99765', [[0.8, 0.3]]),
  'cuon-thu': spec('scroll', 2.2, 1.2, 1.5, '', '', [], 1.5),
  'hoanh-phi': spec('hoanh', 1.7, 2.2, 2.0, '#f4dc9a', '#dcb25c'),
  'dong-son': spec('dong', 2.4, 2.5, 2.2, '#f3e8c6', '#c2a46a'),
  'gam-hoa': spec('gam', 1.0, 3.0, 3.2),
  none: spec('none', 0, 1.0, 1.2),
};

/** Đầu liễn và các lề của liễn theo khung (bội của `unit`). */
export const boardMetrics = (frame: FrameStyle): Pick<BoardSpec, 'cap' | 'hPad' | 'vPad' | 'reach'> => SPECS[frame];

/** Màu chữ trên liễn: sáng trên liễn sơn đặc, màu tiêu đề của phương án trên liễn giấy. */
export const boardTextColor = (frame: FrameStyle, titleColor: string): string => (SPECS[frame].text || titleColor);

type BoardPalette = { outer: string; inner: string; ornament: string; background: string; title: string };
type Box = { x: number; y: number; width: number; height: number };

/** Màu nền ngay sau chữ của liễn (để kiểm tra độ tương phản của chữ). */
export const boardFillOf = (frame: FrameStyle, palette: BoardPalette): string => {
  const { kind } = SPECS[frame];
  if (kind === 'lacquer' || kind === 'hoanh' || kind === 'dong') return palette.outer;
  return kind === 'scroll' ? MEMBER_COLORS[frame].spouse : palette.background;
};

const RAYS = 12;

/** Vẽ một liễn trong hình chữ nhật `box` (mm); chữ vẽ riêng ở bên ngoài. */
export const coupletBoard = (frame: FrameStyle, palette: BoardPalette, box: Box, unit: number): DrawItem[] => {
  const { kind, cap: capUnits, rings, accent } = SPECS[frame];
  const { x, y, width: w, height: h } = box;
  const u = unit;
  const cx = x + w / 2;
  const cap = capUnits * u;
  const items: DrawItem[] = [];
  const fill = palette.outer;

  if (kind === 'lacquer') {
    const bodyY = y + cap * 0.55;
    const bodyH = h - cap * 1.1;
    items.push(rectItem(x, bodyY, w, bodyH, accent, 0.35 * u, { fill }));
    for (const [inset, width] of rings) items.push(rectItem(x + inset * u, bodyY + inset * u, w - 2 * inset * u, bodyH - 2 * inset * u, accent, width * u));
    for (const capY of [y, y + h - cap]) {
      items.push(rectItem(x - 0.7 * u, capY, w + 1.4 * u, cap, accent, 0.3 * u, { radius: 0.5 * u, fill }), diamondItem(cx, capY + cap / 2, 0.45 * u, accent, 0.3 * u));
    }
  } else if (kind === 'scroll') {
    const roller = cap;
    const bodyH = h - roller * 1.2;
    items.push(
      rectItem(x, y + roller * 0.6, w, bodyH, palette.inner, 0.25 * u, { fill: MEMBER_COLORS[frame].spouse }),
      rectItem(x + 0.9 * u, y + roller * 0.6 + 0.9 * u, w - 1.8 * u, bodyH - 1.8 * u, palette.ornament, 0.12 * u),
    );
    for (const rollerY of [y, y + h - roller]) {
      items.push(
        rectItem(x - 0.3 * u, rollerY, w + 0.6 * u, roller, palette.outer, 0, { radius: roller / 2, fill: palette.outer }),
        strokeItem([[x - 0.2 * u, rollerY + 0.8 * u], [x + w + 0.2 * u, rollerY + 0.8 * u]], '#a27b4f', 0.2 * u, false),
      );
      for (const knobX of [x - 0.3 * u, x + w + 0.3 * u]) items.push(circleItem(knobX, rollerY + roller / 2, 1.2 * u, palette.ornament, palette.outer, 0.3 * u));
    }
  } else if (kind === 'hoanh') {
    const bodyY = y + cap;
    const bodyH = h - 2 * cap;
    items.push(rectItem(x, bodyY, w, bodyH, accent, 0.35 * u, { fill }), rectItem(x + 0.9 * u, bodyY + 0.9 * u, w - 1.8 * u, bodyH - 1.8 * u, accent, 0.2 * u));
    for (const roundelY of [bodyY, bodyY + bodyH]) items.push(circleItem(cx, roundelY, cap, fill, accent, 0.3 * u), circleItem(cx, roundelY, cap * 0.5, 'none', accent, 0.22 * u));
  } else if (kind === 'dong') {
    const bodyY = y + cap;
    const bodyH = h - 2 * cap;
    items.push(
      rectItem(x, bodyY, w, bodyH, accent, 0.35 * u, { fill }),
      rectItem(x + 1.1 * u, bodyY + 1.1 * u, w - 2.2 * u, bodyH - 2.2 * u, accent, 0.4 * u, { dash: [0.4 * u, 0.8 * u] }),
      rectItem(x + 2 * u, bodyY + 2 * u, w - 4 * u, bodyH - 4 * u, accent, 0.15 * u),
    );
    for (const sunY of [bodyY, bodyY + bodyH]) {
      items.push(circleItem(cx, sunY, 2.4 * u, fill, accent, 0.4 * u), circleItem(cx, sunY, 1.5 * u, 'none', accent, 0.2 * u), circleItem(cx, sunY, 0.45 * u, accent, accent, 0));
      for (let ray = 0; ray < RAYS; ray += 1) {
        const angle = (ray * 2 * Math.PI) / RAYS;
        const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
        items.push(strokeItem([[cx + dx * 1.65 * u, sunY + dy * 1.65 * u], [cx + dx * 2.1 * u, sunY + dy * 2.1 * u]], accent, 0.25 * u, false));
      }
    }
  } else if (kind === 'gam') {
    const bodyY = y + cap * 0.5;
    const bodyH = h - cap;
    items.push(
      rectItem(x, bodyY, w, bodyH, palette.inner, 0.3 * u, { fill: palette.outer }),
      rectItem(x + 0.9 * u, bodyY + 0.9 * u, w - 1.8 * u, bodyH - 1.8 * u, palette.inner, 0.2 * u, { fill: GAM_HOA_MAT }),
      rectItem(x + 2.4 * u, bodyY + 2.4 * u, w - 4.8 * u, bodyH - 4.8 * u, palette.inner, 0.3 * u, { fill: palette.background }),
      rectItem(x + 2.9 * u, bodyY + 2.9 * u, w - 5.8 * u, bodyH - 5.8 * u, palette.outer, 0.13 * u),
    );
    const [left, right] = [x + 1.65 * u, x + w - 1.65 * u];
    for (const [dx, dy] of [[left, bodyY + 1.65 * u], [right, bodyY + 1.65 * u], [left, bodyY + bodyH - 1.65 * u], [right, bodyY + bodyH - 1.65 * u]] as const) items.push(diamondItem(dx, dy, 0.8 * u, palette.outer, 0.4 * u));
    // Chuỗi thoi nhỏ dọc hai dải gấm giữa các thoi góc.
    for (let dy = bodyY + 4.6 * u; dy < bodyY + bodyH - 3 * u; dy += 4 * u) for (const dx of [left, right]) items.push(diamondItem(dx, dy, 0.5 * u, palette.inner, 0.25 * u));
  } else {
    items.push(rectItem(x, y, w, h, palette.title, 0.3 * u), rectItem(x + 0.7 * u, y + 0.7 * u, w - 1.4 * u, h - 1.4 * u, palette.title, 0.12 * u));
  }
  return items;
};
