import { describe, expect, it } from 'vitest';
import { findDuplicates, normalizeName } from './duplicate-check';

describe('normalizeName', () => {
  it('bỏ dấu, hoa/thường, khoảng trắng thừa', () => {
    expect(normalizeName('  Nguyễn   Văn ĐÔNG ')).toBe('nguyen van dong');
  });
});

describe('findDuplicates', () => {
  const candidates = [
    { id: '1', full_name: 'Nguyễn Văn An', birth_year: 1875 },
    { id: '2', full_name: 'Trần Thị Hoa', birth_year: 1855 },
  ];

  it('tìm thấy khi trùng tên dù khác cách gõ dấu', () => {
    expect(findDuplicates('nguyen van an', candidates)).toEqual([candidates[0]]);
  });

  it('không có trùng thì trả mảng rỗng', () => {
    expect(findDuplicates('Nguyễn Văn Khác', candidates)).toEqual([]);
  });

  it('tên trống thì không báo trùng', () => {
    expect(findDuplicates('   ', candidates)).toEqual([]);
  });
});
