import type { FamilyGraph, GraphPerson } from './family-graph';
import { spouseLabel } from './labels';

/**
 * "A gọi B là gì?" — suy từ Cha mẹ/Vợ chồng đã lưu, không cần dữ liệu thêm. Một bộ máy dùng cho cả tab Xưng hô (hai người trong gia phả)
 * lẫn "Đặt tên cho Bé" (Bé là người ảo thêm vào đồ thị, xem `baby-relation.ts`).
 *
 * Gọi theo cách miền Bắc: anh chị của cha là bác (lớn tuổi hơn cha), chú (em trai), cô (em gái); anh chị em của mẹ là cậu, dì;
 * anh chị em của ông là ông bác/ông chú/bà cô, của bà là ông cậu/bà dì; thêm "họ" khi chỉ chung tổ tiên xa hơn cha mẹ ông bà của người đó.
 * Hậu duệ gọi theo đời (con, cháu, chắt…); quan hệ xa hơn nữa trả lời chung chung theo tổ tiên chung — vẫn đúng, chỉ không có tên riêng.
 */

/** Bên nội/ngoại của đường đi lên qua một người Cha hoặc Mẹ; null khi chưa biết. */
export type Side = 'noi' | 'ngoai' | null;

export type Relation = {
  /** "Bác ruột", "Ông chú ruột", "Cậu ruột", "Chú họ", "Cụ ông nội"… */
  term: string;
  /** Giải thích ngắn: "chị gái của Ba (Phạm Văn Bình)" hoặc "chung Ông nội Phạm Văn Cả". */
  via: string | null;
};

export type RelationOptions = {
  /** Cách gọi cha: "Cha" (mặc định) hoặc "Ba". */
  fatherWord?: string;
  /** Người hỏi sinh sau mọi người trong gia phả (Bé sắp đặt tên): mọi anh chị em và anh chị em họ đều là bậc trên. */
  youngest?: boolean;
  /** Bên nội/ngoại của đường đi lên qua `firstParent` (Cha hoặc Mẹ của người hỏi); mặc định theo giới tính (nam = nội, nữ = ngoại). */
  sideOf?: (firstParent: GraphPerson) => Side;
};

const genderSide = (parent: GraphPerson): Side => (parent.gender === 'nam' ? 'noi' : parent.gender === 'nu' ? 'ngoai' : null);

const sideWord = (side: NonNullable<Side>) => (side === 'noi' ? 'nội' : 'ngoại');

/** Từ `id`, mọi tổ tiên tới được cùng đường đi (gần nhất) qua Cha mẹ. */
export const ancestorPaths = <P extends GraphPerson>(graph: FamilyGraph<P>, startId: string): Map<string, P[]> => {
  const result = new Map<string, P[]>();
  const visited = new Set([startId]);
  let frontier: { id: string; path: P[] }[] = [{ id: startId, path: [] }];
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const { id, path } of frontier) {
      for (const { person: parent } of graph.parentsOf(id)) {
        if (visited.has(parent.id)) continue;
        visited.add(parent.id);
        const parentPath = [...path, parent];
        result.set(parent.id, parentPath);
        next.push({ id: parent.id, path: parentPath });
      }
    }
    frontier = next;
  }
  return result;
};

const UP_NAMES = ['', '', '', 'Cụ', 'Kỵ'];
const DOWN_NAMES = ['', '', 'Cháu', 'Chắt', 'Chút'];

/** "Cha"/"Mẹ", "Ông nội"/"Bà ngoại", "Cụ ông nội"… — tổ tiên cách `generations` đời. */
const ancestorTerm = (generations: number, gender: string | null, side: Side, fatherWord: string): string => {
  if (generations === 1) return gender === 'nam' ? fatherWord : gender === 'nu' ? 'Mẹ' : `${fatherWord}/Mẹ`;
  if (generations === 2) {
    const grand = gender === 'nam' ? 'Ông' : gender === 'nu' ? 'Bà' : 'Ông/Bà';
    return side ? `${grand} ${sideWord(side)}` : grand;
  }
  if (generations > 4) return side ? `Tổ tiên đời thứ ${generations} bên ${sideWord(side)}` : `Tổ tiên đời thứ ${generations}`;
  const sex = gender === 'nam' ? 'ông' : gender === 'nu' ? 'bà' : 'ông/bà';
  return `${UP_NAMES[generations]} ${sex}${side ? ` ${sideWord(side)}` : ''}`;
};

/** "Con"/"Cháu nội"/"Chắt"… — hậu duệ cách `generations` đời. */
const descendantTerm = (generations: number, gender: string | null, side: Side): string => {
  if (generations === 1) return gender === 'nam' ? 'Con trai' : gender === 'nu' ? 'Con gái' : 'Con';
  const base = generations <= 4 ? DOWN_NAMES[generations]! : `Hậu duệ đời thứ ${generations}`;
  const sided = generations === 2 && side ? `${base} ${sideWord(side)}` : base;
  if (gender === 'nam') return `${sided} (trai)`;
  if (gender === 'nu') return `${sided} (gái)`;
  return sided;
};

/**
 * So ngày sinh khi cả hai đều biết: năm, rồi tháng, rồi ngày (chỉ so tiếp khi phần trước bằng nhau và phần đó cả hai đều biết).
 * Âm: a sinh trước; dương: b sinh trước; 0 hoặc null: chưa đủ dữ liệu để phân biệt.
 */
const knownBirthComparison = (a: GraphPerson, b: GraphPerson): number | null => {
  for (const [x, y] of [
    [a.birth_year, b.birth_year],
    [a.birth_month ?? null, b.birth_month ?? null],
    [a.birth_day ?? null, b.birth_day ?? null],
  ] as const) {
    if (x === null || y === null) return null;
    if (x !== y) return x - y;
  }
  return null;
};

/**
 * `a` lớn tuổi hơn (sinh trước) `b` không; null khi chưa đủ dữ liệu để biết.
 * Anh chị em cùng cha mẹ (`siblings`): Thứ tự con đã ghi quyết định trước, như danh sách con; còn lại, và với họ hàng khác nhánh
 * (Thứ tự con chỉ có nghĩa giữa anh chị em), so ngày sinh. Cùng năm thì so tiếp tháng, ngày; bằng nhau hoặc thiếu thì null, không đoán.
 */
export const isOlder = (a: GraphPerson, b: GraphPerson, siblings = false): boolean | null => {
  if (siblings && a.birth_order !== null && b.birth_order !== null && a.birth_order !== b.birth_order) return a.birth_order < b.birth_order;
  const comparison = knownBirthComparison(a, b);
  return comparison === null || comparison === 0 ? null : comparison < 0;
};

/** "ruột" khi hai người có cùng cha mẹ đã ghi; "cùng cha khác mẹ"/"cùng mẹ khác cha" khi cả hai đều ghi đủ cha mẹ mà khác nhau; còn lại không nói. */
const siblingQualifier = (graph: FamilyGraph<GraphPerson>, aId: string, bId: string, fatherWord: string): string => {
  const parents = (id: string) => graph.parentsOf(id).filter((p) => p.kind === 'ruot').map((p) => p.person);
  const a = parents(aId);
  const b = parents(bId);
  if (a.length === 0 || b.length === 0) return '';
  const aIds = new Set(a.map((p) => p.id));
  if (b.length === a.length && b.every((p) => aIds.has(p.id))) return ' ruột';
  if (a.length < 2 || b.length < 2) return '';
  const shared = b.filter((p) => aIds.has(p.id));
  if (shared.length === 0) return '';
  const lowerFather = fatherWord.toLowerCase();
  return shared.every((p) => p.gender === 'nam') ? ` (cùng ${lowerFather} khác mẹ)` : shared.every((p) => p.gender === 'nu') ? ` (cùng mẹ khác ${lowerFather})` : '';
};

/** Anh chị em ruột (không "họ"): anh/chị khi lớn hơn, em khi nhỏ hơn. */
const siblingWord = (target: GraphPerson, older: boolean | null): string => {
  if (target.gender === 'nam') return older === true ? 'Anh' : older === false ? 'Em trai' : 'Anh/Em trai';
  if (target.gender === 'nu') return older === true ? 'Chị' : older === false ? 'Em gái' : 'Chị/Em gái';
  return older === true ? 'Anh/Chị' : older === false ? 'Em' : 'Anh/Chị/Em';
};

/** Anh chị em họ; `degree` là "họ" (chung ông bà) hoặc "họ xa". */
const cousinWord = (target: GraphPerson, older: boolean | null, degree: string): string => {
  if (target.gender === 'nam') return older === true ? `Anh ${degree}` : older === false ? `Em ${degree} (trai)` : `Anh/Em ${degree} (trai)`;
  if (target.gender === 'nu') return older === true ? `Chị ${degree}` : older === false ? `Em ${degree} (gái)` : `Chị/Em ${degree} (gái)`;
  return `Anh/Chị/Em ${degree}`;
};

/** Cách nói trong phần giải thích: "anh trai", "chị gái", "em trai"… */
const siblingPhrase = (person: GraphPerson, elder: GraphPerson): string => {
  const older = isOlder(person, elder, true);
  if (person.gender === 'nam') return older === true ? 'anh trai' : older === false ? 'em trai' : 'anh/em trai';
  if (person.gender === 'nu') return older === true ? 'chị gái' : older === false ? 'em gái' : 'chị/em gái';
  return 'anh/chị/em';
};

/** Từ gốc của cách gọi anh chị em của một bậc tiền bối `elder` (cha, mẹ, ông, bà…): bác, chú, cô, cậu, dì. */
const collateralWord = (elder: GraphPerson, person: GraphPerson, elderSide: Side, siblings: boolean): string => {
  const male = person.gender === 'nam';
  const female = person.gender === 'nu';
  const fatherLine = elder.gender === 'nam' || (elder.gender === null && elderSide === 'noi');
  if (fatherLine) {
    const older = isOlder(person, elder, siblings);
    if (older === true) return 'bác';
    if (female) return older === false ? 'cô' : 'cô/bác';
    return older === false ? 'chú' : male ? 'bác/chú' : 'cô/bác/chú';
  }
  if (elder.gender !== 'nu' && elderSide !== 'ngoai') return 'cô/chú/bác/cậu/dì';
  return male ? 'cậu' : female ? 'dì' : 'cậu/dì';
};

const PREFIX: Record<number, (male: boolean | null) => string> = {
  1: () => '',
  2: (male) => (male === true ? 'Ông ' : male === false ? 'Bà ' : 'Ông/Bà '),
  3: () => 'Cụ ',
  4: () => 'Kỵ ',
};

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Viết hoa chữ đầu và chữ đầu sau dấu "/": "bác/chú họ" → "Bác/Chú họ". */
const capitalize = (text: string) => text.replace(/(^|\/)\p{L}/gu, (match) => match.toUpperCase());

/** Chồng/vợ của chú, bác, cô, cậu, dì: thím, mợ, bác gái, dượng… */
const spouseOfCollateral = (word: string, spouse: GraphPerson): string | null => {
  const wife = spouse.gender === 'nu';
  if (word === 'chú') return wife ? 'Thím' : null;
  if (word === 'cậu') return wife ? 'Mợ' : null;
  if (word === 'bác') return wife ? 'Bác gái' : 'Bác trai';
  if (word === 'cô' || word === 'dì') return wife ? null : 'Dượng';
  return null;
};

/** `parentSiblingWord`: bác/chú/cô/cậu/dì khi người đó là anh chị em ruột của cha hoặc mẹ (để suy ra thím, mợ, dượng…); còn lại null. */
type BloodResult = { relation: Relation; parentSiblingWord: string | null };

const plain = (term: string): BloodResult => ({ relation: { term, via: null }, parentSiblingWord: null });

/**
 * Hàm tra "`toId` là gì của `fromId`?": null khi hai người không có quan hệ huyết thống hay hôn phối nào tìm được trong đồ thị.
 * Tổ tiên của người hỏi chỉ duyệt một lần, dùng cho mọi lần tra sau — tra nhiều người cùng một người hỏi thì rẻ.
 */
export const relationFrom = <P extends GraphPerson>(
  graph: FamilyGraph<P>,
  fromId: string,
  options: RelationOptions = {},
): ((toId: string) => Relation | null) => {
  const from = graph.person(fromId);
  if (!from) return () => null;
  const { fatherWord = 'Cha', youngest = false, sideOf = genderSide } = options;
  const fromAncestors = ancestorPaths(graph, fromId);

  const blood = (targetId: string): BloodResult | null => {
    const target = graph.person(targetId);
    if (!target) return null;

    const up = fromAncestors.get(targetId);
    if (up) return plain(ancestorTerm(up.length, target.gender, sideOf(up[0]!), fatherWord));

    const toAncestors = ancestorPaths(graph, targetId);
    const down = toAncestors.get(fromId);
    if (down) return plain(descendantTerm(down.length, target.gender, sideOf(down[0]!)));

    // Tổ tiên chung gần nhất; cùng độ dài thì ưu tiên đường qua bên nội.
    let best: { lcaId: string; fromPath: P[]; toPath: P[] } | null = null;
    const length = (candidate: NonNullable<typeof best>) => candidate.fromPath.length + candidate.toPath.length;
    for (const [lcaId, fromPath] of fromAncestors) {
      const toPath = toAncestors.get(lcaId);
      if (!toPath) continue;
      const candidate = { lcaId, fromPath, toPath };
      if (
        !best ||
        length(candidate) < length(best) ||
        (length(candidate) === length(best) && sideOf(fromPath[0]!) === 'noi' && sideOf(best.fromPath[0]!) !== 'noi')
      ) {
        best = candidate;
      }
    }
    if (!best) return null;

    const { lcaId, fromPath, toPath } = best;
    const a = fromPath.length;
    const b = toPath.length;
    const diff = a - b;
    const side = sideOf(fromPath[0]!);
    const lca = graph.person(lcaId)!;
    const lcaTerm = ancestorTerm(a, lca.gender, side, fatherWord);
    const common = `chung ${lcaTerm} ${lca.full_name}`;

    if (diff < 0) {
      if (a === 1 && b === 2) return plain(target.gender === 'nam' ? 'Cháu trai' : target.gender === 'nu' ? 'Cháu gái' : 'Cháu');
      return {
        relation: { term: 'Họ hàng', via: `tổ tiên chung ${lca.full_name}; cách ${a} đời bên ${from.full_name}, ${b} đời bên ${target.full_name}` },
        parentSiblingWord: null,
      };
    }

    if (diff === 0) {
      const older = youngest ? true : isOlder(target, from, b === 1);
      if (b === 1) return plain(`${siblingWord(target, older)}${siblingQualifier(graph, fromId, targetId, fatherWord)}`);
      return { relation: { term: cousinWord(target, older, b === 2 ? 'họ' : 'họ xa'), via: common }, parentSiblingWord: null };
    }

    // Người cùng hàng với bậc tiền bối `elder` của người hỏi (cha mẹ nếu diff = 1, ông bà nếu diff = 2…).
    const elder = fromPath[diff - 1]!;
    const word = collateralWord(elder, target, side, b === 1);
    const prefix = PREFIX[diff]?.(target.gender === 'nam' ? true : target.gender === 'nu' ? false : null) ?? '';
    const known = diff <= 4;
    if (b === 1) {
      const qualifier = siblingQualifier(graph, elder.id, targetId, fatherWord);
      const term = known ? `${capitalize(`${prefix}${word}`.trim())}${qualifier}` : `Họ hàng bậc tổ tiên${qualifier}`;
      return {
        relation: { term, via: `${siblingPhrase(target, elder)} của ${ancestorTerm(diff, elder.gender, side, fatherWord)} (${elder.full_name})` },
        parentSiblingWord: diff === 1 ? word : null,
      };
    }
    const degree = b === 2 ? 'họ' : 'họ xa';
    const term = known ? `${capitalize(`${prefix}${word}`.trim())} ${degree}` : `Họ hàng bậc tổ tiên (${degree})`;
    return { relation: { term, via: common }, parentSiblingWord: null };
  };

  return (toId) => {
    const to = graph.person(toId);
    if (!to) return null;
    if (toId === fromId) return { term: 'Chính là người này', via: null };

    const spouse = graph.spousesOf(fromId).find((s) => s.person.id === toId);
    if (spouse) return { term: spouseLabel(to.gender, spouse.order), via: null };

    const relative = blood(toId);
    if (relative) return relative.relation;

    // Không cùng huyết thống: người đó có thể là vợ/chồng của một người họ hàng.
    for (const { person: spouseOfTo } of graph.spousesOf(toId)) {
      const kin = blood(spouseOfTo.id);
      if (!kin) continue;
      const special = kin.parentSiblingWord ? spouseOfCollateral(kin.parentSiblingWord, to) : null;
      const spouseWord = to.gender === 'nu' ? 'Vợ' : to.gender === 'nam' ? 'Chồng' : 'Vợ/Chồng';
      return {
        term: special ?? `${spouseWord} của ${lower(kin.relation.term)}`,
        via: special ? `${to.gender === 'nu' ? 'vợ' : 'chồng'} của ${lower(kin.relation.term)} ${spouseOfTo.full_name}` : `${lower(spouseWord)} của ${spouseOfTo.full_name}`,
      };
    }
    return null;
  };
};

/** "`toId` là gì của `fromId`?" cho một cặp người. */
export const describeRelation = <P extends GraphPerson>(
  graph: FamilyGraph<P>,
  fromId: string,
  toId: string,
  options: RelationOptions = {},
): Relation | null => relationFrom(graph, fromId, options)(toId);
