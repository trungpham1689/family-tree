/** Bản vẽ trung gian (đơn vị mm), dùng chung cho xem trước SVG và xuất PDF. */
export type DrawRect = {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Viền đứt khi có (mm bật/tắt xen kẽ) — ví dụ đánh dấu Dâu/Rể. */
  dash?: readonly number[];
};
export type DrawLine = {
  type: 'line';
  points: [number, number][];
  stroke: string;
  strokeWidth: number;
  /** Đầu nét vuông + góc nhọn, để các nét trang trí nối nhau liền mạch, không hở ở góc hay chỗ giáp. */
  seamless?: boolean;
};
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

export type DrawImage = {
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
  /** Ảnh đại diện: cắt tròn, viền màu theo giới tính/trạng thái (đường kính bằng width). */
  round?: { borderColor: string; borderWidth: number };
};

export type DrawItem = DrawRect | DrawLine | DrawText | DrawImage;

export type Drawing = { width: number; height: number; items: DrawItem[] };

export const PT_PER_MM = 72 / 25.4;

type PageSize = { width: number; height: number };

/** Chú giải và các chi tiết nhỏ thiết kế trên khổ A1 (cạnh ngắn 594 mm); khổ khác co giãn theo cạnh ngắn. */
const REFERENCE_SHORT_SIDE_MM = 594;
export const paperScale = (page: PageSize): number => Math.min(page.width, page.height) / REFERENCE_SHORT_SIDE_MM;

/**
 * Cỡ chữ trang trí (tiêu đề, phụ đề, câu đối): px trên trang có cạnh ngắn 1000 px, nên đổi khổ giấy thì
 * chữ, khung, hoạ tiết giữ nguyên tỉ lệ so với trang.
 */
export const decorationPxToMm = (page: PageSize, px: number): number => (px * Math.min(page.width, page.height)) / 1000;

/** Cỡ chữ tên trong ô: px CSS thật (96 dpi) trên giấy, không phụ thuộc khổ; khổ giấy tự lớn lên khi cần thêm chỗ. */
export const MM_PER_PX = 25.4 / 96;
