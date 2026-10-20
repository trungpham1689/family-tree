import { describe, expect, it } from 'vitest';
import { OUTSIDE_OPTIONS, outsideLabel } from './outside-generations';

describe('outsideLabel', () => {
  it('0 là không hiện Cháu ngoại, còn lại nói rõ số đời; bao phủ đúng các tuỳ chọn 0–5 (khớp check của cột outside_generations)', () => {
    expect(OUTSIDE_OPTIONS).toEqual([0, 1, 2, 3, 4, 5]);
    expect(outsideLabel(0)).toBe('Không hiện Cháu ngoại');
    expect(outsideLabel(2)).toBe('Hiện Cháu ngoại 2 đời');
  });
});
