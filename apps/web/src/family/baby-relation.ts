import type { Person } from '../data/trees';
import { buildFamilyGraph, type FamilyGraph, type GraphPerson } from './family-graph';
import { relationFrom, type Relation } from './kinship';

/**
 * Quan hệ của một người trong gia phả với bé sắp đặt tên ("X là … của bé"), suy từ cha và/hoặc mẹ của bé.
 * Bé chưa có trong gia phả nên được thêm tạm làm con của cha (và mẹ) rồi dùng chung bộ máy xưng hô (`kinship.ts`); bé là người sinh sau cùng,
 * nên mọi người đã có trong gia phả đều được coi là lớn tuổi hơn bé (anh/chị, không phải em). Cha gọi là "Ba".
 */

/** Cha và/hoặc mẹ của bé trong gia phả (ít nhất một người). */
export type BabyParents = { fatherId: string | null; motherId: string | null };
export type BabyRelation = Relation;

const BABY_ID = '__be__';

const toGraphPerson = (p: GraphPerson): GraphPerson => ({
  id: p.id,
  full_name: p.full_name,
  gender: p.gender,
  birth_year: p.birth_year,
  birth_month: p.birth_month ?? null,
  birth_day: p.birth_day ?? null,
  birth_order: p.birth_order,
});

/**
 * Hàm tra quan hệ với bé có cha `parents.fatherId` và/hoặc mẹ `parents.motherId` (ít nhất một người): trả `null` khi không có quan hệ huyết thống
 * hay hôn phối nào tìm được trong gia phả. Đồ thị có bé được dựng một lần, dùng cho cả danh sách người cần tra.
 */
export const babyRelationFinder = (graph: FamilyGraph<Person>, parents: BabyParents): ((targetId: string) => BabyRelation | null) => {
  const father = parents.fatherId && graph.person(parents.fatherId) ? parents.fatherId : null;
  const mother = parents.motherId && graph.person(parents.motherId) ? parents.motherId : null;
  if (!father && !mother) return () => null;
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
  return relationFrom(augmented, BABY_ID, {
    fatherWord: 'Ba',
    youngest: true,
    sideOf: (firstParent) => (firstParent.id === father ? 'noi' : 'ngoai'),
  });
};

export const babyRelation = (graph: FamilyGraph<Person>, parents: BabyParents, targetId: string): BabyRelation | null =>
  babyRelationFinder(graph, parents)(targetId);
