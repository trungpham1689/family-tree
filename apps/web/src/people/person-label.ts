import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';

/** "Phạm Văn An – Đời 5" (hoặc "– chưa nối" khi chưa vào cây). */
export const personLabel = (graph: FamilyGraph<Person>, personId: string): string => {
  const person = graph.person(personId);
  if (!person) return 'Người đã bị xoá';
  const { generation } = graph.placement(personId);
  return `${person.full_name} – ${generation === null ? 'chưa nối' : `Đời ${generation}`}`;
};
