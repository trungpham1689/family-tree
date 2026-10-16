import { describe, expect, it } from 'vitest';
import { outsideGenerationsFilter } from './descent-filter.ts';
import { layoutTree, type LayoutNode, type LayoutPerson, type TreeLayout } from './layout.ts';
import { randomFamily } from './random-family.ts';

const person = (id: string, gender: string): LayoutPerson => ({ id, full_name: id, gender, birth_order: null, birth_year: null });

/**
 * to ─┬─ trai ── chau-noi (nam) ── chat-noi
 *     └─ gai ─┬─ chau-ngoai (nu) ── chat-ngoai
 *             └─ (chồng: re, ngoài họ)
 */
const family = () => ({
  persons: [
    person('to', 'nam'),
    person('trai', 'nam'),
    person('gai', 'nu'),
    person('re', 'nam'),
    person('chau-noi', 'nam'),
    person('chat-noi', 'nu'),
    person('chau-ngoai', 'nu'),
    person('chat-ngoai', 'nam'),
  ],
  parentLinks: [
    { child_id: 'trai', parent_id: 'to' },
    { child_id: 'gai', parent_id: 'to' },
    { child_id: 'chau-noi', parent_id: 'trai' },
    { child_id: 'chat-noi', parent_id: 'chau-noi' },
    { child_id: 'chau-ngoai', parent_id: 'gai' },
    { child_id: 'chau-ngoai', parent_id: 're' },
    { child_id: 'chat-ngoai', parent_id: 'chau-ngoai' },
  ],
  unions: [{ partner_a: 'gai', partner_b: 're', order_for_a: 1, order_for_b: 1 }],
});

const ids = (layout: TreeLayout) => layout.nodes.map((node) => node.personId).sort();
const shown = (maxOutside: number) =>
  ids(layoutTree(family(), { rootId: 'to', includeChild: outsideGenerationsFilter(maxOutside) }));

const overlaps = (a: LayoutNode, b: LayoutNode) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('seam C: lọc Cháu ngoại', () => {
  it('chỉ đinh: con gái vẫn hiện, con của con gái thì không', () => {
    expect(shown(0)).toEqual(['chat-noi', 'chau-noi', 'gai', 're', 'to', 'trai']);
  });

  it('Cháu ngoại 1 đời: hiện con của con gái, không hiện cháu của con gái', () => {
    expect(shown(1)).toContain('chau-ngoai');
    expect(shown(1)).not.toContain('chat-ngoai');
  });

  it('Cháu ngoại 2 đời: hiện thêm một đời nữa', () => {
    expect(shown(2)).toContain('chat-ngoai');
  });

  it('dòng đinh không bị ảnh hưởng bởi N', () => {
    for (const n of [0, 1, 2]) expect(shown(n)).toEqual(expect.arrayContaining(['chau-noi', 'chat-noi']));
  });

  it('nút thu/mở chỉ đếm con qua bộ lọc', () => {
    const layout = layoutTree(family(), { rootId: 'to', includeChild: outsideGenerationsFilter(0) });
    expect(layout.nodes.find((node) => node.personId === 'gai')!.childCount).toBe(0);
    expect(layout.nodes.find((node) => node.personId === 'trai')!.childCount).toBe(1);
  });

  it.each([0, 1, 3])('không ô nào chồng nhau ở hướng trái→phải với N = %i', (n) => {
    const random = randomFamily(7, 400);
    const layout = layoutTree(random, {
      rootId: random.rootId,
      orientation: 'left-right',
      includeChild: outsideGenerationsFilter(n),
    });
    for (let i = 0; i < layout.nodes.length; i += 1) {
      for (let j = i + 1; j < layout.nodes.length; j += 1) {
        expect(overlaps(layout.nodes[i]!, layout.nodes[j]!)).toBe(false);
      }
    }
  });

  it('N lớn hơn thì không bao giờ ít người hơn', () => {
    const random = randomFamily(11, 400);
    const counts = [0, 1, 2, 3].map(
      (n) => layoutTree(random, { rootId: random.rootId, includeChild: outsideGenerationsFilter(n) }).nodes.length,
    );
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts[0]).toBeLessThan(counts[3]!);
  });
});
