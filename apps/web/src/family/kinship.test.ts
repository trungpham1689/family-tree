import { describe, expect, it } from 'vitest';
import { buildFamilyGraph, type GraphPerson } from './family-graph';
import { isOlder, relationTerm } from './kinship';

const person = (id: string, extra: Partial<GraphPerson> = {}): GraphPerson => ({
  id,
  full_name: id,
  gender: 'nam',
  birth_year: null,
  birth_order: null,
  ...extra,
});

/**
 * To + Vo
 *  ├─ ConTrai (nam, 1950) + DauA (nu)
 *  │   └─ ChauNoi (nam, 1975)
 *  └─ ConGai (nu, 1955) + ChongB (nam)
 *      └─ ChauNgoai (nu, 1978)
 */
const sample = () =>
  buildFamilyGraph({
    persons: [
      person('to', { gender: 'nam' }),
      person('vo', { gender: 'nu' }),
      person('con-trai', { gender: 'nam', birth_year: 1950 }),
      person('con-gai', { gender: 'nu', birth_year: 1955 }),
      person('dau-a', { gender: 'nu' }),
      person('chong-b', { gender: 'nam' }),
      person('chau-noi', { gender: 'nam', birth_year: 1975 }),
      person('chau-ngoai', { gender: 'nu', birth_year: 1978 }),
      person('nguoi-la', { gender: 'nam' }),
    ],
    parentLinks: [
      { child_id: 'con-trai', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con-trai', parent_id: 'vo', kind: 'ruot' },
      { child_id: 'con-gai', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con-gai', parent_id: 'vo', kind: 'ruot' },
      { child_id: 'chau-noi', parent_id: 'con-trai', kind: 'ruot' },
      { child_id: 'chau-noi', parent_id: 'dau-a', kind: 'ruot' },
      { child_id: 'chau-ngoai', parent_id: 'con-gai', kind: 'ruot' },
      { child_id: 'chau-ngoai', parent_id: 'chong-b', kind: 'ruot' },
    ],
    unions: [
      { id: 'u1', partner_a: 'to', partner_b: 'vo', order_for_a: 1, order_for_b: 1, status: 'con' },
      { id: 'u2', partner_a: 'con-trai', partner_b: 'dau-a', order_for_a: 1, order_for_b: 1, status: 'con' },
      { id: 'u3', partner_a: 'con-gai', partner_b: 'chong-b', order_for_a: 1, order_for_b: 1, status: 'con' },
    ],
    positions: [
      { person_id: 'to', generation: 1, branch_id: null, kind: 'thuy_to' },
      { person_id: 'vo', generation: 1, branch_id: null, kind: 'dau_re' },
      { person_id: 'con-trai', generation: 2, branch_id: 'con-trai', kind: 'dinh' },
      { person_id: 'con-gai', generation: 2, branch_id: 'con-gai', kind: 'dinh' },
      { person_id: 'dau-a', generation: 2, branch_id: null, kind: 'dau_re' },
      { person_id: 'chong-b', generation: 2, branch_id: null, kind: 'dau_re' },
      { person_id: 'chau-noi', generation: 3, branch_id: 'con-trai', kind: 'dinh' },
      { person_id: 'chau-ngoai', generation: 3, branch_id: 'con-gai', kind: 'dinh' },
      { person_id: 'nguoi-la', generation: null, branch_id: null, kind: 'chua_noi' },
    ],
  });

describe('relationTerm', () => {
  it('chính mình', () => {
    expect(relationTerm(sample(), 'to', 'to')).toBe('Chính là người này');
  });

  it('cha mẹ và con trai/con gái', () => {
    const graph = sample();
    expect(relationTerm(graph, 'con-trai', 'to')).toBe('Cha');
    expect(relationTerm(graph, 'con-trai', 'vo')).toBe('Mẹ');
    expect(relationTerm(graph, 'to', 'con-trai')).toBe('Con trai');
    expect(relationTerm(graph, 'to', 'con-gai')).toBe('Con gái');
  });

  it('ông/bà nội và ngoại, cháu nội và cháu ngoại', () => {
    const graph = sample();
    expect(relationTerm(graph, 'chau-noi', 'to')).toBe('Ông nội');
    expect(relationTerm(graph, 'chau-ngoai', 'to')).toBe('Ông ngoại');
    expect(relationTerm(graph, 'to', 'chau-noi')).toBe('Cháu nội (trai)');
    expect(relationTerm(graph, 'to', 'chau-ngoai')).toBe('Cháu ngoại (gái)');
  });

  it('anh chị em ruột theo năm sinh', () => {
    const graph = sample();
    expect(relationTerm(graph, 'con-trai', 'con-gai')).toBe('Em gái');
    expect(relationTerm(graph, 'con-gai', 'con-trai')).toBe('Anh trai');
  });

  it('chú/cô bên nội, cậu/dì bên ngoại', () => {
    const graph = sample();
    // chau-noi gọi con-gai (em gái của cha) là Cô.
    expect(relationTerm(graph, 'chau-noi', 'con-gai')).toBe('Cô');
    // chau-ngoai gọi con-trai (anh trai của mẹ) là Cậu.
    expect(relationTerm(graph, 'chau-ngoai', 'con-trai')).toBe('Cậu');
    // Chiều ngược lại: cháu trai/gái.
    expect(relationTerm(graph, 'con-gai', 'chau-noi')).toBe('Cháu trai');
  });

  it('anh chị em họ đời 2 — chau-noi (1975) lớn hơn chau-ngoai (1978)', () => {
    const graph = sample();
    expect(relationTerm(graph, 'chau-noi', 'chau-ngoai')).toBe('Em họ (gái)');
    expect(relationTerm(graph, 'chau-ngoai', 'chau-noi')).toBe('Anh họ');
  });

  it('vợ chồng', () => {
    const graph = sample();
    expect(relationTerm(graph, 'con-trai', 'dau-a')).toBe('Vợ cả');
    expect(relationTerm(graph, 'dau-a', 'con-trai')).toBe('Chồng');
  });

  it('không có quan hệ nào tìm được', () => {
    expect(relationTerm(sample(), 'to', 'nguoi-la')).toBeNull();
  });
});

describe('isOlder: sinh trước là lớn hơn', () => {
  const born = (year: number | null, month: number | null = null, day: number | null = null, order: number | null = null) =>
    person('x', { birth_year: year, birth_month: month, birth_day: day, birth_order: order });

  it('so năm, rồi tháng, rồi ngày', () => {
    expect(isOlder(born(1950), born(1955))).toBe(true);
    expect(isOlder(born(1955), born(1950))).toBe(false);
    expect(isOlder(born(1950, 3), born(1950, 8))).toBe(true);
    expect(isOlder(born(1950, 8, 2), born(1950, 8, 1))).toBe(false);
    expect(isOlder(born(1950, 8, 1), born(1950, 8, 2))).toBe(true);
  });

  it('cùng năm mà thiếu tháng/ngày, hoặc trùng hẳn: chưa biết, không đoán là em', () => {
    expect(isOlder(born(1950), born(1950))).toBeNull();
    expect(isOlder(born(1950, 3), born(1950))).toBeNull();
    expect(isOlder(born(1950, 3), born(1950, 3))).toBeNull();
    expect(isOlder(born(1950, 3, 4), born(1950, 3))).toBeNull();
    expect(isOlder(born(null), born(1950))).toBeNull();
  });

  it('Thứ tự con chỉ có nghĩa giữa anh chị em: họ hàng khác nhánh bỏ qua, anh chị em thì Thứ tự đã ghi quyết định trước', () => {
    expect(isOlder(born(null, null, null, 1), born(null, null, null, 3))).toBeNull();
    expect(isOlder(born(null, null, null, 1), born(null, null, null, 3), true)).toBe(true);
    expect(isOlder(born(null, null, null, 3), born(null, null, null, 1), true)).toBe(false);
    // Thứ tự đã ghi (người dùng kéo thả) thắng năm sinh.
    expect(isOlder(born(1960, null, null, 1), born(1950, null, null, 2), true)).toBe(true);
    // Chỉ một bên có Thứ tự: so ngày sinh.
    expect(isOlder(born(1950, null, null, 2), born(1960), true)).toBe(true);
  });

  it('xưng hô anh/em cùng năm sinh khác tháng; cùng năm thiếu tháng thì chưa rõ', () => {
    const graph = buildFamilyGraph({
      persons: [
        person('cha'),
        person('a', { birth_year: 1950, birth_month: 2 }),
        person('b', { birth_year: 1950, birth_month: 9 }),
        person('c', { birth_year: 1950 }),
      ],
      parentLinks: ['a', 'b', 'c'].map((child_id) => ({ child_id, parent_id: 'cha', kind: 'ruot' })),
      unions: [],
      positions: [],
    });
    expect(relationTerm(graph, 'b', 'a')).toBe('Anh trai'); // a sinh tháng 2, trước b
    expect(relationTerm(graph, 'a', 'b')).toBe('Em trai');
    expect(relationTerm(graph, 'a', 'c')).toBe('Anh/Em trai'); // c chỉ biết năm: chưa rõ
  });
});
