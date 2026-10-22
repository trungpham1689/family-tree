import { fieldLabel } from '../people/profile-fields';
import { autoDecorationScale, DEFAULT_DECORATION, DECOR_LOOKS, FRAME_LABELS, type Decoration, type DecorLook, type FrameStyle } from './decoration';

/** Cấu hình một bản in Phả đồ; lưu theo Gia phả để in lại sau. */

export const PAPER_SIZES = {
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
} as const;

export type PaperName = keyof typeof PAPER_SIZES | 'custom';

export type PhaDoScope =
  | { kind: 'all' }
  | { kind: 'branch'; personId: string }
  | { kind: 'from-person'; personId: string; depth: number };

/** Dòng thêm trong mỗi ô (tối đa 2), ngoài tên và năm sinh–mất. */
export type ExtraLine = 'gio' | 'doi' | 'que';

export const EXTRA_LINE_LABELS: Record<ExtraLine, string> = {
  gio: 'Ngày giỗ',
  doi: 'Đời',
  que: fieldLabel('hometown'),
};

/**
 * Phông tên trong ô: "Theo kiểu khung" (mặc định) dùng phông riêng của từng kiểu khung (xem `MEMBER_FONTS`); "Be Vietnam Pro" dùng một phông cho mọi khung.
 * Cả hai đều có file TTF trong public/fonts: bản xem trước nạp đúng file đó (fonts.css), bản xuất PDF/PNG nhúng đúng file đó.
 */
export type PhaDoFontFamily = 'frame' | 'be-vietnam-pro';

export const FONT_FAMILY_LABELS: Record<PhaDoFontFamily, string> = {
  frame: 'Theo kiểu khung (mặc định)',
  'be-vietnam-pro': 'Be Vietnam Pro (hiện đại)',
};

/** CSS font-family khi xem trước trang (chữ không có phông riêng: chú giải, và mọi chữ khi không chọn "Theo kiểu khung"); họ chữ định nghĩa trong fonts.css. */
export const FONT_FAMILY_CSS: Record<PhaDoFontFamily, string> = {
  frame: "'PhaDo Noto Serif', serif",
  'be-vietnam-pro': "'PhaDo Be Vietnam Pro', sans-serif",
};

export const NOTO_SERIF_FILES = { regular: '/fonts/NotoSerif-400Regular.ttf', bold: '/fonts/NotoSerif-700Bold.ttf' };

/**
 * File TTF nhúng khi xuất PDF/PNG cho chữ không có phông riêng, cùng file với bản xem trước. Với "Theo kiểu khung", chữ có phông riêng nhúng thêm đúng file của phông đó.
 */
export const FONT_FAMILY_EXPORT_FILES: Record<PhaDoFontFamily, { regular: string; bold: string }> = {
  frame: NOTO_SERIF_FILES,
  'be-vietnam-pro': { regular: '/fonts/BeVietnamPro-400Regular.ttf', bold: '/fonts/BeVietnamPro-700Bold.ttf' },
};

export type PhaDoConfig = {
  decoration: Decoration;
  scope: PhaDoScope;
  outsideGenerations: number;
  paper: PaperName;
  /** Khổ tự nhập, tính bằng cm. */
  customWidthCm: number;
  customHeightCm: number;
  orientation: 'portrait' | 'landscape';
  extraLines: ExtraLine[];
  /** Hiện ảnh đại diện trong mỗi ô, với Người đã có ảnh. */
  showAvatars: boolean;
  /** Cỡ chữ tên trong ô (px CSS thật trên giấy); đổi cỡ chữ thì khổ giấy tự co giãn cho vừa (xem `fitPaperToFont`). */
  memberFontPx: number;
  fontFamily: PhaDoFontFamily;
  /** Khổ giấy tự tính theo nội dung (mọi thay đổi đều co giãn khổ cho vừa khít); tắt khi người dùng chọn khổ giấy cụ thể. */
  autoPaper: boolean;
  /** Màu chữ và màu nền ô thành viên (#rrggbb); null = mặc định (chữ đen, nền trắng, ô Dâu/Rể nền kem). */
  memberTextColor: string | null;
  memberFillColor: string | null;
};

/** Khoảng cỡ chữ cho phép ở mọi ô nhập cỡ chữ. */
export const FONT_PX_MIN = 4;
export const FONT_PX_MAX = 300;
/** Cỡ chữ ô tự suy cho một khổ cố định có thể nhỏ hơn FONT_PX_MIN khi cây rất đông; vẫn đọc lại được từ cấu hình đã lưu. */
export const MEMBER_FONT_PX_MIN = 1;

/** Khoảng kích thước khổ tự nhập (cm). */
export const CUSTOM_CM_MIN = 10;
export const CUSTOM_CM_MAX = 500;

export const defaultPhaDoConfig = (outsideGenerations: number): PhaDoConfig => ({
  scope: { kind: 'all' },
  outsideGenerations,
  paper: 'A1',
  customWidthCm: 100,
  customHeightCm: 70,
  orientation: 'landscape',
  extraLines: [],
  showAvatars: false,
  decoration: DEFAULT_DECORATION,
  memberFontPx: 14,
  fontFamily: 'frame',
  autoPaper: false,
  memberTextColor: null,
  memberFillColor: null,
});

/** Kích thước trang (mm) theo khổ và hướng giấy. */
export const pageSizeMm = (config: Pick<PhaDoConfig, 'paper' | 'customWidthCm' | 'customHeightCm' | 'orientation'>) => {
  const base =
    config.paper === 'custom'
      ? { width: config.customWidthCm * 10, height: config.customHeightCm * 10 }
      : PAPER_SIZES[config.paper];
  const short = Math.min(base.width, base.height);
  const long = Math.max(base.width, base.height);
  return config.orientation === 'portrait' ? { width: short, height: long } : { width: long, height: short };
};

/** Hệ số cỡ chữ trang trí: khổ tự động tính theo cạnh ngắn của trang, khổ cố định giữ nguyên cỡ người dùng đặt (xem `autoDecorationScale`). */
export const decorationScaleOf = (config: Pick<PhaDoConfig, 'autoPaper' | 'paper' | 'customWidthCm' | 'customHeightCm' | 'orientation'>): number => {
  if (!config.autoPaper) return 1;
  const page = pageSizeMm(config);
  return autoDecorationScale(Math.min(page.width, page.height));
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
/** Chỉ nhận #rrggbb; giá trị lạ (hoặc chưa đặt) thì dùng màu mặc định. */
const hexColor = (value: unknown): string | null => (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null);
const EXTRA_LINES: readonly ExtraLine[] = ['gio', 'doi', 'que'];

/** Đọc cấu hình đã lưu (JSON từ database); giá trị lạ thì dùng mặc định thay vì hỏng trang. */
export const readPhaDoConfig = (stored: unknown, outsideGenerations: number): PhaDoConfig => {
  const fallback = defaultPhaDoConfig(outsideGenerations);
  if (!isRecord(stored)) return fallback;
  const scope = isRecord(stored.scope) ? stored.scope : {};
  const readScope = (): PhaDoScope => {
    if (scope.kind === 'branch' && typeof scope.personId === 'string') return { kind: 'branch', personId: scope.personId };
    if (scope.kind === 'from-person' && typeof scope.personId === 'string') {
      const depth = Number(scope.depth);
      return { kind: 'from-person', personId: scope.personId, depth: Number.isInteger(depth) && depth >= 1 && depth <= 30 ? depth : 3 };
    }
    return { kind: 'all' };
  };
  const number = (value: unknown, min: number, max: number, otherwise: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : otherwise;
  };
  const paper = stored.paper;
  const decoration = isRecord(stored.decoration) ? stored.decoration : {};
  const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');
  return {
    decoration: {
      frame: typeof decoration.frame === 'string' && decoration.frame in FRAME_LABELS ? (decoration.frame as FrameStyle) : DEFAULT_DECORATION.frame,
      look: DECOR_LOOKS.includes(decoration.look as DecorLook) ? (decoration.look as DecorLook) : DEFAULT_DECORATION.look,
      title: text(decoration.title, 120),
      subtitle: text(decoration.subtitle, 200),
      coupletLeft: text(decoration.coupletLeft, 200),
      coupletRight: text(decoration.coupletRight, 200),
      titleSize: number(decoration.titleSize, FONT_PX_MIN, FONT_PX_MAX, DEFAULT_DECORATION.titleSize),
      subtitleSize: number(decoration.subtitleSize, FONT_PX_MIN, FONT_PX_MAX, DEFAULT_DECORATION.subtitleSize),
      coupletSize: number(decoration.coupletSize, FONT_PX_MIN, FONT_PX_MAX, DEFAULT_DECORATION.coupletSize),
    },
    scope: readScope(),
    outsideGenerations: number(stored.outsideGenerations, 0, 5, fallback.outsideGenerations),
    paper: paper === 'A3' || paper === 'A2' || paper === 'A1' || paper === 'A0' || paper === 'custom' ? paper : fallback.paper,
    customWidthCm: number(stored.customWidthCm, CUSTOM_CM_MIN, CUSTOM_CM_MAX, fallback.customWidthCm),
    customHeightCm: number(stored.customHeightCm, CUSTOM_CM_MIN, CUSTOM_CM_MAX, fallback.customHeightCm),
    orientation: stored.orientation === 'portrait' ? 'portrait' : 'landscape',
    extraLines: Array.isArray(stored.extraLines)
      ? [...new Set(stored.extraLines.filter((line): line is ExtraLine => EXTRA_LINES.includes(line as ExtraLine)))].slice(0, 2)
      : [],
    showAvatars: stored.showAvatars === true,
    memberFontPx: number(stored.memberFontPx, MEMBER_FONT_PX_MIN, FONT_PX_MAX, fallback.memberFontPx),
    // Giá trị cũ 'noto-serif' (mặc định trước đây) và 'system' (phông máy, không có file để nhúng nên bản in khác bản xem) chuyển thành "Theo kiểu khung"; giá trị lạ hoặc thiếu cũng vậy.
    fontFamily: stored.fontFamily === 'be-vietnam-pro' ? 'be-vietnam-pro' : 'frame',
    autoPaper: stored.autoPaper === true,
    memberTextColor: hexColor(stored.memberTextColor),
    memberFillColor: hexColor(stored.memberFillColor),
  };
};
