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

/** CSS font-family thật dùng khi xem trước; bản xuất PDF/PNG luôn nhúng NotoSerif để chắc chắn đủ dấu. */
export const FONT_FAMILY_CSS: Record<PhaDoFontFamily, string> = {
  'noto-serif': "'Noto Serif', ui-serif, Georgia, serif",
  'be-vietnam-pro': "'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif",
  system: 'ui-serif, Georgia, serif',
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
  /** Hệ số cỡ chữ tối đa (1 = mặc định 28pt); vẫn bị giới hạn theo khổ giấy thật sự chứa được. */
  fontScale: number;
  /** Chỉ áp dụng khi xem trước trên trang; bản xuất luôn là NotoSerif. */
  fontFamily: PhaDoFontFamily;
};

export const FONT_SCALE_OPTIONS = [0.75, 1, 1.3, 1.6] as const;

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
  fontScale: 1,
  fontFamily: 'noto-serif',
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
    },
    scope: readScope(),
    outsideGenerations: number(stored.outsideGenerations, 0, 5, fallback.outsideGenerations),
    paper: paper === 'A3' || paper === 'A2' || paper === 'A1' || paper === 'A0' || paper === 'custom' ? paper : fallback.paper,
    customWidthCm: number(stored.customWidthCm, 10, 500, fallback.customWidthCm),
    customHeightCm: number(stored.customHeightCm, 10, 500, fallback.customHeightCm),
    orientation: stored.orientation === 'portrait' ? 'portrait' : 'landscape',
    extraLines: Array.isArray(stored.extraLines)
      ? [...new Set(stored.extraLines.filter((line): line is ExtraLine => EXTRA_LINES.includes(line as ExtraLine)))].slice(0, 2)
      : [],
    showAvatars: stored.showAvatars === true,
    fontScale: number(stored.fontScale, 0.5, 2, fallback.fontScale),
    fontFamily:
      stored.fontFamily === 'noto-serif' || stored.fontFamily === 'be-vietnam-pro' || stored.fontFamily === 'system'
        ? stored.fontFamily
        : fallback.fontFamily,
  };
};
