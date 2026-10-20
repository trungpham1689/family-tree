import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMergePersons } from '../data/tree-queries';
import type { Person } from '../data/trees';
import { duplicateGroups } from './duplicate-check';
import { lifespanText } from './person-display';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ErrorBanner } from '../ui/fields';
import type { FamilyGraph } from '../family/family-graph';

/** Gộp những Người nhập trùng làm một (chỉ hiện cho Chủ sở hữu). Quan hệ, ảnh, hồ sơ được dồn về người được giữ. */
export const DuplicatesSection = ({ treeId, graph }: { treeId: string; graph: FamilyGraph<Person> }) => {
  const merge = useMergePersons(treeId);
  const groups = useMemo(() => duplicateGroups(graph.persons), [graph]);

  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl font-bold text-son">Thành viên trùng</h2>
      <p className="mt-1 text-ink-muted">
        Những Người cùng tên (và năm sinh không mâu thuẫn) có thể là một người nhập hai lần, thường sau khi nhập Excel. Chọn người
        cần giữ, phần còn lại sẽ được gộp vào.
      </p>

      {groups.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-muted">
          Không thấy thành viên nào nghi trùng.
        </p>
      )}

      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <GroupCard
            key={group.map((person) => person.id).join('-')}
            treeId={treeId}
            group={group}
            graph={graph}
            busy={merge.isPending}
            error={merge.error?.message ?? null}
            // Gộp cả nhóm trong một lần (tải lại gia phả một lần); lỗi hiện ở `merge.error`.
            onMerge={(keepId, dropIds, done) => merge.mutate({ keepId, dropIds }, { onSuccess: done })}
          />
        ))}
      </div>
    </section>
  );
};

const GroupCard = ({
  treeId,
  group,
  graph,
  busy,
  error,
  onMerge,
}: {
  treeId: string;
  group: Person[];
  graph: FamilyGraph<Person>;
  busy: boolean;
  error: string | null;
  onMerge: (keepId: string, dropIds: string[], done: () => void) => void;
}) => {
  const [keepId, setKeepId] = useState(group[0]!.id);
  const [confirming, setConfirming] = useState(false);
  const keep = group.find((person) => person.id === keepId) ?? group[0]!;
  const dropIds = group.filter((person) => person.id !== keep.id).map((person) => person.id);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-serif text-xl font-bold">{group[0]!.full_name}</h2>
      <fieldset className="mt-3 space-y-2">
        <legend className="text-sm text-ink-muted">Giữ lại người nào?</legend>
        {group.map((person) => {
          const parents = graph.parentsOf(person.id).map((relative) => relative.person.full_name);
          const spouses = graph.spousesOf(person.id).map((relative) => relative.person.full_name);
          const children = graph.childrenOf(person.id).length;
          const details = [
            parents.length ? `Con của ${parents.join(' & ')}` : 'Chưa nối cha mẹ',
            spouses.length ? `Vợ/chồng: ${spouses.join(', ')}` : null,
            children ? `${children} con` : null,
          ].filter(Boolean);
          return (
            <label key={person.id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line px-4 py-3 has-checked:border-son has-checked:bg-son/5">
              <input type="radio" className="mt-1.5 size-5" name={`keep-${group[0]!.id}`} checked={person.id === keepId} onChange={() => setKeepId(person.id)} />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{person.full_name}</span>
                <span className="ml-2 text-ink-muted">{lifespanText(person)}</span>
                <span className="block text-sm text-ink-muted">{details.join(' · ')}</span>
                <Link to={`/gia-pha/${treeId}/nguoi/${person.id}`} className="text-sm font-semibold text-son hover:underline">
                  Xem hồ sơ
                </Link>
              </span>
            </label>
          );
        })}
      </fieldset>
      <Button className="mt-4" onClick={() => setConfirming(true)} disabled={busy}>
        Gộp {dropIds.length} người vào “{keep.full_name}”
      </Button>
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Dialog open={confirming} title="Gộp thành viên trùng" onClose={() => setConfirming(false)}>
        <p>
          Gộp {dropIds.length} thành viên trùng vào <strong>{keep.full_name}</strong>. Cha mẹ, con, vợ/chồng và ảnh của họ chuyển sang người
          được giữ; thông tin nào người được giữ còn trống sẽ lấy từ người bị gộp. <strong>Không hoàn tác được.</strong>
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Huỷ
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => onMerge(keep.id, dropIds, () => setConfirming(false))}>
            {busy ? 'Đang gộp…' : 'Gộp'}
          </Button>
        </div>
      </Dialog>
    </section>
  );
};
