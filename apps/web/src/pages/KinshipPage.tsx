import { useState } from 'react';
import { useParams } from 'react-router';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { relationTerm } from '../family/kinship';
import { NameCheckPanel } from '../family/NameCheckPanel';
import { PersonPicker } from '../people/PersonPicker';
import { personLabel } from '../people/person-label';
import { TreePageShell } from '../tree/TreePageShell';
import { Button } from '../ui/Button';
import { onTabKeyDown } from '../ui/tab-keys';

/** Tra cứu: xưng hô giữa hai Người, và trùng tên khi đặt tên cho Bé. */
export const KinshipPage = () => {
  const { treeId = '' } = useParams();
  return <TreePageShell treeId={treeId}>{({ graph }) => <LookupBody treeId={treeId} graph={graph} />}</TreePageShell>;
};

type LookupTab = 'kinship' | 'naming';
const LOOKUP_TABS: readonly (readonly [LookupTab, string])[] = [
  ['kinship', 'Quan hệ, xưng hô'],
  ['naming', 'Đặt tên cho Bé'],
];

const LookupBody = ({ treeId, graph }: { treeId: string; graph: FamilyGraph<Person> }) => {
  const [tab, setTab] = useState<LookupTab>('kinship');
  return (
    <>
      <h1 className="font-serif text-3xl font-bold text-son">Tra cứu</h1>
      <div
        role="tablist"
        aria-label="Loại tra cứu"
        className="mt-4 flex gap-1 rounded-xl bg-line/50 p-1"
        onKeyDown={(event) => onTabKeyDown(event, LOOKUP_TABS.map(([id]) => id), tab, setTab, (id) => `lookup-tab-${id}`)}
      >
        {LOOKUP_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`lookup-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="lookup-panel"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            className={`min-h-11 flex-1 rounded-lg px-3 ${tab === id ? 'bg-surface font-bold text-son shadow-sm' : 'font-medium hover:bg-surface/60'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="lookup-panel" aria-labelledby={`lookup-tab-${tab}`} className="mt-6">
        {tab === 'kinship' ? <KinshipBody graph={graph} /> : <NameCheckPanel treeId={treeId} graph={graph} />}
      </div>
    </>
  );
};

const KinshipBody = ({ graph }: { graph: FamilyGraph<Person> }) => {
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const aToB = aId && bId ? relationTerm(graph, aId, bId) : null;
  const bToA = aId && bId ? relationTerm(graph, bId, aId) : null;

  return (
    <>
      <p className="text-ink-muted">Chọn hai Người để xem cách xưng hô, suy từ Cha mẹ và Vợ chồng đã ghi.</p>
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
