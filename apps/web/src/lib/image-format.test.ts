import { describe, expect, it } from 'vitest';
import { isRasterImage } from './image-format';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe('isRasterImage', () => {
  it('nhận JPEG, PNG, WEBP, GIF theo đầu file', () => {
    expect(isRasterImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(isRasterImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(true);
    expect(isRasterImage(ascii('RIFF\u0000\u0000\u0000\u0000WEBP'))).toBe(true);
    expect(isRasterImage(ascii('GIF89a'))).toBe(true);
  });

  it('từ chối trang HTML (Vite dev trả index.html cho /api/photos), JSON lỗi, SVG và dữ liệu rỗng', () => {
    expect(isRasterImage(ascii('<!doctype html><html>'))).toBe(false);
    expect(isRasterImage(ascii('{"error":"x"}'))).toBe(false);
    expect(isRasterImage(ascii('<svg xmlns='))).toBe(false);
    expect(isRasterImage(ascii('RIFF\u0000\u0000\u0000\u0000WAVE'))).toBe(false);
    expect(isRasterImage(bytes())).toBe(false);
  });
});
