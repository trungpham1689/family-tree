import { describe, expect, it } from 'vitest';
import { DEFAULT_DECORATION, FRAME_LABELS, layoutDecoration, type FrameStyle } from './decoration';

const ALL_STYLES = Object.keys(FRAME_LABELS) as FrameStyle[];
const PAGE = { width: 297, height: 420 };

const isFinitePoint = ([x, y]: [number, number]) => Number.isFinite(x) && Number.isFinite(y);

describe('layoutDecoration', () => {
  it.each(ALL_STYLES)('%s: vùng cây nằm trong trang, mọi toạ độ hữu hạn', (frame) => {
    const layout = layoutDecoration(PAGE, { ...DEFAULT_DECORATION, frame }, 'họ Nguyễn');
    expect(layout.content.x).toBeGreaterThanOrEqual(0);
    expect(layout.content.y).toBeGreaterThanOrEqual(0);
    expect(layout.content.x + layout.content.width).toBeLessThanOrEqual(PAGE.width);
    expect(layout.content.y + layout.content.height).toBeLessThanOrEqual(PAGE.height);
    expect(layout.content.width).toBeGreaterThan(0);
    expect(layout.content.height).toBeGreaterThan(0);

    for (const item of [...layout.below, ...layout.above]) {
      if (item.type === 'line') expect(item.points.every(isFinitePoint)).toBe(true);
      if (item.type === 'rect' || item.type === 'text') {
        expect(Number.isFinite(item.x)).toBe(true);
        expect(Number.isFinite(item.y)).toBe(true);
      }
    }
  });

  it('khung có hồi văn chạy quanh (trieu-nguyen, tram-huong, son-kim…) vẽ nhiều nét hơn khung tối giản (thanh-nha)', () => {
    const ornate = layoutDecoration(PAGE, { ...DEFAULT_DECORATION, frame: 'trieu-nguyen' }, 'họ Nguyễn');
    const minimal = layoutDecoration(PAGE, { ...DEFAULT_DECORATION, frame: 'thanh-nha' }, 'họ Nguyễn');
    const lineCount = (items: typeof ornate.below) => items.filter((item) => item.type === 'line').length;
    expect(lineCount(ornate.below)).toBeGreaterThan(lineCount(minimal.below));
  });

  it('không khung ("none") vẫn có vùng cây hợp lệ, không vẽ viền', () => {
    const layout = layoutDecoration(PAGE, { ...DEFAULT_DECORATION, frame: 'none' }, 'họ Nguyễn');
    expect(layout.below.some((item) => item.type === 'rect' && item.stroke !== item.fill)).toBe(false);
    expect(layout.content.width).toBeGreaterThan(0);
  });

  it.each(['son-kim', 'moc', 'lam-ngoc', 'hoang-gia', 'trieu-nguyen', 'tram-huong'] as FrameStyle[])(
    '%s: dải hồi văn nối liền với hoạ tiết góc ở cả hai đầu, không hở',
    (frame) => {
      const lines = layoutDecoration(PAGE, { ...DEFAULT_DECORATION, frame }, 'họ Nguyễn').below.filter((item) => item.type === 'line');
      const strips = lines.filter((line) => line.points.length > 20);
      const corners = lines.filter((line) => line.points.length <= 20);
      expect(strips).toHaveLength(4);
      expect(corners).toHaveLength(4);
      const cornerVertices = corners.flatMap((corner) => corner.points);
      for (const strip of strips) {
        expect(strip.seamless).toBe(true);
        for (const end of [strip.points[0]!, strip.points.at(-1)!]) {
          const touches = cornerVertices.some(([x, y]) => Math.abs(x - end[0]) < 1e-6 && Math.abs(y - end[1]) < 1e-6);
          expect(touches).toBe(true);
        }
      }
    },
  );

  it('gấm hoa: lưới ô thoi chỉ nằm trong dải khung lót, không vào ô trắng của cây', () => {
    const { below } = layoutDecoration(PAGE, { ...DEFAULT_DECORATION, frame: 'gam-hoa' }, 'họ Nguyễn');
    const unit = PAGE.width / 100;
    const panel = 9.2 * unit;
    const lattice = below.filter((item) => item.type === 'line' && !item.seamless && item.strokeWidth < 0.2 * unit);
    expect(lattice.length).toBeGreaterThan(50);
    for (const item of lattice) {
      if (item.type !== 'line') continue;
      for (const [x, y] of item.points) {
        const inPanel = x > panel + 1e-6 && x < PAGE.width - panel - 1e-6 && y > panel + 1e-6 && y < PAGE.height - panel - 1e-6;
        expect(inPanel).toBe(false);
        expect(x).toBeGreaterThanOrEqual(5.3 * unit - 1e-6);
        expect(y).toBeGreaterThanOrEqual(5.3 * unit - 1e-6);
      }
    }
  });

  it.each(['cuon-thu', 'hoanh-phi', 'dong-son', 'gam-hoa'] as FrameStyle[])('%s: có nhãn trong danh sách khung và vẽ nhiều chi tiết hơn khung tối giản', (frame) => {
    expect(FRAME_LABELS[frame]).toBeTruthy();
    const items = layoutDecoration(PAGE, { ...DEFAULT_DECORATION, frame }, 'họ Nguyễn').below;
    const minimal = layoutDecoration(PAGE, { ...DEFAULT_DECORATION, frame: 'thanh-nha' }, 'họ Nguyễn').below;
    expect(items.length).toBeGreaterThan(minimal.length);
  });
});
