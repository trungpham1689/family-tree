import type { FamilyGraph, GraphPerson } from './family-graph';
import { spouseLabel } from './labels';

/**
 * Ghi chú "con này là con với vợ/chồng nào" cho từng con của `parentId`:
 * "với Chồng hai: Tên", "với Tên" (người kia không có Hôn phối), "chưa rõ cha/mẹ" (con chỉ ghi một phụ huynh).
 * Chỉ áp dụng cho mẹ có từ 2 chồng; còn lại trả Map rỗng (cha nhiều vợ thì thêm con ở trang từng vợ). Khoá là id con.
 */
export const coParentCaptions = <P extends GraphPerson>(graph: FamilyGraph<P>, parentId: string): Map<string, string> => {
  const spouses = graph.spousesOf(parentId);
  if (graph.person(parentId)?.gender !== 'nu' || spouses.length < 2) return new Map();

  return new Map(
    graph.childrenOf(parentId).map(({ person: child }) => {
      const other = graph.parentsOf(child.id).find((p) => p.person.id !== parentId)?.person;
      if (!other) return [child.id, 'chưa rõ cha'];
      const spouse = spouses.find((s) => s.person.id === other.id);
      return [child.id, spouse ? `với ${spouseLabel(other.gender, spouse.order)}: ${other.full_name}` : `với ${other.full_name}`];
    }),
  );
};

/** Con ruột của `parentId` mà chưa có cha/mẹ ruột nào khác ("chưa rõ cha/mẹ còn lại"), theo thứ tự danh sách con. */
export const childrenWithoutCoParent = <P extends GraphPerson>(graph: FamilyGraph<P>, parentId: string): P[] =>
  graph
    .childrenOf(parentId)
    .filter(({ kind }) => kind === 'ruot')
    .map(({ person }) => person)
    .filter((child) => !graph.parentsOf(child.id).some((parent) => parent.kind === 'ruot' && parent.person.id !== parentId));

/** "Mẹ"/"Cha"/"Cha/Mẹ": cách gọi người cha/mẹ CÒN LẠI của con, theo giới tính của người đã ghi. */
export const coParentWord = (parentGender: string | null | undefined): string => (parentGender === 'nam' ? 'Mẹ' : parentGender === 'nu' ? 'Cha' : 'Cha/Mẹ');

export type CoParentOffer<P extends GraphPerson> = {
  /** Người đã ghi là cha/mẹ của các con. */
  parent: P;
  /** Con chưa có cha/mẹ còn lại. */
  children: P[];
  /** `person` ghi làm cha/mẹ còn lại cho các con này. */
  owner: 'self' | 'spouse';
};

/**
 * Trên trang của `personId`: những nhóm con có thể ghi thêm cha/mẹ còn lại.
 * - con của chính người này chưa có cha/mẹ còn lại (chọn trong vợ/chồng của họ), và
 * - con của vợ/chồng người này chưa có cha/mẹ còn lại (người này có thể là cha/mẹ đó).
 */
export const coParentOffers = <P extends GraphPerson>(graph: FamilyGraph<P>, personId: string): CoParentOffer<P>[] => {
  const self = graph.person(personId);
  if (!self) return [];
  const offers: CoParentOffer<P>[] = [];
  if (graph.spousesOf(personId).length > 0) {
    const children = childrenWithoutCoParent(graph, personId);
    if (children.length > 0) offers.push({ parent: self, children, owner: 'self' });
  }
  for (const { person: spouse } of graph.spousesOf(personId)) {
    const children = childrenWithoutCoParent(graph, spouse.id);
    if (children.length > 0) offers.push({ parent: spouse, children, owner: 'spouse' });
  }
  return offers;
};
