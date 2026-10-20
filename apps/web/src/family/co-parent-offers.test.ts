import { describe, expect, it } from 'vitest';
import { childrenWithoutCoParent, coParentOffers, coParentWord } from './co-parent';
import { buildFamilyGraph, type GraphPerson } from './family-graph';

const person = (id: string, gender: string, order: number | null = null): GraphPerson => ({ id, full_name: id, gender, birth_year: null, birth_order: order });
const link = (child_id: string, parent_id: string, kind = 'ruot') => ({ child_id, parent_id, kind });
const union = (id: string, a: string, b: string, order = 1) => ({ id, partner_a: a, partner_b: b, order_for_a: order, order_for_b: 1, status: 'con' });

/** Cha có 2 vợ; con a chỉ ghi cha, con b có mẹ vợ cả, con c là con nuôi chỉ ghi cha; mẹ vợ hai chưa có con nào. */
const family = () =>
  buildFamilyGraph({
    persons: [person('cha', 'nam'), person('v1', 'nu'), person('v2', 'nu'), person('a', 'nam', 1), person('b', 'nam', 2), person('c', 'nam', 3), person('solo', 'nam')],
    parentLinks: [link('a', 'cha'), link('b', 'cha'), link('b', 'v1'), link('c', 'cha', 'nuoi')],
    unions: [union('u1', 'cha', 'v1', 1), union('u2', 'cha', 'v2', 2)],
    positions: [],
  });

describe('con chưa rõ cha/mẹ còn lại', () => {
  it('chỉ con ruột chưa có cha/mẹ ruột khác', () => {
    expect(childrenWithoutCoParent(family(), 'cha').map((p) => p.id)).toEqual(['a']);
    expect(childrenWithoutCoParent(family(), 'v1').map((p) => p.id)).toEqual([]);
  });

  it('trang cha: con của chính mình chưa rõ mẹ; trang vợ hai: con của chồng chưa rõ mẹ (có thể là mẹ)', () => {
    const graph = family();
    expect(coParentOffers(graph, 'cha').map((o) => [o.owner, o.parent.id, o.children.map((c) => c.id)])).toEqual([['self', 'cha', ['a']]]);
    expect(coParentOffers(graph, 'v2').map((o) => [o.owner, o.parent.id, o.children.map((c) => c.id)])).toEqual([['spouse', 'cha', ['a']]]);
    expect(coParentOffers(graph, 'v1').map((o) => o.parent.id)).toEqual(['cha']);
  });

  it('không có vợ/chồng thì không có gì để ghi; người không tồn tại: rỗng', () => {
    const graph = buildFamilyGraph({ persons: [person('cha', 'nam'), person('k', 'nam')], parentLinks: [link('k', 'cha')], unions: [], positions: [] });
    expect(coParentOffers(graph, 'cha')).toEqual([]);
    expect(coParentOffers(graph, 'khong-co')).toEqual([]);
  });

  it('cách gọi người còn lại theo giới tính người đã ghi', () => {
    expect([coParentWord('nam'), coParentWord('nu'), coParentWord(null)]).toEqual(['Mẹ', 'Cha', 'Cha/Mẹ']);
  });
});
