import { describe, expect, it } from 'vitest';
import { PAPER_SIZES } from './config';
import { DESKTOP_LIMITS, IOS_LIMITS, planPng, readPngDpi, setPngDpi } from './png';

// PNG 1×1 điểm ảnh tối thiểu (IHDR + IDAT + IEND).
const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='),
  (char) => char.charCodeAt(0),
);

describe('PNG Phả đồ', () => {
  it('khổ A1 xuất đủ 300 dpi trên máy tính', () => {
    expect(planPng(PAPER_SIZES.A1, DESKTOP_LIMITS)).toEqual({ dpi: 300, width: 7016, height: 9933, reduced: false });
  });

  it('khổ A0 tự hạ dpi và báo trước, kích thước vừa giới hạn', () => {
    const plan = planPng(PAPER_SIZES.A0, DESKTOP_LIMITS);
    expect(plan.reduced).toBe(true);
    expect(plan.dpi).toBeLessThan(300);
    expect(plan.dpi).toBeGreaterThan(200);
    expect(plan.width * plan.height).toBeLessThanOrEqual(DESKTOP_LIMITS.maxArea);
    expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(DESKTOP_LIMITS.maxSide);
  });

  it('iPhone/iPad hạ dpi nhiều hơn để không lỗi', () => {
    const plan = planPng(PAPER_SIZES.A1, IOS_LIMITS);
    expect(plan.width * plan.height).toBeLessThanOrEqual(IOS_LIMITS.maxArea);
    expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(IOS_LIMITS.maxSide);
  });

  it('ghi dpi vào file PNG, thay giá trị cũ nếu có', () => {
    const at300 = setPngDpi(TINY_PNG, 300);
    expect(readPngDpi(TINY_PNG)).toBeNull();
    expect(readPngDpi(at300)).toBe(300);
    expect(readPngDpi(setPngDpi(at300, 254))).toBe(254);
    expect(setPngDpi(at300, 254).length).toBe(at300.length);
  });
});
