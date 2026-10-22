import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { autoMemberFontPx, fitPaperToFont } from './auto-fit';
import type { PhaDoConfig } from './config';

/**
 * Thiết kế Phả đồ: mọi thay đổi cấu hình đi qua đây, và cấu hình luôn ở dạng "vừa khít" (settled):
 * - khổ giấy tự động (`autoPaper`): khổ giấy tự tính theo nội dung ở cỡ chữ ô đã chọn (tiêu đề, câu đối, cây, chú giải đều nằm gọn trong khung);
 * - khổ cố định (người dùng chọn khổ hay gõ Rộng/Cao): khổ giữ nguyên, cỡ chữ ô tự chỉnh cho vừa khổ đó.
 * Giao diện chỉ gửi sự kiện (`DesignChange`) và vẽ cấu hình nhận lại; không biết chế độ nào, khi nào tính lại, tính ra sao.
 *
 * Bất biến (có test): `settleDesign` chỉ phụ thuộc nội dung và chế độ, nên lũy đẳng (settle hai lần = một lần), và kết quả của `changeDesign` hoãn
 * (gõ chữ) rồi `settleDesign` bằng đúng kết quả của thay đổi áp dụng ngay.
 */

export type DesignContext = { graph: FamilyGraph<Person>; treeName: string };

export type DesignChange =
  /** Nội dung và kiểu dáng: phạm vi, Cháu ngoại, ảnh, dòng thêm, trang trí, hướng giấy, màu, phông chữ. */
  | { kind: 'content'; patch: Partial<PhaDoConfig> }
  /** Người dùng chọn khổ giấy hay kích thước cụ thể: giữ khổ đó, cỡ chữ ô tự chỉnh theo. */
  | { kind: 'paper'; patch: Partial<PhaDoConfig> }
  /** Bật khổ tự động. */
  | { kind: 'auto' }
  /** Đổi cỡ chữ tên trong ô: sang khổ tự động và tự co giãn khổ giấy cho vừa. */
  | { kind: 'font'; px: number };

/** Đưa cấu hình về dạng vừa khít theo chế độ của nó. Không đổi gì ngoài khổ giấy (tự động) hoặc cỡ chữ ô (cố định). */
export const settleDesign = (context: DesignContext, config: PhaDoConfig): PhaDoConfig =>
  config.autoPaper
    ? fitPaperToFont(context.graph, config, context.treeName)
    : { ...config, memberFontPx: autoMemberFontPx(context.graph, config, context.treeName) };

/**
 * Một thay đổi nội dung cần co giãn lại khi nào:
 * - `none`: không đụng tới bố cục (màu ô, phông chữ);
 * - `later`: chỉ đổi chữ tiêu đề/phụ đề/câu đối (gõ từng phím), chờ gõ xong mới tính lại;
 * - `now`: mọi thay đổi khác.
 */
export const refitTiming = (config: PhaDoConfig, patch: Partial<PhaDoConfig>): 'none' | 'later' | 'now' => {
  const keys = Object.keys(patch) as (keyof PhaDoConfig)[];
  if (keys.every((key) => key === 'memberTextColor' || key === 'memberFillColor' || key === 'fontFamily')) return 'none';
  const next = patch.decoration;
  if (keys.length === 1 && next) {
    // Chỉ khác ở các chữ (không khác khung, phương án phông chữ, cỡ chữ): so các trường còn lại.
    const sameLayout = (['frame', 'look', 'titleSize', 'subtitleSize', 'coupletSize'] as const).every((key) => next[key] === config.decoration[key]);
    if (sameLayout) return 'later';
  }
  return 'now';
};

/**
 * Việc cần làm với lần "settle hoãn" đang chờ (người dùng gõ chữ trang trí, chưa tính lại khổ giấy):
 * - `clear`: cấu hình mới đã vừa khít, huỷ lần chờ;
 * - `schedule`: cấu hình mới đã hiện chữ mới nhưng chưa vừa khít, hẹn (lại) một lần settle sau một lúc;
 * - `keep`: thay đổi không đụng tới bố cục, giữ nguyên lần chờ (nếu có) — huỷ nó sẽ để cấu hình lệch mãi.
 */
export type PendingSettle = 'clear' | 'schedule' | 'keep';

/** Áp một thay đổi; `pending` cho biết phải làm gì với lần settle hoãn đang chờ. */
export const changeDesign = (context: DesignContext, config: PhaDoConfig, change: DesignChange): { config: PhaDoConfig; pending: PendingSettle } => {
  switch (change.kind) {
    case 'content': {
      const next = { ...config, ...change.patch };
      const timing = refitTiming(config, change.patch);
      if (timing === 'now') return { config: settleDesign(context, next), pending: 'clear' };
      return { config: next, pending: timing === 'later' ? 'schedule' : 'keep' };
    }
    case 'paper':
      return { config: settleDesign(context, { ...config, ...change.patch, autoPaper: false }), pending: 'clear' };
    case 'auto':
      return { config: settleDesign(context, { ...config, autoPaper: true }), pending: 'clear' };
    case 'font':
      return { config: settleDesign(context, { ...config, memberFontPx: change.px, autoPaper: true }), pending: 'clear' };
  }
};
