/** Bản vẽ trung gian (đơn vị mm), dùng chung cho xem trước SVG và xuất PDF. */
export type DrawRect = { type: 'rect'; x: number; y: number; width: number; height: number; radius: number; fill: string; stroke: string; strokeWidth: number };
export type DrawLine = { type: 'line'; points: [number, number][]; stroke: string; strokeWidth: number };
export type DrawText = {
  type: 'text';
  x: number;
  y: number;
  text: string;
  /** Cỡ chữ theo point (1pt = 1/72 inch). */
  sizePt: number;
  bold: boolean;
  color: string;
  /** Căn theo x: giữa (mặc định, tên/chi tiết trong ô) hoặc trái (chú giải). */
  align?: 'middle' | 'start';
};

export type DrawImage = { type: 'image'; x: number; y: number; width: number; height: number; href: string };

export type DrawItem = DrawRect | DrawLine | DrawText | DrawImage;

export type Drawing = { width: number; height: number; items: DrawItem[] };

export const PT_PER_MM = 72 / 25.4;
