import { Link, useParams } from 'react-router';
import { useFamily, useTree } from '../data/tree-queries';
import { findIncomplete, REASON_LABELS } from '../people/incomplete';
import { lifespanText } from '../people/person-display';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { ErrorBanner } from '../ui/fields';
import { FullPageMessage } from '../ui/FullPageMessage';

/** Người còn thiếu giới tính, năm sinh, hoặc năm mất — để bổ sung dần. */
export const IncompletePage = () => {
  const { treeId = '' } = useParams();
  const tree = useTree(treeId);
  const family = useFamily(treeId);

  if (tree.isPending || family.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error;
  const entries = family.data ? findIncomplete(family.data.persons) : [];

  return (
    <>
      <AppHeader />
      <TreeTabs treeId={treeId} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-serif text-3xl font-bold text-son">Hồ sơ chưa đầy đủ</h1>
        <p className="mt-1 text-ink-muted">Giới tính, năm sinh, hoặc năm mất (nếu đã mất) còn thiếu — bổ sung dần khi có thông tin.</p>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}

        {family.isSuccess && (
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
        )}
      </main>
    </>
  );
};
