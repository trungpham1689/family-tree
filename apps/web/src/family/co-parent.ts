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
