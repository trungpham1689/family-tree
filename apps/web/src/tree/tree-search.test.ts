import { describe, expect, it } from 'vitest';
import { normalizeName, planReveal, searchPersons } from './tree-search';

describe('normalizeName', () => {
  it('bỏ dấu, đổi đ, chữ thường', () => {
    expect(normalizeName('  Nguyễn  Văn Ân ')).toBe('nguyen van an');
    expect(normalizeName('ĐẶNG Thị Đào')).toBe('dang thi dao');
  });
});

describe('searchPersons', () => {
  const persons = [
    { id: '1', full_name: 'Nguyễn Văn An' },
    { id: '2', full_name: 'Trần Văn Ánh', common_name: 'Cụ Nguyễn' },
    { id: '3', full_name: 'Nguyễn Văn An Khang' },
    { id: '4', full_name: 'Lê Thị Hoa' },
  ];

  it('tìm không dấu ra tên có dấu', () => {
    expect(searchPersons(persons, 'nguyen van an').map((p) => p.id)).toEqual(['1', '3']);
  });

  it('khớp cả tên thường gọi, và các từ không cần liền nhau', () => {
    expect(searchPersons(persons, 'nguyen').map((p) => p.id)).toEqual(['1', '3', '2']);
    expect(searchPersons(persons, 'le hoa').map((p) => p.id)).toEqual(['4']);
  });

  it('chuỗi rỗng không trả về gì', () => {
    expect(searchPersons(persons, '  ')).toEqual([]);
  });
});

describe('planReveal', () => {
  // to → trai → chau (đang thu gọn ở trai); to → gai (nữ) → chau-ngoai; chau có vợ "dau".
  const genders: Record<string, string> = { to: 'nam', trai: 'nam', gai: 'nu', chau: 'nam', 'chau-ngoai': 'nam', dau: 'nu' };
  const base = {
    rootId: 'to',
    genderOf: (id: string) => genders[id] ?? null,
    parentLinks: [
      { parent_id: 'to', child_id: 'trai' },
      { parent_id: 'to', child_id: 'gai' },
      { parent_id: 'trai', child_id: 'chau' },
      { parent_id: 'gai', child_id: 'chau-ngoai' },
    ],
    unions: [{ partner_a: 'chau', partner_b: 'dau' }],
    collapsed: new Set(['trai', 'khac']),
    outsideGenerations: 0,
  };

  it('mở các nhánh tổ tiên đang thu gọn, giữ nguyên nhánh khác', () => {
    const plan = planReveal({ ...base, targetId: 'chau' });
    expect([...plan!.collapsed]).toEqual(['khac']);
    expect(plan!.outsideGenerations).toBe(0);
  });

  it('người ngoài họ đi theo đường của người phối ngẫu', () => {
    expect([...planReveal({ ...base, targetId: 'dau' })!.collapsed]).toEqual(['khac']);
  });

  it('Cháu ngoại cần nâng số đời hiển thị lên đủ để hiện', () => {
    expect(planReveal({ ...base, targetId: 'chau-ngoai' })!.outsideGenerations).toBe(1);
    expect(planReveal({ ...base, targetId: 'chau-ngoai', outsideGenerations: 3 })!.outsideGenerations).toBe(3);
  });

  it('người chưa nối vào cây thì không mở được', () => {
    expect(planReveal({ ...base, targetId: 'lac' })).toBeNull();
  });
});
