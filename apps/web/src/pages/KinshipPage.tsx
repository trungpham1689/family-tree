import { useState } from 'react';
import { useParams } from 'react-router';
import { useFamily, useTree } from '../data/tree-queries';
import { relationTerm } from '../family/kinship';
import { PersonPicker } from '../people/PersonPicker';
import { personLabel } from '../people/person-label';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

/** Tra cứu xưng hô: chọn hai Người, xem người kia gọi người này là gì. */
export const KinshipPage = () => {
  const { treeId = '' } = useParams();
  const tree = useTree(treeId);
  const family = useFamily(treeId);
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);

  if (tree.isPending || family.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error;
  const graph = family.data;

  const aToB = aId && bId && graph ? relationTerm(graph, aId, bId) : null;
  const bToA = aId && bId && graph ? relationTerm(graph, bId, aId) : null;

  return (
    <>
      <AppHeader />
      <TreeTabs treeId={treeId} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-serif text-3xl font-bold text-son">Tra cứu quan hệ</h1>
        <p className="mt-1 text-ink-muted">Chọn hai Người để xem cách xưng hô, suy từ Cha mẹ và Vợ chồng đã ghi.</p>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}

        {graph && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <PersonChooser label="Người thứ nhất" graph={graph} selectedId={aId} onPick={setAId} onClear={() => setAId(null)} />
              <PersonChooser label="Người thứ hai" graph={graph} selectedId={bId} onPick={setBId} onClear={() => setBId(null)} />
            </div>

            {aId && bId && (
              <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
                <ResultLine subject={personLabel(graph, aId)} term={bToA} object={personLabel(graph, bId)} />
                <ResultLine subject={personLabel(graph, bId)} term={aToB} object={personLabel(graph, aId)} />
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
};

const PersonChooser = ({
  label,
  graph,
  selectedId,
  onPick,
  onClear,
}: {
  label: string;
  graph: NonNullable<ReturnType<typeof useFamily>['data']>;
  selectedId: string | null;
  onPick: (id: string) => void;
  onClear: () => void;
}) => {
  if (selectedId) {
    return (
      <div className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4">
        <div>
          <p className="text-sm text-ink-muted">{label}</p>
          <p className="font-semibold">{personLabel(graph, selectedId)}</p>
        </div>
        <Button variant="ghost" onClick={onClear}>
          Đổi
        </Button>
      </div>
    );
  }
  return <PersonPicker graph={graph} label={label} onPick={onPick} />;
};

const ResultLine = ({ subject, term, object }: { subject: string; term: string | null; object: string }) => (
  <p>
    <strong>{subject}</strong> gọi <strong>{object}</strong> là{' '}
    {term ? <span className="font-semibold text-son">{term}</span> : <span className="text-ink-muted">không rõ quan hệ</span>}.
  </p>
);
