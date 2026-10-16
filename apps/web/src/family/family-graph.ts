/**
 * Đồ thị gia đình trong bộ nhớ: dựng một lần từ dữ liệu của cả Gia phả,
 * rồi tra cha mẹ, vợ chồng, con và thống kê theo Đời mà không phải gọi lại database.
 */

export type PersonKind = 'thuy_to' | 'dinh' | 'dau_re' | 'chua_noi';
export type ParentLinkKind = 'ruot' | 'nuoi';
export type UnionStatus = 'con' | 'ly_hon' | 'goa';

export type GraphPerson = {
  id: string;
  full_name: string;
  gender: string | null;
  birth_year: number | null;
  birth_order: number | null;
};

export type GraphParentLink = { child_id: string; parent_id: string; kind: string };

export type GraphUnion = {
  id: string;
  partner_a: string;
  partner_b: string;
  order_for_a: number;
  order_for_b: number;
  status: string;
};

export type GraphPosition = { person_id: string; generation: number | null; branch_id: string | null; kind: string };

export type Relative<P> = { person: P };
export type ParentRelative<P> = Relative<P> & { kind: ParentLinkKind };
export type SpouseRelative<P> = Relative<P> & { unionId: string; order: number; status: UnionStatus };
export type ChildRelative<P> = Relative<P> & { kind: ParentLinkKind };

export type Placement = { generation: number | null; branchId: string | null; kind: PersonKind };

export type GenerationGroup<P> = { generation: number; persons: P[]; male: number; female: number; total: number };

export type FamilyGraph<P extends GraphPerson> = {
  /** Dữ liệu thô, cho các mô-đun cần duyệt toàn bộ (bố cục cây, xuất Excel). */
  persons: P[];
  parentLinks: GraphParentLink[];
  unions: GraphUnion[];
  person(id: string): P | undefined;
  placement(id: string): Placement;
  parentsOf(id: string): ParentRelative<P>[];
  spousesOf(id: string): SpouseRelative<P>[];
  childrenOf(id: string): ChildRelative<P>[];
  generations(): GenerationGroup<P>[];
  unconnected(): P[];
};

const asLinkKind = (value: string): ParentLinkKind => (value === 'nuoi' ? 'nuoi' : 'ruot');
const asStatus = (value: string): UnionStatus => (value === 'ly_hon' || value === 'goa' ? value : 'con');
const asKind = (value: string): PersonKind =>
  value === 'thuy_to' || value === 'dinh' || value === 'dau_re' ? value : 'chua_noi';

const byName = new Intl.Collator('vi').compare;

/** Anh chị em: theo Thứ tự con, rồi năm sinh, rồi tên. */
const compareSiblings = (a: GraphPerson, b: GraphPerson): number =>
  (a.birth_order ?? Number.MAX_SAFE_INTEGER) - (b.birth_order ?? Number.MAX_SAFE_INTEGER) ||
  (a.birth_year ?? Number.MAX_SAFE_INTEGER) - (b.birth_year ?? Number.MAX_SAFE_INTEGER) ||
  byName(a.full_name, b.full_name);

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

export const buildFamilyGraph = <P extends GraphPerson>(input: {
  persons: P[];
  parentLinks: GraphParentLink[];
  unions: GraphUnion[];
  positions: GraphPosition[];
}): FamilyGraph<P> => {
  const persons = new Map(input.persons.map((person) => [person.id, person]));
  const positions = new Map(input.positions.map((position) => [position.person_id, position]));
  const parentLinksByChild = new Map<string, GraphParentLink[]>();
  const childLinksByParent = new Map<string, GraphParentLink[]>();
  const unionsByPerson = new Map<string, GraphUnion[]>();

  for (const link of input.parentLinks) {
    push(parentLinksByChild, link.child_id, link);
    push(childLinksByParent, link.parent_id, link);
  }
  for (const union of input.unions) {
    push(unionsByPerson, union.partner_a, union);
    push(unionsByPerson, union.partner_b, union);
  }

  const placement = (id: string): Placement => {
    const position = positions.get(id);
    return {
      generation: position?.generation ?? null,
      branchId: position?.branch_id ?? null,
      kind: asKind(position?.kind ?? 'chua_noi'),
    };
  };

  return {
    persons: input.persons,
    parentLinks: input.parentLinks,
    unions: input.unions,
    person: (id) => persons.get(id),
    placement,

    parentsOf: (id) =>
      (parentLinksByChild.get(id) ?? [])
        .flatMap((link) => {
          const person = persons.get(link.parent_id);
          return person ? [{ person, kind: asLinkKind(link.kind) }] : [];
        })
        // Cha trước mẹ, để hiển thị ổn định.
        .sort((a, b) => (a.person.gender === 'nam' ? -1 : 0) - (b.person.gender === 'nam' ? -1 : 0)),

    spousesOf: (id) =>
      (unionsByPerson.get(id) ?? [])
        .flatMap((union) => {
          const isA = union.partner_a === id;
          const person = persons.get(isA ? union.partner_b : union.partner_a);
          return person
            ? [{ person, unionId: union.id, order: isA ? union.order_for_a : union.order_for_b, status: asStatus(union.status) }]
            : [];
        })
        .sort((a, b) => a.order - b.order || byName(a.person.full_name, b.person.full_name)),

    childrenOf: (id) =>
      (childLinksByParent.get(id) ?? [])
        .flatMap((link) => {
          const person = persons.get(link.child_id);
          return person ? [{ person, kind: asLinkKind(link.kind) }] : [];
        })
        .sort((a, b) => compareSiblings(a.person, b.person)),

    generations: () => {
      const groups = new Map<number, P[]>();
      for (const person of persons.values()) {
        const generation = placement(person.id).generation;
        if (generation !== null) push(groups, generation, person);
      }
      return [...groups.entries()]
        .sort(([a], [b]) => a - b)
        .map(([generation, members]) => ({
          generation,
          persons: members.sort((a, b) => byName(a.full_name, b.full_name)),
          male: members.filter((person) => person.gender === 'nam').length,
          female: members.filter((person) => person.gender === 'nu').length,
          total: members.length,
        }));
    },

    unconnected: () =>
      [...persons.values()]
        .filter((person) => placement(person.id).kind === 'chua_noi')
        .sort((a, b) => byName(a.full_name, b.full_name)),
  };
};
