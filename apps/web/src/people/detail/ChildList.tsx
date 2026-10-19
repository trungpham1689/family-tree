import { Link } from 'react-router';
import { useReorderChildren } from '../../data/tree-queries';
import type { Person } from '../../data/trees';
import type { ChildRelative } from '../../family/family-graph';
import { birthOrderLabel } from '../../family/labels';
import { lifespanText } from '../person-display';
import { useDragReorder } from './use-drag-reorder';

/** Danh sách con kéo thả được để đổi Thứ tự con; số thứ tự tự đánh lại 1..N khi thả, gồm con của mọi vợ/chồng. */
export const ReorderableChildren = ({
  treeId,
  items,
  canEdit,
}: {
  treeId: string;
  items: ChildRelative<Person>[];
  canEdit: boolean;
}) => {
  const reorder = useReorderChildren(treeId);
  const byId = new Map(items.map((child) => [child.person.id, child]));
  const sourceOrder = items.map((child) => child.person.id);
  const { order, canDrag, setRef, dragHandleProps } = useDragReorder(sourceOrder, canEdit, (next) => reorder.mutate(next));

  return (
    <>
      {order.flatMap((id, index) => {
        const child = byId.get(id);
        if (!child) return [];
        return (
          <li key={id} ref={(element) => setRef(id, element)} className="flex flex-wrap items-center gap-3 px-5 py-3">
            {canDrag && (
              <button
                type="button"
                aria-label="Kéo để đổi thứ tự con"
                className="cursor-grab touch-none select-none px-1 text-xl text-ink-muted active:cursor-grabbing"
                {...dragHandleProps(id)}
              >
                ⠿
              </button>
            )}
            <Link to={`/gia-pha/${treeId}/nguoi/${child.person.id}`} className="group min-w-0 flex-1">
              <span className="block text-sm text-ink-muted">
                {[birthOrderLabel(index + 1), child.kind === 'nuoi' ? 'Con nuôi' : ''].filter(Boolean).join(' · ')}
              </span>
              <span className="text-lg font-semibold group-hover:text-son group-hover:underline">{child.person.full_name}</span>
              <span className="ml-2 text-ink-muted">{lifespanText(child.person)}</span>
            </Link>
          </li>
        );
      })}
      {reorder.isError && <li className="px-5 py-3 text-sm text-danger">{reorder.error.message}</li>}
    </>
  );
};
