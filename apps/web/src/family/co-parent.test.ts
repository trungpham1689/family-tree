import { describe, expect, it } from 'vitest';
import { coParentCaptions } from './co-parent';
import { buildFamilyGraph, type GraphPerson } from './family-graph';

const person = (id: string, gender: string, extra: Partial<GraphPerson> = {}): GraphPerson => ({
  id, full_name: id, gender, birth_year: null, birth_order: null, ...extra,
});

const link = ([child_id, parent_id]: string[]) => ({ child_id: child_id!, parent_id: parent_id!, kind: 'ruot' });
const union = (id: string, a: string, b: string, order: number) => ({
  id, partner_a: a, partner_b: b, order_for_a: order, order_for_b: 1, status: 'con',
});

describe('coParentCaptions', () => {
  it('con gái 3 đời chồng: mỗi con ghi đúng chồng; con chỉ có mẹ ghi chưa rõ cha', () => {
    const graph = buildFamilyGraph({
      persons: [
        person('lan', 'nu'), person('re1', 'nam'), person('re2', 'nam'), person('re3', 'nam'),
        person('c1', 'nam', { birth_order: 1 }), person('c2', 'nu', { birth_order: 2 }),
        person('c3', 'nam', { birth_order: 3 }), person('c4', 'nu', { birth_order: 4 }),
      ],
      parentLinks: [['c1', 'lan'], ['c1', 're1'], ['c2', 'lan'], ['c2', 're2'], ['c3', 'lan'], ['c3', 're3'], ['c4', 'lan']].map(link),
      unions: [union('u1', 'lan', 're1', 1), union('u2', 'lan', 're2', 2), union('u3', 'lan', 're3', 3)],
      positions: [],
    });
    expect(Object.fromEntries(coParentCaptions(graph, 'lan'))).toEqual({
      c1: 'với Chồng: re1',
      c2: 'với Chồng hai: re2',
      c3: 'với Chồng ba: re3',
      c4: 'chưa rõ cha',
    });
  });

  it('cha nhiều vợ: không ghi chú gì', () => {
    const graph = buildFamilyGraph({
      persons: [person('cha', 'nam'), person('v1', 'nu'), person('v2', 'nu'), person('a', 'nam'), person('b', 'nu')],
      parentLinks: [['a', 'cha'], ['a', 'v1'], ['b', 'cha'], ['b', 'v2']].map(link),
      unions: [union('u1', 'cha', 'v1', 1), union('u2', 'cha', 'v2', 2)],
      positions: [],
    });
    expect(coParentCaptions(graph, 'cha').size).toBe(0);
  });

  it('chỉ 1 vợ/chồng: không ghi chú gì', () => {
    const graph = buildFamilyGraph({
      persons: [person('cha', 'nam'), person('me', 'nu'), person('a', 'nam'), person('c', 'nu')],
      parentLinks: [['a', 'cha'], ['a', 'me'], ['c', 'cha']].map(link),
      unions: [union('u1', 'cha', 'me', 1)],
      positions: [],
    });
    expect(coParentCaptions(graph, 'cha').size).toBe(0);
  });

  it('nhiều chồng: người kia không có Hôn phối vẫn ghi tên', () => {
    const graph = buildFamilyGraph({
      persons: [person('lan', 'nu'), person('c1', 'nam'), person('c2', 'nam'), person('khac', 'nam'), person('a', 'nam')],
      parentLinks: [['a', 'lan'], ['a', 'khac']].map(link),
      unions: [union('u1', 'lan', 'c1', 1), union('u2', 'lan', 'c2', 2)],
      positions: [],
    });
    expect(Object.fromEntries(coParentCaptions(graph, 'lan'))).toEqual({ a: 'với khac' });
  });
});
