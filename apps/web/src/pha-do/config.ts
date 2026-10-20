import { DEFAULT_DECORATION, FRAME_LABELS, type Decoration, type FrameStyle } from './decoration';

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
  que: 'Quê quán',
};

/** Vài phông đã nạp sẵn cho cả trang (Google Fonts trong index.html) hoặc phông hệ thống — không cần cài thêm. */
export type PhaDoFontFamily = 'noto-serif' | 'be-vietnam-pro' | 'system';

export const FONT_FAMILY_LABELS: Record<PhaDoFontFamily, string> = {
  'noto-serif': 'Noto Serif (trang trọng)',
  'be-vietnam-pro': 'Be Vietnam Pro (hiện đại)',
  system: 'Chữ hệ thống',
};

/** CSS font-family thật dùng khi xem trước trên trang. */
export const FONT_FAMILY_CSS: Record<PhaDoFontFamily, string> = {
  'noto-serif': "'Noto Serif', ui-serif, Georgia, serif",
  'be-vietnam-pro': "'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif",
  system: 'ui-serif, Georgia, serif',
};

/**
 * File TTF nhúng khi xuất PDF/PNG, cùng phông đã chọn xem trước. "Chữ hệ thống" là phông của từng
 * máy nên không có file để nhúng — xuất tạm bằng Noto Serif (vẫn đủ dấu tiếng Việt).
 */
export const FONT_FAMILY_EXPORT_FILES: Record<PhaDoFontFamily, { regular: string; bold: string }> = {
  'noto-serif': { regular: '/fonts/NotoSerif-400Regular.ttf', bold: '/fonts/NotoSerif-700Bold.ttf' },
  'be-vietnam-pro': { regular: '/fonts/BeVietnamPro-400Regular.ttf', bold: '/fonts/BeVietnamPro-700Bold.ttf' },
  system: { regular: '/fonts/NotoSerif-400Regular.ttf', bold: '/fonts/NotoSerif-700Bold.ttf' },
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
  /** Chỉ áp dụng khi xem trước trên trang; bản xuất luôn là NotoSerif. */
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

/** Khoảng kích thước khổ tự nhập (cm). */
export const CUSTOM_CM_MIN = 10;
export const CUSTOM_CM_MAX = 500;

/** Đã có cỡ chữ ô lưu sẵn chưa; chưa thì trang dùng cỡ chữ đang hiện lúc mở lần đầu (xem `autoMemberFontPx`). */
export const hasStoredMemberFont = (stored: unknown): boolean =>
  isRecord(stored) && typeof stored.memberFontPx === 'number' && Number.isFinite(stored.memberFontPx);

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
  fontFamily: 'noto-serif',
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
    memberFontPx: number(stored.memberFontPx, FONT_PX_MIN, FONT_PX_MAX, fallback.memberFontPx),
    fontFamily:
      stored.fontFamily === 'noto-serif' || stored.fontFamily === 'be-vietnam-pro' || stored.fontFamily === 'system'
        ? stored.fontFamily
        : fallback.fontFamily,
    autoPaper: stored.autoPaper === true,
    memberTextColor: hexColor(stored.memberTextColor),
    memberFillColor: hexColor(stored.memberFillColor),
  };
};
