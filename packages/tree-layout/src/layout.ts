/**
 * Bố cục cây gia phả.
 *
 * Mỗi "đơn vị" gồm một người trong họ (theo huyết thống từ gốc) và các vợ/chồng của người đó,
 * xếp liền nhau theo Thứ tự hôn phối. Các con được nhóm theo người mẹ/cha còn lại (vợ cả trước),
 * trong nhóm xếp theo Thứ tự con. Mỗi cây con chiếm một dải riêng trên trục ngang nên các ô
 * không bao giờ chồng nhau; đơn vị cha mẹ được đặt giữa dải của các con.
 *
 * Toạ độ được tính trên hai trục trừu tượng (bề ngang `b` và chiều sâu `d`) rồi mới đổi sang
 * x/y theo hướng vẽ, nên hướng trên→dưới và trái→phải dùng chung một thuật toán.
 */

export type LayoutPerson = {
  id: string;
  full_name: string;
  gender: string | null;
  birth_order: number | null;
  birth_year: number | null;
};

export type LayoutParentLink = { child_id: string; parent_id: string };

export type LayoutUnion = { partner_a: string; partner_b: string; order_for_a: number; order_for_b: number };

export type Orientation = 'top-down' | 'left-right';

export type ChildFilter = (child: LayoutPerson, parent: LayoutPerson, childDepth: number) => boolean;

export type LayoutOptions = {
  /** Người ở gốc cây (Thuỷ tổ, hoặc người bắt đầu phạm vi in). */
  rootId: string;
  /** Những người đang thu gọn: con cháu của họ không được vẽ. */
  collapsed?: ReadonlySet<string>;
  /** Số đời dưới gốc được vẽ (0 = chỉ gốc). Mặc định không giới hạn. */
  maxDepth?: number;
  orientation?: Orientation;
  /** Lọc con được vẽ (ví dụ chỉ đinh, hoặc Cháu ngoại N đời). */
  includeChild?: ChildFilter;
  box?: { width: number; height: number };
  gaps?: Partial<Gaps>;
};

type Gaps = {
  /** Khoảng giữa vợ/chồng trong một đơn vị. */
  spouse: number;
  /** Khoảng giữa anh chị em không có con được vẽ. */
  sibling: number;
  /** Khoảng giữa các nhánh có con cháu. */
  branch: number;
  /** Khoảng giữa hai đời. */
  generation: number;
};

export type LayoutNode = {
  key: string;
  personId: string;
  role: 'blood' | 'spouse';
  /** Số đời tính từ gốc (gốc = 0). */
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Số con không được vẽ vì đang thu gọn hoặc vượt độ sâu (chỉ ở ô huyết thống). */
  hiddenChildren: number;
  /** Số con qua bộ lọc hiển thị (đang vẽ hoặc đang ẩn vì thu gọn), để biết có nút thu/mở hay không. */
  childCount: number;
  collapsed: boolean;
};

export type LayoutLine = { kind: 'union' | 'descent'; points: [number, number][] };

export type TreeLayout = { nodes: LayoutNode[]; lines: LayoutLine[]; width: number; height: number };

export const DEFAULT_BOX = { width: 168, height: 72 };
const DEFAULT_GAPS: Gaps = { spouse: 16, sibling: 20, branch: 36, generation: 88 };
const UNION_DROP = 12;
const UNION_STEP = 8;

type Unit = {
  person: LayoutPerson;
  spouses: LayoutPerson[];
  groups: { spouseIndex: number | null; children: Unit[] }[];
  depth: number;
  hiddenChildren: number;
  childCount: number;
  collapsed: boolean;
  unitBreadth: number;
  subtreeBreadth: number;
};

const byName = new Intl.Collator('vi').compare;

const compareSiblings = (a: LayoutPerson, b: LayoutPerson): number =>
  (a.birth_order ?? Number.MAX_SAFE_INTEGER) - (b.birth_order ?? Number.MAX_SAFE_INTEGER) ||
  (a.birth_year ?? Number.MAX_SAFE_INTEGER) - (b.birth_year ?? Number.MAX_SAFE_INTEGER) ||
  byName(a.full_name, b.full_name);

const pushTo = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export const layoutTree = (
  data: { persons: LayoutPerson[]; parentLinks: LayoutParentLink[]; unions: LayoutUnion[] },
  options: LayoutOptions,
): TreeLayout => {
  const orientation = options.orientation ?? 'top-down';
  const box = options.box ?? DEFAULT_BOX;
  const gaps: Gaps = { ...DEFAULT_GAPS, ...options.gaps };
  // Kích thước một ô theo hai trục trừu tượng.
  const breadth = orientation === 'top-down' ? box.width : box.height;
  const depthSize = orientation === 'top-down' ? box.height : box.width;
  const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY;
  const collapsed = options.collapsed ?? new Set<string>();

  const persons = new Map(data.persons.map((person) => [person.id, person]));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  for (const link of data.parentLinks) {
    pushTo(childrenOf, link.parent_id, link.child_id);
    pushTo(parentsOf, link.child_id, link.parent_id);
  }
  const spousesOf = new Map<string, { id: string; order: number }[]>();
  for (const union of data.unions) {
    pushTo(spousesOf, union.partner_a, { id: union.partner_b, order: union.order_for_a });
    pushTo(spousesOf, union.partner_b, { id: union.partner_a, order: union.order_for_b });
  }

  const root = persons.get(options.rootId);
  if (!root) return { nodes: [], lines: [], width: 0, height: 0 };

  // ---- Dựng cây đơn vị ----
  const visited = new Set<string>();

  const buildUnit = (person: LayoutPerson, depth: number): Unit => {
    visited.add(person.id);
    const spouses = (spousesOf.get(person.id) ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .flatMap(({ id }) => {
        const spouse = persons.get(id);
        return spouse ? [spouse] : [];
      });
    const spouseIndex = new Map(spouses.map((spouse, index) => [spouse.id, index]));

    const children = (childrenOf.get(person.id) ?? []).flatMap((childId) => {
      const child = persons.get(childId);
      if (!child || visited.has(childId)) return [];
      if (options.includeChild && !options.includeChild(child, person, depth + 1)) return [];
      return [child];
    });

    const isCollapsed = collapsed.has(person.id);
    const unitBreadth = (1 + spouses.length) * breadth + spouses.length * gaps.spouse;
    if (children.length === 0 || isCollapsed || depth >= maxDepth) {
      return {
        person,
        spouses,
        groups: [],
        depth,
        hiddenChildren: children.length,
        childCount: children.length,
        collapsed: isCollapsed && children.length > 0,
        unitBreadth,
        subtreeBreadth: unitBreadth,
      };
    }

    // Nhóm con theo người cha/mẹ còn lại; con chưa rõ cha/mẹ còn lại xếp sau cùng.
    const groupKey = (child: LayoutPerson): number | null => {
      const other = (parentsOf.get(child.id) ?? []).find((parentId) => spouseIndex.has(parentId));
      return other === undefined ? null : spouseIndex.get(other)!;
    };
    const grouped = new Map<number | null, LayoutPerson[]>();
    for (const child of children) pushTo(grouped, groupKey(child), child);
    const orderedKeys = [...grouped.keys()].sort((a, b) => (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER));

    // Đánh dấu mọi con trước khi đệ quy để không ai bị vẽ lại trong nhánh khác.
    for (const child of children) visited.add(child.id);
    const groups = orderedKeys.map((key) => ({
      spouseIndex: key,
      children: grouped
        .get(key)!
        .sort(compareSiblings)
        .map((child) => buildUnit(child, depth + 1)),
    }));

    const childUnits = groups.flatMap((group) => group.children);
    const childrenBreadth = childUnits.reduce(
      (total, unit, index) => total + unit.subtreeBreadth + (index === 0 ? 0 : gapBetween(childUnits[index - 1]!, unit)),
      0,
    );
    return {
      person,
      spouses,
      groups,
      depth,
      hiddenChildren: 0,
      childCount: children.length,
      collapsed: false,
      unitBreadth,
      subtreeBreadth: Math.max(unitBreadth, childrenBreadth),
    };
  };

  const hasDrawnChildren = (unit: Unit) => unit.groups.length > 0;
  const gapBetween = (a: Unit, b: Unit) => (hasDrawnChildren(a) || hasDrawnChildren(b) ? gaps.branch : gaps.sibling);

  const rootUnit = buildUnit(root, 0);

  // ---- Đặt toạ độ ----
  const nodes: LayoutNode[] = [];
  const lines: LayoutLine[] = [];
  const levelStart = (depth: number) => depth * (depthSize + gaps.generation);

  const toXY = ([b, d]: [number, number]): [number, number] => (orientation === 'top-down' ? [b, d] : [d, b]);

  const addNode = (person: LayoutPerson, role: LayoutNode['role'], unit: Unit, b: number, key: string) => {
    const [x, y] = toXY([b, levelStart(unit.depth)]);
    nodes.push({
      key,
      personId: person.id,
      role,
      depth: unit.depth,
      x,
      y,
      width: box.width,
      height: box.height,
      hiddenChildren: role === 'blood' ? unit.hiddenChildren : 0,
      childCount: role === 'blood' ? unit.childCount : 0,
      collapsed: role === 'blood' ? unit.collapsed : false,
    });
  };

  const place = (unit: Unit, left: number) => {
    const childUnits = unit.groups.flatMap((group) => group.children);
    const childrenBreadth = childUnits.reduce(
      (total, child, index) => total + child.subtreeBreadth + (index === 0 ? 0 : gapBetween(childUnits[index - 1]!, child)),
      0,
    );

    // Đơn vị cha mẹ nằm giữa dải của các con; các con nằm giữa dải của cả cây con.
    const unitLeft = left + (unit.subtreeBreadth - unit.unitBreadth) / 2;
    addNode(unit.person, 'blood', unit, unitLeft, `p:${unit.person.id}`);
    unit.spouses.forEach((spouse, index) => {
      addNode(spouse, 'spouse', unit, unitLeft + (index + 1) * (breadth + gaps.spouse), `s:${unit.person.id}:${spouse.id}`);
    });

    const unitBottom = levelStart(unit.depth) + depthSize;
    const bloodCenter = unitLeft + breadth / 2;
    const spouseCenter = (index: number) => unitLeft + (index + 1) * (breadth + gaps.spouse) + breadth / 2;

    // Đường hôn phối: chữ U dưới cặp vợ chồng, mỗi vợ/chồng một tầng để không chồng lên nhau.
    unit.spouses.forEach((_, index) => {
      const level = unitBottom + UNION_DROP + index * UNION_STEP;
      lines.push({
        kind: 'union',
        points: [
          toXY([bloodCenter, unitBottom]),
          toXY([bloodCenter, level]),
          toXY([spouseCenter(index), level]),
          toXY([spouseCenter(index), unitBottom]),
        ],
      });
    });

    let cursor = left + (unit.subtreeBreadth - childrenBreadth) / 2;
    const childLevel = levelStart(unit.depth + 1);
    unit.groups.forEach((group, groupIndex) => {
      const childCenters: number[] = [];
      group.children.forEach((child, index) => {
        const previous = index === 0 ? undefined : group.children[index - 1];
        if (previous) cursor += gapBetween(previous, child);
        else if (groupIndex > 0) cursor += gapBetween(unit.groups[groupIndex - 1]!.children.at(-1)!, child);
        place(child, cursor);
        childCenters.push(cursor + (child.subtreeBreadth - child.unitBreadth) / 2 + breadth / 2);
        cursor += child.subtreeBreadth;
      });

      const [originB, originD] =
        group.spouseIndex === null
          ? [bloodCenter, unitBottom]
          : [(bloodCenter + spouseCenter(group.spouseIndex)) / 2, unitBottom + UNION_DROP + group.spouseIndex * UNION_STEP];
      const bus = childLevel - gaps.generation / 2 + groupIndex * UNION_STEP;
      const busFrom = Math.min(originB, ...childCenters);
      const busTo = Math.max(originB, ...childCenters);
      lines.push({ kind: 'descent', points: [toXY([originB, originD]), toXY([originB, bus])] });
      if (busTo > busFrom) lines.push({ kind: 'descent', points: [toXY([busFrom, bus]), toXY([busTo, bus])] });
      for (const center of childCenters) {
        lines.push({ kind: 'descent', points: [toXY([center, bus]), toXY([center, childLevel])] });
      }
    });
  };

  place(rootUnit, 0);

  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  return { nodes, lines, width: right, height: bottom };
};
