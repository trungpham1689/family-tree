import { describe, expect, it } from 'vitest';
import { duplicateGroups, findDuplicates, normalizeName } from './duplicate-check';

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

describe('duplicateGroups', () => {
  const p = (id: string, full_name: string, birth_year: number | null) => ({ id, full_name, birth_year });

  it('nhóm người cùng tên (bỏ dấu) mà năm sinh không mâu thuẫn', () => {
    const groups = duplicateGroups([p('1', 'Phạm Văn A', 1950), p('2', 'pham van a', null), p('3', 'Phạm Văn B', 1950), p('4', 'Phạm Văn A', 1950)]);
    expect(groups.map((group) => group.map((x) => x.id))).toEqual([['1', '2', '4']]);
  });

  it('cùng tên nhưng khác năm sinh là hai người; người một mình không thành nhóm', () => {
    expect(duplicateGroups([p('1', 'Lê Văn C', 1950), p('2', 'Lê Văn C', 1980), p('3', 'Khác', null)])).toEqual([]);
  });
});
