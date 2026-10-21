import { describe, expect, it } from 'vitest';
import { layoutTree, type LayoutNode, type LayoutPerson, type LayoutUnion, type TreeLayout } from './layout.ts';
import { randomFamily } from './random-family.ts';
import { wrapName } from './text.ts';

const overlaps = (a: LayoutNode, b: LayoutNode) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const findOverlap = (layout: TreeLayout) => {
  const sorted = [...layout.nodes].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length && sorted[j]!.x < sorted[i]!.x + sorted[i]!.width; j += 1) {
      if (overlaps(sorted[i]!, sorted[j]!)) return [sorted[i]!.key, sorted[j]!.key];
    }
  }
  return null;
};

const person = (id: string, extra: Partial<LayoutPerson> = {}): LayoutPerson => ({
  id,
  full_name: id,
  gender: 'nam',
  birth_order: null,
  birth_year: null,
  ...extra,
});

/** Gia phả nhỏ, có đủ tình huống: ba vợ, con theo từng vợ, con chưa rõ mẹ, cháu. */
const sample = () => ({
  persons: [
    person('to'),
    person('vo-ca', { gender: 'nu' }),
    person('vo-hai', { gender: 'nu' }),
    person('vo-ba', { gender: 'nu' }),
    person('con-ca-2', { birth_order: 2 }),
    person('con-ca-1', { birth_order: 1 }),
    person('con-hai-1', { birth_order: 1 }),
    person('con-khong-ro', { birth_order: 1 }),
    person('chau', { birth_order: 1 }),
  ],
  parentLinks: [
    { child_id: 'con-ca-1', parent_id: 'to' },
    { child_id: 'con-ca-1', parent_id: 'vo-ca' },
    { child_id: 'con-ca-2', parent_id: 'to' },
    { child_id: 'con-ca-2', parent_id: 'vo-ca' },
    { child_id: 'con-hai-1', parent_id: 'to' },
    { child_id: 'con-hai-1', parent_id: 'vo-hai' },
    { child_id: 'con-khong-ro', parent_id: 'to' },
    { child_id: 'chau', parent_id: 'con-ca-1' },
  ],
  unions: [
    { partner_a: 'to', partner_b: 'vo-ba', order_for_a: 3, order_for_b: 1 },
    { partner_a: 'vo-ca', partner_b: 'to', order_for_a: 1, order_for_b: 1 },
    { partner_a: 'to', partner_b: 'vo-hai', order_for_a: 2, order_for_b: 1 },
  ],
});

/** Một người trong họ có `n` vợ/chồng, mỗi vợ/chồng hai con (con của vợ/chồng cuối có cháu), thêm hai con chưa rõ cha/mẹ còn lại. */
const manySpouses = (n: number, kidsPerSpouse = 2, unknownFather = 2) => {
  const persons = [person('goc', { gender: 'nu' })];
  const parentLinks: { child_id: string; parent_id: string }[] = [];
  const unions: { partner_a: string; partner_b: string; order_for_a: number; order_for_b: number }[] = [];
  for (let k = 1; k <= n; k += 1) {
    persons.push(person(`chong-${k}`));
    unions.push({ partner_a: 'goc', partner_b: `chong-${k}`, order_for_a: k, order_for_b: 1 });
    for (const c of ['a', 'b'].slice(0, kidsPerSpouse)) {
      persons.push(person(`con-${k}${c}`, { birth_order: k * 2 + (c === 'a' ? 0 : 1) }));
      parentLinks.push({ child_id: `con-${k}${c}`, parent_id: 'goc' }, { child_id: `con-${k}${c}`, parent_id: `chong-${k}` });
    }
  }
  for (const c of ['x', 'y'].slice(0, unknownFather)) {
    persons.push(person(`mo-coi-${c}`, { birth_order: 100 }));
    parentLinks.push({ child_id: `mo-coi-${c}`, parent_id: 'goc' });
  }
  persons.push(person('chau'));
  parentLinks.push({ child_id: 'chau', parent_id: `con-${n}a` });
  return { persons, parentLinks, unions, rootId: 'goc' };
};

type Segment = { horizontal: boolean; at: number; from: number; to: number };
/** Các cặp đoạn thẳng cùng nằm trên một đường (ngang cùng y, đứng cùng x) và chung nhau một khoảng dài hơn 0.5. */
const collinearOverlaps = (layout: TreeLayout): string[] => {
  const segments: Segment[] = [];
  for (const line of layout.lines) {
    for (let i = 1; i < line.points.length; i += 1) {
      const [x1, y1] = line.points[i - 1]!;
      const [x2, y2] = line.points[i]!;
      if (x1 === x2 && y1 === y2) continue;
      if (y1 === y2) segments.push({ horizontal: true, at: y1, from: Math.min(x1, x2), to: Math.max(x1, x2) });
      else if (x1 === x2) segments.push({ horizontal: false, at: x1, from: Math.min(y1, y2), to: Math.max(y1, y2) });
    }
  }
  const found: string[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const a = segments[i]!;
      const b = segments[j]!;
      if (a.horizontal === b.horizontal && Math.abs(a.at - b.at) < 0.01 && Math.min(a.to, b.to) - Math.max(a.from, b.from) > 0.5) {
        found.push(`${a.horizontal ? 'ngang' : 'đứng'} ${a.at.toFixed(1)}: ${a.from.toFixed(1)}–${a.to.toFixed(1)} với ${b.from.toFixed(1)}–${b.to.toFixed(1)}`);
      }
    }
  }
  return found;
};

/** Các cặp đoạn cùng hướng, song song và cách nhau dưới `gap` mà cùng chạy qua một khoảng dài hơn 0.5 (nhìn như chồng lên nhau). */
const nearParallel = (layout: TreeLayout, gap: number): string[] => {
  const segments: Segment[] = [];
  for (const line of layout.lines) {
    for (let i = 1; i < line.points.length; i += 1) {
      const [x1, y1] = line.points[i - 1]!;
      const [x2, y2] = line.points[i]!;
      if (y1 === y2 && x1 !== x2) segments.push({ horizontal: true, at: y1, from: Math.min(x1, x2), to: Math.max(x1, x2) });
      else if (x1 === x2 && y1 !== y2) segments.push({ horizontal: false, at: x1, from: Math.min(y1, y2), to: Math.max(y1, y2) });
    }
  }
  const found: string[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const a = segments[i]!;
      const b = segments[j]!;
      if (a.horizontal === b.horizontal && Math.abs(a.at - b.at) < gap && Math.min(a.to, b.to) - Math.max(a.from, b.from) > 0.5) {
        found.push(`${a.horizontal ? 'ngang' : 'đứng'} ${a.at.toFixed(1)}/${b.at.toFixed(1)}: ${a.from.toFixed(1)}–${a.to.toFixed(1)} với ${b.from.toFixed(1)}–${b.to.toFixed(1)}`);
      }
    }
  }
  return found;
};

/** Đoạn đường đi xuyên qua bên trong một ô (chạm cạnh ô thì không tính). */
const linesThroughNodes = (layout: TreeLayout): string[] => {
  const found: string[] = [];
  for (const line of layout.lines) {
    for (let i = 1; i < line.points.length; i += 1) {
      const [x1, y1] = line.points[i - 1]!;
      const [x2, y2] = line.points[i]!;
      for (const n of layout.nodes) {
        const insideX = Math.max(x1, x2) > n.x + 0.5 && Math.min(x1, x2) < n.x + n.width - 0.5;
        const insideY = Math.max(y1, y2) > n.y + 0.5 && Math.min(y1, y2) < n.y + n.height - 0.5;
        if (insideX && insideY) found.push(`${n.key}: (${x1},${y1})→(${x2},${y2})`);
      }
    }
  }
  return found;
};

const node = (layout: TreeLayout, personId: string) => layout.nodes.find((n) => n.personId === personId)!;

describe('seam C: bố cục cây', () => {
  it('không ô nào chồng nhau, kể cả người có ba vợ', () => {
    expect(findOverlap(layoutTree(sample(), { rootId: 'to' }))).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 42, 2026])('không ô nào chồng nhau trên gia phả ngẫu nhiên (hạt %i)', (seed) => {
    const family = randomFamily(seed, 300);
    for (const orientation of ['top-down', 'left-right'] as const) {
      const layout = layoutTree(family, { rootId: family.rootId, orientation });
      expect(findOverlap(layout), orientation).toBeNull();
    }
  });

  it('vợ/chồng đứng liền sau nhau theo Thứ tự hôn phối, cùng hàng', () => {
    const layout = layoutTree(sample(), { rootId: 'to' });
    const row = ['to', 'vo-ca', 'vo-hai', 'vo-ba'].map((id) => node(layout, id));

    expect(new Set(row.map((n) => n.y)).size).toBe(1);
    expect(row.map((n) => n.x)).toEqual(row.map((n) => n.x).sort((a, b) => a - b));
    // Không có ô nào khác chen giữa.
    const between = layout.nodes.filter((n) => n.y === row[0]!.y && n.x > row[0]!.x && n.x < row[3]!.x);
    expect(between.map((n) => n.personId).sort()).toEqual(['vo-ca', 'vo-hai']);
  });

  it('con xếp theo người mẹ (vợ cả trước) rồi theo Thứ tự con; con chưa rõ mẹ xếp cuối', () => {
    const layout = layoutTree(sample(), { rootId: 'to' });
    const children = ['con-ca-1', 'con-ca-2', 'con-hai-1', 'con-khong-ro'].map((id) => node(layout, id).x);
    expect(children).toEqual([...children].sort((a, b) => a - b));
  });

  it('đường xuống con của mỗi vợ/chồng không nằm thẳng hàng với cột nối của vợ/chồng khác (con khỏi bị nhìn nhầm là con của người đứng giữa)', () => {
    const layout = layoutTree(sample(), { rootId: 'to' });
    const spouseDrops = layout.nodes.filter((n) => n.role === 'spouse' && n.depth === 0).map((n) => ({ x: n.x + n.width / 2, bottom: n.y + n.height }));
    expect(spouseDrops).toHaveLength(3);
    const lowestUnionLevel = Math.max(...layout.lines.filter((l) => l.kind === 'union').flatMap((l) => l.points.map(([, y]) => y)));
    for (const line of layout.lines.filter((l) => l.kind === 'descent')) {
      const [x, y] = line.points[0]!;
      // Đường xuống bắt đầu từ cạnh hôn phối (dưới ô, trên mức thấp nhất của các cạnh) không được trùng x với cột nối của một vợ/chồng.
      const startsOnUnionLevel = y > spouseDrops[0]!.bottom && y <= lowestUnionLevel;
      if (startsOnUnionLevel) expect(spouseDrops.map((drop) => drop.x)).not.toContain(x);
    }
  });

  it('không có hai đoạn đường nào nằm chồng lên nhau trên cùng một đường thẳng (nhiều vợ/chồng, con chưa rõ cha/mẹ, cả hai hướng)', () => {
    const families: { persons: LayoutPerson[]; parentLinks: { child_id: string; parent_id: string }[]; unions: LayoutUnion[]; rootId: string }[] = [
      { ...sample(), rootId: 'to' },
      manySpouses(8),
      manySpouses(2),
      manySpouses(3, 1, 1),
      manySpouses(4, 1, 1),
      manySpouses(4, 2, 0),
      manySpouses(5, 1, 1),
      ...Array.from({ length: 40 }, (_, seed) => randomFamily(seed + 1, 60 + seed * 7)),
    ];
    const bad: string[] = [];
    for (const [index, family] of families.entries()) {
      for (const orientation of ['top-down', 'left-right'] as const) {
        const layout = layoutTree(family, { rootId: family.rootId, orientation });
        expect(collinearOverlaps(layout), `gia phả ${index}, ${orientation}`).toEqual([]);
        expect(linesThroughNodes(layout), `gia phả ${index}, ${orientation}`).toEqual([]);
        if (index !== 1 && nearParallel(layout, 5).length > 0) bad.push(`${index}/${orientation}:${nearParallel(layout, 5).length}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('mỗi đời một hàng, đời sau thấp hơn đời trước', () => {
    const layout = layoutTree(sample(), { rootId: 'to' });
    expect(node(layout, 'to').depth).toBe(0);
    expect(node(layout, 'con-ca-1').depth).toBe(1);
    expect(node(layout, 'chau').depth).toBe(2);
    expect(node(layout, 'chau').y).toBeGreaterThan(node(layout, 'con-ca-1').y);
  });

  it('thu gọn một người thì con cháu của họ không được vẽ, và ô đó báo số con bị ẩn', () => {
    const layout = layoutTree(sample(), { rootId: 'to', collapsed: new Set(['con-ca-1']) });
    expect(layout.nodes.some((n) => n.personId === 'chau')).toBe(false);
    expect(node(layout, 'con-ca-1')).toMatchObject({ collapsed: true, hiddenChildren: 1 });
  });

  it('chọn gốc phạm vi và độ sâu thì chỉ vẽ đúng phần đó', () => {
    const family = randomFamily(99, 400);
    const hasChildren = (id: string) => family.parentLinks.some((link) => link.parent_id === id);
    // Một người không phải gốc, có cháu, để phạm vi có ít nhất ba đời.
    const scopeRoot = family.parentLinks.find(
      (link) =>
        link.child_id !== family.rootId &&
        family.parentLinks.some((childLink) => childLink.parent_id === link.child_id && hasChildren(childLink.child_id)),
    )!.child_id;
    const layout = layoutTree(family, { rootId: scopeRoot, maxDepth: 2 });

    expect(layout.nodes.every((n) => n.depth <= 2)).toBe(true);
    expect(layout.nodes.some((n) => n.personId === family.rootId)).toBe(false);
    // Mọi ô huyết thống đều là hậu duệ của gốc phạm vi.
    const descendants = new Set([scopeRoot]);
    let frontier = [scopeRoot];
    while (frontier.length > 0) {
      frontier = family.parentLinks.filter((l) => frontier.includes(l.parent_id)).map((l) => l.child_id);
      frontier.forEach((id) => descendants.add(id));
    }
    expect(layout.nodes.filter((n) => n.role === 'blood').every((n) => descendants.has(n.personId))).toBe(true);
  });

  it('mỗi người huyết thống chỉ xuất hiện một lần', () => {
    const family = randomFamily(11, 500);
    const blood = layoutTree(family, { rootId: family.rootId }).nodes.filter((n) => n.role === 'blood');
    expect(new Set(blood.map((n) => n.personId)).size).toBe(blood.length);
  });

  it('vẽ 800 người trong thời gian ngắn', () => {
    const family = randomFamily(99, 800);
    const started = Date.now();
    const layout = layoutTree(family, { rootId: family.rootId });
    expect(Date.now() - started).toBeLessThan(250);
    expect(layout.nodes.length).toBeGreaterThan(700);
  });

  it('gốc không tồn tại thì trả về bố cục rỗng', () => {
    expect(layoutTree(sample(), { rootId: 'khong-co' })).toEqual({ nodes: [], lines: [], width: 0, height: 0 });
  });

  it('đường nối nằm trong khung bố cục', () => {
    const layout = layoutTree(sample(), { rootId: 'to' });
    for (const line of layout.lines) {
      for (const [x, y] of line.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(layout.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(layout.height);
      }
    }
  });
});

describe('wrapName', () => {
  it('ngắt theo từ, tối đa hai dòng', () => {
    expect(wrapName('Phạm Văn Tổ', 12)).toEqual(['Phạm Văn Tổ']);
    expect(wrapName('Nguyễn Hữu Phước Lộc', 12)).toEqual(['Nguyễn Hữu', 'Phước Lộc']);
  });

  it('cắt và thêm dấu … khi quá dài', () => {
    expect(wrapName('Tôn Nữ Thị Hoàng Bảo Ngọc Diệp', 10)).toEqual(['Tôn Nữ Thị', 'Hoàng Bảo…']);
    expect(wrapName('Abcdefghijklmnop', 8, 1)).toEqual(['Abcdefg…']);
  });
});

describe('thứ tự anh chị em cùng năm sinh', () => {
  it('xếp theo tháng rồi ngày sinh, giống danh sách các Đời', () => {
    const persons = [
      person('cha'),
      person('c', { birth_year: 1990, birth_month: 5, birth_day: 2 }),
      person('a', { birth_year: 1990, birth_month: 2, birth_day: 20 }),
      person('b', { birth_year: 1990, birth_month: 2, birth_day: 25 }),
    ];
    const parentLinks = ['a', 'b', 'c'].map((child_id) => ({ child_id, parent_id: 'cha' }));
    const layout = layoutTree({ persons, parentLinks, unions: [] }, { rootId: 'cha' });
    const order = layout.nodes.filter((node) => node.depth === 1).sort((x, y) => x.x - y.x).map((node) => node.personId);
    expect(order).toEqual(['a', 'b', 'c']);
  });
});
