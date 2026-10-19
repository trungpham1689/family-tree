import { useState } from 'react';
import { useParams } from 'react-router';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { relationTerm } from '../family/kinship';
import { PersonPicker } from '../people/PersonPicker';
import { personLabel } from '../people/person-label';
import { TreePageShell } from '../tree/TreePageShell';
import { Button } from '../ui/Button';

/** Tra cứu xưng hô: chọn hai Người, xem người kia gọi người này là gì. */
export const KinshipPage = () => {
  const { treeId = '' } = useParams();
  return <TreePageShell treeId={treeId}>{({ graph }) => <KinshipBody graph={graph} />}</TreePageShell>;
};

const KinshipBody = ({ graph }: { graph: FamilyGraph<Person> }) => {
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const aToB = aId && bId ? relationTerm(graph, aId, bId) : null;
  const bToA = aId && bId ? relationTerm(graph, bId, aId) : null;

  return (
    <>
      <h1 className="font-serif text-3xl font-bold text-son">Tra cứu quan hệ</h1>
      <p className="mt-1 text-ink-muted">Chọn hai Người để xem cách xưng hô, suy từ Cha mẹ và Vợ chồng đã ghi.</p>
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
  graph: FamilyGraph<Person>;
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
