import type { Person } from '../data/trees';
import { buildFamilyGraph, type FamilyGraph, type GraphPerson } from './family-graph';
import { ancestorPaths, isOlder, lineageTermUp } from './kinship';

/**
 * Quan hệ của một người trong gia phả với bé sắp đặt tên ("X là … của bé"), suy từ cha và/hoặc mẹ của bé.
 * Bé chưa có trong gia phả nên được thêm tạm làm con của cha (và mẹ) để duyệt tổ tiên chung. Bé là người sinh sau cùng, nên mọi
 * người đã có trong gia phả đều được coi là lớn tuổi hơn bé (anh/chị, không phải em).
 *
 * Gọi theo cách miền Bắc: anh chị của cha là bác (lớn tuổi hơn cha), chú (em trai), cô (em gái); anh chị em của mẹ là cậu, dì;
 * anh chị em của ông là ông bác/ông chú/bà cô, của bà là ông cậu/bà dì; thêm "họ" khi chỉ chung tổ tiên xa hơn cha mẹ ông bà của người đó.
 */

/** Cha và/hoặc mẹ của bé trong gia phả (ít nhất một người). */
export type BabyParents = { fatherId: string | null; motherId: string | null };
export type BabyRelation = {
  /** "Bác ruột", "Ông chú ruột", "Cậu ruột", "Chú họ", "Cụ ông nội"… */
  term: string;
  /** Giải thích ngắn: "chị gái của Ba (Phạm Văn Bình)" hoặc "chung Ông nội Phạm Văn Cả". */
  via: string | null;
};

const BABY_ID = '__be__';

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const sideWord = (side: 'noi' | 'ngoai') => (side === 'noi' ? 'nội' : 'ngoại');

/** Tổ tiên trực hệ cách bé `distance` đời; `side` là bên ba (nội) hay mẹ (ngoại). Dùng chung bảng từ với tab xưng hô, gọi cha là "Ba". */
const directTerm = (distance: number, gender: string | null, side: 'noi' | 'ngoai'): string => {
  const base = lineageTermUp(distance, gender, side === 'noi' ? 'nam' : 'nu', 'Ba');
  if (distance <= 2) return base;
  const sex = gender === 'nam' ? 'ông' : gender === 'nu' ? 'bà' : 'ông/bà';
  return distance <= 4 ? `${base} ${sex} ${sideWord(side)}` : `${base} bên ${sideWord(side)}`;
};

/** "ruột" khi hai người có cùng cha mẹ đã ghi; "cùng cha khác mẹ"/"cùng mẹ khác cha" khi cả hai đều ghi đủ cha mẹ mà khác nhau; còn lại không nói. */
const siblingQualifier = (graph: FamilyGraph<GraphPerson>, aId: string, bId: string): string => {
  const parents = (id: string) => graph.parentsOf(id).filter((p) => p.kind === 'ruot').map((p) => p.person);
  const a = parents(aId);
  const b = parents(bId);
  if (a.length === 0 || b.length === 0) return '';
  const aIds = new Set(a.map((p) => p.id));
  const same = b.length === a.length && b.every((p) => aIds.has(p.id));
  if (same) return ' ruột';
  if (a.length < 2 || b.length < 2) return '';
  const shared = b.filter((p) => aIds.has(p.id));
  if (shared.length === 0) return '';
  return shared.every((p) => p.gender === 'nam') ? ' (cùng ba khác mẹ)' : shared.every((p) => p.gender === 'nu') ? ' (cùng mẹ khác ba)' : '';
};

/** Từ gốc của cách gọi anh chị em của một bậc tiền bối `elder` (cha, mẹ, ông, bà…): bác, chú, cô, cậu, dì. */
const collateralWord = (elder: GraphPerson, person: GraphPerson, elderSide: 'noi' | 'ngoai', siblings: boolean): string => {
  const male = person.gender === 'nam';
  const female = person.gender === 'nu';
  const fatherLine = elder.gender === 'nam' || (elder.gender === null && elderSide === 'noi');
  if (fatherLine) {
    const older = isOlder(person, elder, siblings);
    if (older === true) return 'bác';
    if (female) return older === false ? 'cô' : 'cô/bác';
    return older === false ? 'chú' : male ? 'bác/chú' : 'cô/bác/chú';
  }
  return male ? 'cậu' : female ? 'dì' : 'cậu/dì';
};

const PREFIX: Record<number, (male: boolean | null) => string> = {
  1: () => '',
  2: (male) => (male === true ? 'Ông ' : male === false ? 'Bà ' : 'Ông/Bà '),
  3: () => 'Cụ ',
  4: () => 'Kỵ ',
};

/** Viết hoa chữ đầu và chữ đầu sau dấu "/": "bác/chú họ" → "Bác/Chú họ". */
const capitalize = (text: string) => text.replace(/(^|\/)\p{L}/gu, (match) => match.toUpperCase());

const phrase = (person: GraphPerson, elder: GraphPerson | null): string => {
  const older = elder ? isOlder(person, elder, true) : null;
  if (person.gender === 'nam') return older === true ? 'anh trai' : older === false ? 'em trai' : 'anh/em trai';
  if (person.gender === 'nu') return older === true ? 'chị gái' : older === false ? 'em gái' : 'chị/em gái';
  return 'anh/chị/em';
};

/** `parentSiblingWord`: bác/chú/cô/cậu/dì khi người đó là anh chị em ruột của cha hoặc mẹ bé (để suy ra thím, mợ, dượng…); còn lại null. */
type BloodResult = { relation: BabyRelation; parentSiblingWord: string | null };

/** Kết quả dùng chung khi tra nhiều người: bé và tổ tiên của bé chỉ duyệt một lần. */
type Lookup = { graph: FamilyGraph<GraphPerson>; parents: BabyParents; fromAncestors: Map<string, GraphPerson[]> };

const bloodRelation = ({ graph, parents, fromAncestors }: Lookup, targetId: string): BloodResult | null => {
  const target = graph.person(targetId);
  if (!target) return null;
  const sideOf = (firstParentId: string): 'noi' | 'ngoai' => (firstParentId === parents.fatherId ? 'noi' : 'ngoai');
  const direct = fromAncestors.get(targetId);
  if (direct) {
    const side = sideOf(direct[0]!.id);
    return { relation: { term: directTerm(direct.length, target.gender, side), via: null }, parentSiblingWord: null };
  }

  const toAncestors = ancestorPaths(graph, targetId);
  let best: { lcaId: string; fromPath: GraphPerson[]; toPath: GraphPerson[] } | null = null;
  const betterThan = (candidate: NonNullable<typeof best>) =>
    !best ||
    candidate.fromPath.length + candidate.toPath.length < best.fromPath.length + best.toPath.length ||
    // Cùng độ dài: ưu tiên đường qua cha (bên nội).
    (candidate.fromPath.length + candidate.toPath.length === best.fromPath.length + best.toPath.length &&
      candidate.fromPath[0]!.id === parents.fatherId &&
      best.fromPath[0]!.id !== parents.fatherId);
  for (const [ancestorId, fromPath] of fromAncestors) {
    const toPath = toAncestors.get(ancestorId);
    if (!toPath) continue;
    const candidate = { lcaId: ancestorId, fromPath, toPath };
    if (betterThan(candidate)) best = candidate;
  }
  if (!best) return null;

  const { lcaId, fromPath, toPath } = best;
  const a = fromPath.length;
  const b = toPath.length;
  const diff = a - b;
  if (diff < 0) return null;
  const side = sideOf(fromPath[0]!.id);
  const lca = graph.person(lcaId)!;
  const lcaTerm = directTerm(a, lca.gender, side);

  if (diff === 0) {
    if (b === 1) {
      const word = target.gender === 'nam' ? 'Anh' : target.gender === 'nu' ? 'Chị' : 'Anh/Chị';
      return { relation: { term: `${word}${siblingQualifier(graph, BABY_ID, targetId)}`, via: null }, parentSiblingWord: null };
    }
    const sex = target.gender === 'nam' ? 'Anh' : target.gender === 'nu' ? 'Chị' : 'Anh/Chị';
    return { relation: { term: `${sex} ${b === 2 ? 'họ' : 'họ xa'}`, via: `chung ${lcaTerm} ${lca.full_name}` }, parentSiblingWord: null };
  }

  // Người cùng hàng với bậc tiền bối `elder` của bé (cha mẹ nếu diff = 1, ông bà nếu diff = 2…).
  const elder = fromPath[diff - 1]!;
  const elderSide = sideOf(fromPath[0]!.id);
  const word = collateralWord(elder, target, elderSide, b === 1);
  const male = target.gender === 'nam' ? true : target.gender === 'nu' ? false : null;
  const prefix = (PREFIX[diff] ?? (() => ''))(male);
  const known = diff <= 4;
  const elderTerm = directTerm(diff, elder.gender, elderSide);
  if (b === 1) {
    const qualifier = siblingQualifier(graph, elder.id, targetId);
    const term = known ? `${capitalize(`${prefix}${word}`.trim())}${qualifier}` : `Họ hàng bậc tổ tiên${qualifier}`;
    return {
      relation: { term, via: `${phrase(target, elder)} của ${elderTerm} (${elder.full_name})` },
      parentSiblingWord: diff === 1 ? word : null,
    };
  }
  const degree = b === 2 ? 'họ' : 'họ xa';
  const term = known ? `${capitalize(`${prefix}${word}`.trim())} ${degree}` : `Họ hàng bậc tổ tiên (${degree})`;
  return { relation: { term, via: `chung ${lcaTerm} ${lca.full_name}` }, parentSiblingWord: null };
};

/** Chồng/vợ của chú, bác, cô, cậu, dì: thím, mợ, bác gái, dượng… */
const spouseOfCollateral = (word: string, spouse: GraphPerson): string | null => {
  const wife = spouse.gender === 'nu';
  if (word === 'chú') return wife ? 'Thím' : null;
  if (word === 'cậu') return wife ? 'Mợ' : null;
  if (word === 'bác') return wife ? 'Bác gái' : 'Bác trai';
  if (word === 'cô' || word === 'dì') return wife ? null : 'Dượng';
  return null;
};

/**
 * Hàm tra quan hệ với bé có cha `parents.fatherId` và/hoặc mẹ `parents.motherId` (ít nhất một người): trả `null` khi không có quan hệ huyết thống
 * hay hôn phối nào tìm được trong gia phả. Đồ thị có bé được dựng một lần, dùng cho cả danh sách người cần tra.
 */
export const babyRelationFinder = (graph: FamilyGraph<Person>, parents: BabyParents): ((targetId: string) => BabyRelation | null) => {
  const father = parents.fatherId && graph.person(parents.fatherId) ? parents.fatherId : null;
  const mother = parents.motherId && graph.person(parents.motherId) ? parents.motherId : null;
  if (!father && !mother) return () => null;
  const toGraphPerson = (p: GraphPerson): GraphPerson => ({
    id: p.id,
    full_name: p.full_name,
    gender: p.gender,
    birth_year: p.birth_year,
    birth_month: p.birth_month ?? null,
    birth_day: p.birth_day ?? null,
    birth_order: p.birth_order,
  });
  const baby: GraphPerson = { id: BABY_ID, full_name: 'Bé', gender: null, birth_year: null, birth_order: null };
  const augmented = buildFamilyGraph<GraphPerson>({
    persons: [...graph.persons.map(toGraphPerson), baby],
    parentLinks: [
      ...graph.parentLinks,
      ...(father ? [{ child_id: BABY_ID, parent_id: father, kind: 'ruot' }] : []),
      ...(mother ? [{ child_id: BABY_ID, parent_id: mother, kind: 'ruot' }] : []),
    ],
    unions: graph.unions,
    positions: [],
  });

  const lookup: Lookup = { graph: augmented, parents, fromAncestors: ancestorPaths(augmented, BABY_ID) };
  return (targetId) => {
    const blood = bloodRelation(lookup, targetId);
    if (blood) return blood.relation;

    // Không cùng huyết thống: người đó có thể là vợ/chồng của một người họ hàng của bé.
    const target = augmented.person(targetId);
    if (!target) return null;
    for (const { person: spouse } of augmented.spousesOf(targetId)) {
      const relative = bloodRelation(lookup, spouse.id);
      if (!relative) continue;
      const special = relative.parentSiblingWord ? spouseOfCollateral(relative.parentSiblingWord, target) : null;
      const spouseWord = target.gender === 'nu' ? 'Vợ' : target.gender === 'nam' ? 'Chồng' : 'Vợ/Chồng';
      const term = special ?? `${spouseWord} của ${lower(relative.relation.term)}`;
      return {
        term,
        via: special ? `${target.gender === 'nu' ? 'vợ' : 'chồng'} của ${lower(relative.relation.term)} ${spouse.full_name}` : `${lower(spouseWord)} của ${spouse.full_name}`,
      };
    }
    return null;
  };
};

export const babyRelation = (graph: FamilyGraph<Person>, parents: BabyParents, targetId: string): BabyRelation | null =>
  babyRelationFinder(graph, parents)(targetId);
