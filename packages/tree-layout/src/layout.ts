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
  /** Không bắt buộc (bản công khai không gửi); có thì dùng để xếp anh chị em cùng năm sinh. */
  birth_month?: number | null;
  birth_day?: number | null;
};

export type LayoutParentLink = { child_id: string; parent_id: string };

export type LayoutUnion = { partner_a: string; partner_b: string; order_for_a: number; order_for_b: number; status?: string };

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
  /** Chỉ ở ô Dâu/Rể: cuộc hôn phối với người trong họ đứng cạnh ô này. */
  marriage?: NodeMarriage | undefined;
};

export type NodeMarriage = {
  /** Thứ tự hôn phối theo góc nhìn của người trong họ (1 = đầu tiên). */
  order: number;
  status: string;
  /** Số vợ/chồng của người trong họ. */
  spouseCount: number;
  /** Những người trong họ khác (có ô huyết thống trong cây) mà Dâu/Rể này cũng là vợ/chồng; ví dụ rể lấy hai chị em. */
  alsoSpouseOf: string[];
};

export type LayoutLine = { kind: 'union' | 'descent'; points: [number, number][] };

export type TreeLayout = { nodes: LayoutNode[]; lines: LayoutLine[]; width: number; height: number };

export const DEFAULT_BOX = { width: 168, height: 72 };
const DEFAULT_GAPS: Gaps = { spouse: 16, sibling: 20, branch: 36, generation: 88 };
const UNION_DROP = 12;
const UNION_STEP = 8;

type Spouse = { person: LayoutPerson; order: number; status: string };

type Unit = {
  person: LayoutPerson;
  spouses: Spouse[];
  groups: { spouseIndex: number | null; children: Unit[] }[];
  depth: number;
  hiddenChildren: number;
  childCount: number;
  collapsed: boolean;
  unitBreadth: number;
  subtreeBreadth: number;
};

const byName = new Intl.Collator('vi').compare;

const LAST = Number.MAX_SAFE_INTEGER;

/** Cùng thứ tự với `compareSiblings` của family-graph (Thứ tự con, rồi năm-tháng-ngày sinh, rồi tên) để Cây khớp danh sách các Đời. */
const compareSiblings = (a: LayoutPerson, b: LayoutPerson): number =>
  (a.birth_order ?? LAST) - (b.birth_order ?? LAST) ||
  (a.birth_year ?? LAST) - (b.birth_year ?? LAST) ||
  (a.birth_month ?? LAST) - (b.birth_month ?? LAST) ||
  (a.birth_day ?? LAST) - (b.birth_day ?? LAST) ||
  byName(a.full_name, b.full_name);

const pushTo = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

/** Số nhóm con tối đa được thử mọi thứ tự tầng thanh ngang (n! phương án). */
const MAX_ORDERED_GROUPS = 6;
/** Hai đường đứng gần hơn mức này (đơn vị bố cục) mà cùng chạy qua một khoảng độ cao thì nhìn như chồng lên nhau. */
const MIN_PARALLEL_GAP = 5;

const permutations = (items: number[]): number[][] => {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
};

type Seg = [number, number, number, number];

/** Chi phí của một cách đi dây: đoạn đứng sát nhau nặng gấp nghìn lần một chỗ cắt nhau. */
const routeCost = (segments: readonly Seg[]): number => {
  const verticals = segments.filter(([x1, , x2]) => x1 === x2);
  const horizontals = segments.filter(([, y1, , y2]) => y1 === y2);
  let close = 0;
  for (let i = 0; i < verticals.length; i += 1) {
    for (let j = i + 1; j < verticals.length; j += 1) {
      const [x1, a1, , b1] = verticals[i]!;
      const [x2, a2, , b2] = verticals[j]!;
      const overlap = Math.min(Math.max(a1, b1), Math.max(a2, b2)) - Math.max(Math.min(a1, b1), Math.min(a2, b2));
      if (Math.abs(x1 - x2) < MIN_PARALLEL_GAP && overlap > 0.5) close += 1;
    }
  }
  let crossings = 0;
  for (const [x, ya, , yb] of verticals) {
    for (const [xa, y, xb] of horizontals) {
      if (x > Math.min(xa, xb) && x < Math.max(xa, xb) && y > Math.min(ya, yb) && y < Math.max(ya, yb)) crossings += 1;
    }
  }
  return close * 1000 + crossings;
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
  const spousesOf = new Map<string, { id: string; order: number; status: string }[]>();
  for (const union of data.unions) {
    const status = union.status ?? 'con';
    pushTo(spousesOf, union.partner_a, { id: union.partner_b, order: union.order_for_a, status });
    pushTo(spousesOf, union.partner_b, { id: union.partner_a, order: union.order_for_b, status });
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
      .flatMap(({ id, order, status }) => {
        const spouse = persons.get(id);
        return spouse ? [{ person: spouse, order, status }] : [];
      });
    const spouseIndex = new Map(spouses.map((spouse, index) => [spouse.person.id, index]));

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

  const partnerOf = new Map<string, string>();

  const addNode = (person: LayoutPerson, role: LayoutNode['role'], unit: Unit, b: number, key: string, spouse?: Spouse) => {
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
      ...(spouse ? { marriage: { order: spouse.order, status: spouse.status, spouseCount: unit.spouses.length, alsoSpouseOf: [] } } : {}),
    });
    if (spouse) partnerOf.set(key, unit.person.id);
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
      addNode(spouse.person, 'spouse', unit, unitLeft + (index + 1) * (breadth + gaps.spouse), `s:${unit.person.id}:${spouse.person.id}`, spouse);
    });

    const unitBottom = levelStart(unit.depth) + depthSize;
    const spouseCenter = (index: number) => unitLeft + (index + 1) * (breadth + gaps.spouse) + breadth / 2;

    // Mỗi cuộc hôn phối một chữ U riêng, mỗi chữ U bắt đầu từ một điểm riêng dưới ô người trong họ (không dùng chung điểm giữa ô) nên các đường
    // không bao giờ chồng lên nhau. Từ trái sang phải dưới ô: nhóm con chưa rõ cha/mẹ còn lại, rồi vợ/chồng cuối … vợ/chồng đầu; chữ U của
    // vợ/chồng đầu nông nhất, ôm gọn trong chữ U của vợ/chồng sau nên cột nối của chữ U sau không cắt ngang chữ U trước.
    const hasUnknown = unit.groups.some((group) => group.spouseIndex === null);
    const slots = unit.spouses.length + (hasUnknown ? 1 : 0);
    const unknownOffset = hasUnknown ? 1 : 0;
    // Một cuộc hôn phối duy nhất: giữa ô như thường. Nhiều hơn: dàn đều từ 30% đến 90% bề ngang ô, chừa góc trái dưới cho nút thu gọn.
    const attachAt = (slot: number) => unitLeft + breadth * (slots === 1 ? 0.5 : 0.3 + (0.6 * slot) / (slots - 1));
    const spouseAttach = (index: number) => attachAt(unknownOffset + unit.spouses.length - 1 - index);
    const unionStep = Math.min(UNION_STEP, Math.max(2, (gaps.generation / 2 - UNION_DROP - 4) / Math.max(1, unit.spouses.length)));
    const unionLevel = (index: number) => unitBottom + UNION_DROP + index * unionStep;

    unit.spouses.forEach((_, index) => {
      lines.push({
        kind: 'union',
        points: [
          toXY([spouseAttach(index), unitBottom]),
          toXY([spouseAttach(index), unionLevel(index)]),
          toXY([spouseCenter(index), unionLevel(index)]),
          toXY([spouseCenter(index), unitBottom]),
        ],
      });
    });

    let cursor = left + (unit.subtreeBreadth - childrenBreadth) / 2;
    const childLevel = levelStart(unit.depth + 1);
    const busStep = Math.min(UNION_STEP, Math.max(2, (gaps.generation / 2 - 4) / Math.max(1, unit.groups.length)));

    type GroupGeometry = { originB: number; originD: number; childCenters: number[] };
    const geometry: GroupGeometry[] = unit.groups.map((group, groupIndex) => {
      const childCenters: number[] = [];
      group.children.forEach((child, index) => {
        const previous = index === 0 ? undefined : group.children[index - 1];
        if (previous) cursor += gapBetween(previous, child);
        else if (groupIndex > 0) cursor += gapBetween(unit.groups[groupIndex - 1]!.children.at(-1)!, child);
        place(child, cursor);
        childCenters.push(cursor + (child.subtreeBreadth - child.unitBreadth) / 2 + breadth / 2);
        cursor += child.subtreeBreadth;
      });
      // Đường xuống của một vợ/chồng bắt đầu trên chữ U của người đó, ở khoảng trống ngay trước ô vợ/chồng (không phải trung điểm: với vợ/chồng thứ hai,
      // trung điểm trùng đúng cột nối của vợ/chồng thứ nhất nên con trông như con của người đó). Con chưa rõ cha/mẹ còn lại đi thẳng xuống từ điểm riêng dưới ô.
      const [originB, originD] =
        group.spouseIndex === null
          ? [attachAt(0), unitBottom]
          : [spouseCenter(group.spouseIndex) - (breadth + gaps.spouse) / 2, unionLevel(group.spouseIndex)];
      return { originB, originD, childCenters };
    });

    // Mỗi nhóm con một tầng thanh ngang riêng; thứ tự các tầng chọn sao cho ít đoạn đứng sát nhau nhất rồi ít cắt nhau nhất.
    const segmentsFor = (rank: number[]) => {
      const out: [number, number, number, number][] = [];
      geometry.forEach(({ originB, originD, childCenters }, index) => {
        const bus = childLevel - gaps.generation / 2 + rank[index]! * busStep;
        const busFrom = Math.min(originB, ...childCenters);
        const busTo = Math.max(originB, ...childCenters);
        out.push([originB, originD, originB, bus]);
        if (busTo > busFrom) out.push([busFrom, bus, busTo, bus]);
        for (const center of childCenters) out.push([center, bus, center, childLevel]);
      });
      return out;
    };
    let rank = geometry.map((_, index) => index);
    if (geometry.length > 1 && geometry.length <= MAX_ORDERED_GROUPS) {
      let bestCost = Number.POSITIVE_INFINITY;
      for (const candidate of permutations(rank)) {
        const cost = routeCost(segmentsFor(candidate));
        if (cost < bestCost) {
          bestCost = cost;
          rank = candidate;
        }
      }
    }
    segmentsFor(rank).forEach(([x1, y1, x2, y2]) => lines.push({ kind: 'descent', points: [toXY([x1, y1]), toXY([x2, y2])] }));
  };

  place(rootUnit, 0);

  // Dâu/Rể xuất hiện ở nhiều đơn vị (rể lấy hai chị em trong họ): mỗi ô ghi tên những người trong họ còn lại.
  const spouseNodes = new Map<string, LayoutNode[]>();
  for (const node of nodes) if (node.role === 'spouse') pushTo(spouseNodes, node.personId, node);
  for (const copies of spouseNodes.values()) {
    if (copies.length < 2) continue;
    for (const node of copies) {
      node.marriage!.alsoSpouseOf = copies.filter((copy) => copy !== node).map((copy) => partnerOf.get(copy.key)!);
    }
  }

  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));
  return { nodes, lines, width: right, height: bottom };
};

/**
 * Số dòng nhãn hôn phối cần chừa thêm trong chiều cao ô (mỗi dòng `MARRIAGE_LINE_HEIGHT`): 0 khi cây không có gì để ghi,
 * 1 khi có người từ 2 vợ/chồng hoặc cuộc hôn phối đã ly hôn/goá, 2 khi còn có thể có Dâu/Rể là vợ/chồng của hai người trong họ
 * ("cũng là chồng của …"). Tính từ dữ liệu, không phụ thuộc phần cây đang vẽ, nên chiều cao ô không đổi khi thu/mở nhánh.
 */
export const marriageExtraLines = (data: { parentLinks: LayoutParentLink[]; unions: LayoutUnion[] }): 0 | 1 | 2 => {
  const partners = new Map<string, string[]>();
  let needed = false;
  for (const union of data.unions) {
    if ((union.status ?? 'con') !== 'con') needed = true;
    pushTo(partners, union.partner_a, union.partner_b);
    pushTo(partners, union.partner_b, union.partner_a);
  }
  const hasParents = new Set(data.parentLinks.map((link) => link.child_id));
  let shared = false;
  for (const list of partners.values()) {
    if (list.length < 2) continue;
    needed = true;
    if (list.filter((id) => hasParents.has(id)).length >= 2) shared = true;
  }
  return shared ? 2 : needed ? 1 : 0;
};

/** Chiều cao một dòng nhãn hôn phối (đơn vị bố cục). */
export const MARRIAGE_LINE_HEIGHT = 14;
