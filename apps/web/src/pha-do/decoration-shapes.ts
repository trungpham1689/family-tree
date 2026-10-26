import type { DrawItem } from './drawing';

/** Các hình vẽ nhỏ dùng chung cho khung (`decoration.ts`) và liễn câu đối (`decoration-couplets.ts`). */

export type Page = { width: number; height: number };

/** Nền lớp gấm (viền ngoài ô trắng) của khung Gấm hoa; ô giữa dùng nền của phương án. */
export const GAM_HOA_MAT = '#f6e9c8';

export const rectItem = (x: number, y: number, width: number, height: number, stroke: string, strokeWidth: number, extra: Partial<Extract<DrawItem, { type: 'rect' }>> = {}): DrawItem => ({
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
export const circleItem = (cx: number, cy: number, r: number, fill: string, stroke: string, strokeWidth: number): DrawItem =>
  rectItem(cx - r, cy - r, 2 * r, 2 * r, stroke, strokeWidth, { radius: r, fill });
export const strokeItem = (points: [number, number][], stroke: string, strokeWidth: number, seamless = true): DrawItem => ({ type: 'line', points, stroke, strokeWidth, seamless });
export const diamondItem = (cx: number, cy: number, r: number, stroke: string, strokeWidth: number): DrawItem =>
  strokeItem([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy], [cx, cy - r]], stroke, strokeWidth);
