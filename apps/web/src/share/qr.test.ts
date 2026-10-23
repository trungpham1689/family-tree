import { describe, expect, it } from 'vitest';
import { qrMatrix, qrSvgPath } from './qr';

describe('qrMatrix', () => {
  it('ma trận vuông, có ô định vị đặc trưng ở góc trên trái', () => {
    const matrix = qrMatrix('https://gia-pha.pages.dev/p/abc123');
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
    // Ô định vị 7×7: viền đen, vòng trong trắng, lõi 3×3 đen.
    expect(matrix[0]!.slice(0, 7)).toEqual(Array(7).fill(true));
    expect(matrix[1]!.slice(0, 7)).toEqual([true, false, false, false, false, false, true]);
    expect(matrix[3]!.slice(0, 7)).toEqual([true, false, true, true, true, false, true]);
  });

  it('path SVG có đúng một hình vuông cho mỗi ô đen', () => {
    const matrix = qrMatrix('x');
    const dark = matrix.flat().filter(Boolean).length;
    expect(qrSvgPath(matrix).match(/M/g)).toHaveLength(dark);
  });
});
