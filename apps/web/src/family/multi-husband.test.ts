import { describe, expect, it } from 'vitest';
import { layoutTree, marriageExtraLines } from '@gia-pha/tree-layout';
import { marriageNote } from './labels';
import { buildFamilyGraph, type GraphPerson } from './family-graph';
import { describeRelation } from './kinship';

const person = (id: string, gender: string, extra: Partial<GraphPerson> = {}): GraphPerson => ({
  id, full_name: id, gender, birth_year: null, birth_order: null, ...extra,
});

/** Con gái `lan` (con của `cha` + `me`) có ba đời chồng; mỗi đời chồng một con, thêm một con chưa rõ cha. */
const family = () => {
  const persons = [
    person('cha', 'nam'), person('me', 'nu'), person('lan', 'nu', { birth_year: 1950 }),
    person('re1', 'nam'), person('re2', 'nam'), person('re3', 'nam'),
    person('c1', 'nam', { birth_year: 1970, birth_order: 1 }),
    person('c2', 'nu', { birth_year: 1975, birth_order: 2 }),
    person('c3', 'nam', { birth_year: 1980, birth_order: 3 }),
    person('c4', 'nu', { birth_year: 1985, birth_order: 4 }),
  ];
  const parentLinks = [
    ['lan', 'cha'], ['lan', 'me'],
    ['c1', 'lan'], ['c1', 're1'], ['c2', 'lan'], ['c2', 're2'], ['c3', 'lan'], ['c3', 're3'], ['c4', 'lan'],
  ].map(([child_id, parent_id]) => ({ child_id: child_id!, parent_id: parent_id!, kind: 'ruot' }));
  const unions = [
    { id: 'u0', partner_a: 'cha', partner_b: 'me', order_for_a: 1, order_for_b: 1, status: 'con' },
    { id: 'u1', partner_a: 'lan', partner_b: 're1', order_for_a: 1, order_for_b: 1, status: 'ly_hon' },
    { id: 'u2', partner_a: 'lan', partner_b: 're2', order_for_a: 2, order_for_b: 1, status: 'goa' },
    { id: 'u3', partner_a: 'lan', partner_b: 're3', order_for_a: 3, order_for_b: 1, status: 'con' },
  ];
  return { persons, parentLinks, unions };
};

describe('con gái có ba đời chồng', () => {
  const data = family();
  const graph = buildFamilyGraph({ ...data, positions: [] });

  it('mỗi con ghi đúng cha riêng; con chưa rõ cha chỉ có mẹ', () => {
    const parents = (id: string) => graph.parentsOf(id).map((p) => p.person.id).sort();
    expect(parents('c1')).toEqual(['lan', 're1']);
    expect(parents('c2')).toEqual(['lan', 're2']);
    expect(parents('c3')).toEqual(['lan', 're3']);
    expect(parents('c4')).toEqual(['lan']);
  });

  it('ba đời chồng theo thứ tự hôn phối', () => {
    expect(graph.spousesOf('lan').map((s) => [s.person.id, s.order])).toEqual([['re1', 1], ['re2', 2], ['re3', 3]]);
  });

  it('Cây: con xếp dưới đúng đời chồng, con chưa rõ cha xếp cuối', () => {
    const layout = layoutTree({ persons: data.persons, parentLinks: data.parentLinks, unions: data.unions }, { rootId: 'cha' });
    const x = (id: string) => layout.nodes.find((n) => n.personId === id)!.x;
    expect([x('c1'), x('c2'), x('c3'), x('c4')]).toEqual([...[x('c1'), x('c2'), x('c3'), x('c4')]].sort((a, b) => a - b));
    // Mỗi đời chồng đứng đúng một ô, liền nhau sau Lan.
    expect([x('re1'), x('re2'), x('re3')]).toEqual([...[x('re1'), x('re2'), x('re3')]].sort((a, b) => a - b));
  });

  it('ô chồng ghi thứ tự và tình trạng hôn phối theo góc nhìn của Lan', () => {
    const layout = layoutTree({ persons: data.persons, parentLinks: data.parentLinks, unions: data.unions }, { rootId: 'cha' });
    const notes = ['re1', 're2', 're3'].map((id) => {
      const node = layout.nodes.find((n) => n.personId === id)!;
      return marriageNote(node.marriage!, 'nam', () => undefined)?.label;
    });
    expect(notes).toEqual(['Chồng · ly hôn', 'Chồng hai · goá', 'Chồng ba · sống chung']);
    expect(marriageExtraLines(data)).toBe(1);
  });

  it('cây một vợ một chồng còn chung sống: không ghi nhãn', () => {
    const layout = layoutTree({ persons: data.persons, parentLinks: data.parentLinks, unions: data.unions }, { rootId: 'cha' });
    const me = layout.nodes.find((n) => n.personId === 'me')!;
    expect(marriageNote(me.marriage!, 'nu', () => undefined)).toBeNull();
    expect(marriageExtraLines({ parentLinks: data.parentLinks, unions: [data.unions[0]!] })).toBe(0);
  });

  it('rể lấy hai chị em trong họ: mỗi ô ghi người kia, chừa thêm dòng', () => {
    const persons = [person('to', 'nam'), person('a', 'nu'), person('b', 'nu'), person('re', 'nam')];
    const parentLinks = ['a', 'b'].map((child_id) => ({ child_id, parent_id: 'to', kind: 'ruot' }));
    const unions = [
      { id: 'u1', partner_a: 'a', partner_b: 're', order_for_a: 1, order_for_b: 1, status: 'con' },
      { id: 'u2', partner_a: 'b', partner_b: 're', order_for_a: 1, order_for_b: 2, status: 'con' },
    ];
    const layout = layoutTree({ persons, parentLinks, unions }, { rootId: 'to' });
    const copies = layout.nodes.filter((n) => n.personId === 're');
    expect(copies.map((n) => n.key).sort()).toEqual(['s:a:re', 's:b:re']);
    const nameOf = (id: string) => `Chị ${id}`;
    expect(copies.map((n) => marriageNote(n.marriage!, 'nam', nameOf)!.also).sort()).toEqual(['cũng là chồng của Chị a', 'cũng là chồng của Chị b']);
    expect(marriageExtraLines({ parentLinks, unions })).toBe(2);
  });

  it('con khác cha cùng mẹ gọi nhau là anh/em cùng mẹ khác cha', () => {
    expect(describeRelation(graph, 'c2', 'c1')?.term).toBe('Anh (cùng mẹ khác cha)');
  });
});
