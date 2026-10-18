import { describe, expect, it } from 'vitest';
import { findIncomplete } from './incomplete';

const person = (over: Partial<{ gender: string | null; birth_year: number | null; death_year: number | null; is_deceased: boolean }>) => ({
  gender: 'nam',
  birth_year: 1900,
  death_year: null,
  is_deceased: false,
  ...over,
});

describe('findIncomplete', () => {
  it('hồ sơ đầy đủ thì không báo', () => {
    expect(findIncomplete([person({})])).toEqual([]);
  });

  it('thiếu giới tính và năm sinh', () => {
    const p = person({ gender: null, birth_year: null });
    expect(findIncomplete([p])).toEqual([{ person: p, reasons: ['gioi_tinh', 'nam_sinh'] }]);
  });

  it('đã mất nhưng thiếu năm mất', () => {
    const p = person({ is_deceased: true, death_year: null });
    expect(findIncomplete([p])).toEqual([{ person: p, reasons: ['nam_mat'] }]);
  });

  it('đã mất và có năm mất thì không báo thiếu năm mất', () => {
    const p = person({ is_deceased: true, death_year: 1980 });
    expect(findIncomplete([p])).toEqual([]);
  });
});
