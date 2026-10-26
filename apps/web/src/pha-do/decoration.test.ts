import { describe, expect, it } from 'vitest';
import { autoDecorationScale, DEFAULT_DECORATION, DECOR_LOOKS, FRAME_LABELS, layoutDecoration, memberColorsOf, paletteOf, type FrameStyle } from './decoration';
import { boardFillOf, boardTextColor } from './decoration-couplets';
import { DECOR_FONTS } from './decoration-fonts';
import { readPhaDoConfig } from './config';
import { legendWidthMm } from './render';

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

// --- Màu: tương phản (WCAG) và độ khác biệt màu (CIE76 ΔE) ---
const channel = (value: number) => (value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4);
const rgb = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map(channel) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const lab = (hex: string): [number, number, number] => {
  const [r, g, b] = rgb(hex).map(channel) as [number, number, number];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), f(0.2126 * r + 0.7152 * g + 0.0722 * b), f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const deltaE = (a: string, b: string) => Math.hypot(...lab(a).map((value, index) => value - lab(b)[index]!));

describe('phương án nền, màu chữ, phông chữ', () => {
  const combos = ALL_STYLES.flatMap((frame) => DECOR_LOOKS.map((look) => [frame, look] as const));

  it.each(combos)('%s · %s: tiêu đề và chữ phụ đạt tương phản từ 7:1 với nền; phông có trong danh sách', (frame, look) => {
    const palette = paletteOf(frame, look);
    expect(contrast(palette.title, palette.background), 'tiêu đề').toBeGreaterThanOrEqual(7);
    expect(contrast(palette.text, palette.background), 'chữ phụ').toBeGreaterThanOrEqual(7);
    expect(DECOR_FONTS[palette.titleFont]).toBeDefined();
    expect(DECOR_FONTS[palette.bodyFont]).toBeDefined();
  });

  it.each(ALL_STYLES)('%s: bốn phương án khác nhau (nền, màu hoặc phông)', (frame) => {
    const signatures = DECOR_LOOKS.map((look) => JSON.stringify(paletteOf(frame, look)));
    expect(new Set(signatures).size).toBe(4);
  });

  it.each(ALL_STYLES)('%s: ô thành viên đọc rõ (bản thiết kế Cổ điển) và ô Dâu/Rể khác ô nam', (frame) => {
    const member = memberColorsOf(frame);
    for (const fill of [member.fill, member.spouse]) {
      expect(contrast(member.name, fill), 'tên').toBeGreaterThanOrEqual(8);
      expect(contrast(member.detail, fill), 'chi tiết').toBeGreaterThanOrEqual(5.5);
    }
    expect(contrast(member.note, member.spouse), 'nhãn hôn phối').toBeGreaterThanOrEqual(6);
    expect(deltaE(member.spouse, member.fill), 'Dâu/Rể so với ô nam').toBeGreaterThanOrEqual(3);
  });

  it('chữ trang trí mang phông của phương án; mỗi phương án ra bố cục hợp lệ', () => {
    for (const look of DECOR_LOOKS) {
      const decoration = { ...DEFAULT_DECORATION, look, subtitle: 'Kính dâng tổ tiên', coupletLeft: 'Tổ đức', coupletRight: 'Tông công' };
      const { above } = layoutDecoration(PAGE, decoration, 'họ Nguyễn');
      const palette = paletteOf(decoration.frame, look);
      const texts = above.filter((item) => item.type === 'text');
      expect(texts.length).toBeGreaterThan(0);
      expect(texts[0]).toMatchObject({ font: palette.titleFont, color: palette.title });
      expect(texts.at(-1)).toMatchObject({ font: palette.bodyFont });
    }
  });

  it.each(combos)('%s · %s: chữ câu đối đạt tương phản từ 4,5:1 với nền liễn', (frame, look) => {
    const palette = paletteOf(frame, look);
    expect(contrast(boardTextColor(frame, palette.title), boardFillOf(frame, palette))).toBeGreaterThanOrEqual(4.5);
  });

  it('đọc lại cấu hình: phương án lạ hoặc thiếu thì dùng A', () => {
    expect(readPhaDoConfig({ decoration: { look: 'C' } }, 1).decoration.look).toBe('C');
    expect(readPhaDoConfig({ decoration: { look: 'Z' } }, 1).decoration.look).toBe('A');
    expect(readPhaDoConfig({ decoration: {} }, 1).decoration.look).toBe('A');
  });
});

describe('cỡ chữ trang trí theo khổ tự động', () => {
  it('giữ nguyên tới khổ A1, giảm dần khi khổ lớn hơn', () => {
    expect(autoDecorationScale(297)).toBe(1);
    expect(autoDecorationScale(594)).toBe(1);
    const sizes = [841, 1200, 1500, 2000, 3000].map(autoDecorationScale);
    expect(sizes[0]).toBeLessThan(1);
    for (let index = 1; index < sizes.length; index += 1) expect(sizes[index]).toBeLessThan(sizes[index - 1]!);
  });

  it('chiều cao chữ thật vẫn tăng theo khổ (chậm hơn khổ), tiêu đề ≥ 1,6 lần phụ đề', () => {
    const heightMm = (short: number) => short * 0.05 * autoDecorationScale(short);
    expect(heightMm(1200)).toBeGreaterThan(heightMm(594));
    expect(heightMm(3000)).toBeGreaterThan(heightMm(1200));
    expect(heightMm(3000) / 3000).toBeLessThan(heightMm(594) / 594);
  });

  it('hệ số nhân vào cỡ chữ tiêu đề, phụ đề, câu đối và không đổi khung', () => {
    const decoration = { ...DEFAULT_DECORATION, subtitle: 'Phụ đề', coupletLeft: 'Tổ đức', coupletRight: 'Tông công' };
    const full = layoutDecoration(PAGE, decoration, 'họ Nguyễn');
    const half = layoutDecoration(PAGE, decoration, 'họ Nguyễn', 0.5);
    const sizes = (layout: typeof full) => layout.above.filter((item) => item.type === 'text').map((item) => item.sizePt);
    sizes(full).forEach((size, index) => expect(sizes(half)[index]!).toBeCloseTo(size / 2, 3));
    expect(half.below).toEqual(full.below);
  });
});

describe('liễn câu đối', () => {
  it('chú giải luôn vừa vùng cây ngay cả khi liễn to: khung nào, khổ nào cũng vậy', () => {
    const short = 1000;
    expect(legendWidthMm({ width: short, height: 1414 }) / short).toBeLessThanOrEqual(0.45);
    for (const frame of ALL_STYLES) {
      for (const page of [{ width: short, height: 1414 }, { width: 1414, height: short }]) {
        const layout = layoutDecoration(page, { ...DEFAULT_DECORATION, frame, coupletSize: 80, coupletLeft: 'Nghìn Nghìn Nghìn Nghìn', coupletRight: 'Nghìn Nghìn' }, 'họ Nguyễn');
        expect(layout.content.width, frame).toBeGreaterThanOrEqual(legendWidthMm(page) - 1e-6);
      }
    }
  });

  const decoration = { ...DEFAULT_DECORATION, coupletLeft: 'Công đức tổ tiên soi sáng muôn đời rạng', coupletRight: 'Nghĩa tình con cháu giữ gìn vạn thuở bền' };

  it.each(ALL_STYLES)('%s: hai liễn cao bằng nhau, canh trên ngang mép trên vùng cây, chữ nằm trong liễn', (frame) => {
    const layout = layoutDecoration(PAGE, { ...decoration, frame }, 'họ Nguyễn');
    const texts = layout.above.filter((item) => item.type === 'text').slice(1);
    expect(texts).toHaveLength(18);
    const [leftX, rightX] = [Math.min(...texts.map((item) => item.x)), Math.max(...texts.map((item) => item.x))];
    expect(leftX).toBeLessThan(PAGE.width / 2);
    expect(rightX).toBeGreaterThan(PAGE.width / 2);
    expect(layout.content.x - (PAGE.width - layout.content.x - layout.content.width)).toBeCloseTo(0, 6);
    // Dòng chữ đầu tiên không thấp hơn mép trên vùng cây, và cả hai vế bắt đầu cùng độ cao.
    const firstY = texts.filter((item) => item.x === leftX)[0]!.y;
    expect(firstY).toBeGreaterThan(layout.content.y);
    expect(texts.filter((item) => item.x === rightX)[0]!.y).toBeCloseTo(firstY, 6);
    // Không chữ nào chạm vùng cây.
    for (const item of texts) expect(item.x < PAGE.width / 2 ? item.x < layout.content.x : item.x > layout.content.x + layout.content.width).toBe(true);
  });

  it('một vế để trống thì chỉ vẽ một liễn nhưng vùng cây vẫn đối xứng', () => {
    const both = layoutDecoration(PAGE, decoration, 'họ Nguyễn');
    const one = layoutDecoration(PAGE, { ...decoration, coupletRight: '' }, 'họ Nguyễn');
    expect(one.content.x - (PAGE.width - one.content.x - one.content.width)).toBeCloseTo(0, 6);
    expect(one.above.length).toBeLessThan(both.above.length);
  });
});
