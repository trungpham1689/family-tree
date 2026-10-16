import { describe, expect, it } from 'vitest';
import { birthOrderLabel, kindLabel, spouseLabel } from './labels';

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
