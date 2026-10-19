import { useState, type FormEvent } from 'react';
import { useDeletePerson, useRequestDeletePerson } from '../data/tree-queries';
import type { Person } from '../data/trees';
import { deletionImpact } from '../family/deletion-impact';
import type { FamilyGraph } from '../family/family-graph';
import { Button } from '../ui/Button';
import { ErrorBanner, TextField } from '../ui/fields';

type Props = {
  treeId: string;
  graph: FamilyGraph<Person>;
  person: Person;
  /** Chủ sở hữu xoá ngay; Biên tập viên chỉ gửi yêu cầu, chờ Chủ sở hữu duyệt. */
  isOwner: boolean;
  onCancel: () => void;
  onDeleted: () => void;
};

/** Xác nhận xoá một Người. Có con cháu thì phải gõ đúng họ tên (v1 không có thùng rác). */
export const DeletePerson = ({ treeId, graph, person, isOwner, onCancel, onDeleted }: Props) => {
  const remove = useDeletePerson(treeId);
  const request = useRequestDeletePerson(treeId);
  const action = isOwner ? remove : request;
  const [typed, setTyped] = useState('');
  const root = graph.persons.find((candidate) => candidate.is_progenitor) ?? null;
  const impact = deletionImpact({
    personId: person.id,
    rootId: root?.id ?? null,
    parentLinks: graph.parentLinks,
    unions: graph.unions,
  });
  const blockedAsProgenitor = person.is_progenitor && graph.persons.length > 1;
  const mustType = impact.hasDescendants;
  const matches = typed.trim() === person.full_name.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (blockedAsProgenitor || (mustType && !matches)) return;
    action.mutate(person.id, { onSuccess: onDeleted });
  };

  if (blockedAsProgenitor) {
    return (
      <div className="space-y-4">
        <p>
          <strong>{person.full_name}</strong> đang là Thuỷ tổ, mọi Đời được tính từ người này. Hãy đặt người khác làm
          Thuỷ tổ trước, rồi mới xoá.
        </p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onCancel}>
            Đóng
          </Button>
        </div>
      </div>
    );
  }

  const orphanNames = impact.orphaned.map((id) => graph.person(id)?.full_name).filter(Boolean);

  return (
    <form onSubmit={submit} className="space-y-4">
      {isOwner ? (
        <p>
          Xoá <strong>{person.full_name}</strong> khỏi gia phả? Việc này <strong>không hoàn tác được</strong>.
        </p>
      ) : (
        <p>
          Gửi yêu cầu xoá <strong>{person.full_name}</strong>? Người này sẽ ở trạng thái chờ cho tới khi{' '}
          <strong>Chủ sở hữu</strong> duyệt.
        </p>
      )}
      {impact.links > 0 && <p>{impact.links} liên kết (cha mẹ, vợ chồng, con) của người này sẽ mất theo.</p>}
      {orphanNames.length > 0 && (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-danger">
          <p>
            {orphanNames.length} người sẽ không còn nối vào cây và chuyển sang mục “Chưa nối vào cây”:
          </p>
          <p className="mt-1 font-semibold">
            {orphanNames.slice(0, 8).join(', ')}
            {orphanNames.length > 8 ? ` và ${orphanNames.length - 8} người khác` : ''}
          </p>
        </div>
      )}
      {mustType && (
        <TextField
          label={`Gõ đúng “${person.full_name}” để xác nhận`}
          value={typed}
          autoComplete="off"
          onChange={(event) => setTyped(event.target.value)}
        />
      )}
      {action.isError && <ErrorBanner>{action.error.message}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Huỷ
        </Button>
        <Button type="submit" variant="danger" disabled={(mustType && !matches) || action.isPending}>
          {action.isPending ? 'Đang gửi…' : isOwner ? 'Xoá vĩnh viễn' : 'Gửi yêu cầu xoá'}
        </Button>
      </div>
    </form>
  );
};
