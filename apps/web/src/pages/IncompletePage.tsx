import { Link, useParams } from 'react-router';
import type { Person } from '../data/trees';
import { findIncomplete, REASON_LABELS } from '../people/incomplete';
import { lifespanText } from '../people/person-display';
import { DuplicatesSection } from '../people/DuplicatesSection';
import { TreePageShell } from '../tree/TreePageShell';

/** Người còn thiếu giới tính, năm sinh, hoặc năm mất — để bổ sung dần; kèm các Người nghi nhập trùng để gộp (Chủ sở hữu). */
export const IncompletePage = () => {
  const { treeId = '' } = useParams();
  return <TreePageShell treeId={treeId}>{({ graph, isOwner }) => (
        <>
          <IncompleteBody treeId={treeId} persons={graph.persons} />
          {isOwner && <DuplicatesSection treeId={treeId} graph={graph} />}
        </>
      )}</TreePageShell>;
};

const IncompleteBody = ({ treeId, persons }: { treeId: string; persons: Person[] }) => {
  const entries = findIncomplete(persons);
  return (
    <>
      <h1 className="font-serif text-3xl font-bold text-son">Thông tin thành viên cần cập nhật</h1>
      <p className="mt-1 text-ink-muted">Giới tính, năm sinh, hoặc năm mất (nếu đã mất) còn thiếu — bổ sung dần khi có thông tin.</p>
      <div className="mt-6">
        {entries.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-muted">
            Mọi hồ sơ đều đã đủ giới tính, năm sinh và năm mất (nếu đã mất).
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {entries.map(({ person, reasons }) => (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <Link to={`/gia-pha/${treeId}/nguoi/${person.id}`} className="group">
                  <span className="text-lg font-semibold group-hover:text-son group-hover:underline">{person.full_name}</span>
                  <span className="ml-2 text-ink-muted">{lifespanText(person)}</span>
                </Link>
                <div className="flex flex-wrap gap-2">
                  {reasons.map((reason) => (
                    <span key={reason} className="rounded-full bg-kim-soft px-3 py-1 text-sm">
                      {REASON_LABELS[reason]}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};
