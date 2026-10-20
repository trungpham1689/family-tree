import { describe, expect, it } from 'vitest';
import { birthOrderLabel, kindLabel, spouseCountText, spouseLabel } from './labels';

describe('nhãn quan hệ', () => {
  it('phân biệt Dâu và Rể theo giới tính', () => {
    expect(kindLabel('dau_re', 'nu')).toBe('Dâu');
    expect(kindLabel('dau_re', 'nam')).toBe('Rể');
    expect(kindLabel('dau_re', null)).toBe('Dâu/Rể');
  });

  it.each([
    ['nu', 1, 'Vợ cả'],
    ['nu', 2, 'Vợ hai'],
    ['nu', 4, 'Vợ tư'],
    ['nam', 1, 'Chồng'],
    ['nam', 2, 'Chồng hai'],
    ['nu', 15, 'Vợ thứ 15'],
  ] as const)('%s, thứ %i → %s', (gender, order, expected) => {
    expect(spouseLabel(gender, order)).toBe(expected);
  });

  it.each([
    [1, 'Con trưởng'],
    [2, 'Con thứ hai'],
    [4, 'Con thứ tư'],
    [12, 'Con thứ 12'],
    [null, ''],
  ] as const)('thứ tự con %s → "%s"', (order, expected) => {
    expect(birthOrderLabel(order)).toBe(expected);
  });
});

describe('spouseCountText', () => {
  it('ghi đúng vợ hay chồng theo giới tính của người kia', () => {
    expect(spouseCountText(['nu'])).toBe('1 vợ');
    expect(spouseCountText(['nam'])).toBe('1 chồng');
    expect(spouseCountText(['nu', 'nu', 'nu'])).toBe('3 vợ');
    expect(spouseCountText(['nu', 'nam'])).toBe('1 vợ, 1 chồng');
    expect(spouseCountText([null])).toBe('1 vợ/chồng');
    expect(spouseCountText([])).toBe('');
  });
});
