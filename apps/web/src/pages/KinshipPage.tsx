import { useState } from 'react';
import { useParams } from 'react-router';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { describeRelation, type Relation } from '../family/kinship';
import { NameCheckPanel } from '../family/NameCheckPanel';
import { PersonPicker } from '../people/PersonPicker';
import { personLabel } from '../people/person-label';
import { TreePageShell } from '../tree/TreePageShell';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';

/** Tra cứu: xưng hô giữa hai Người, và trùng tên khi đặt tên cho Bé. */
export const KinshipPage = () => {
  const { treeId = '' } = useParams();
  return <TreePageShell treeId={treeId}>{({ graph }) => <LookupBody treeId={treeId} graph={graph} />}</TreePageShell>;
};

type LookupTab = 'kinship' | 'naming';
const LOOKUP_TABS: readonly { value: LookupTab; label: string }[] = [
  { value: 'kinship', label: 'Quan hệ, xưng hô' },
  { value: 'naming', label: 'Đặt tên cho Bé' },
];

const LookupBody = ({ treeId, graph }: { treeId: string; graph: FamilyGraph<Person> }) => {
  const [tab, setTab] = useState<LookupTab>('kinship');
  return (
    <>
      <h1 className="font-serif text-3xl font-bold text-son">Tra cứu</h1>
      <Segmented
        label="Loại tra cứu"
        className="mt-4"
        options={LOOKUP_TABS}
        value={tab}
        onChange={setTab}
        tabs={{ idPrefix: 'lookup-tab', panelId: 'lookup-panel' }}
      />
      <div role="tabpanel" id="lookup-panel" aria-labelledby={`lookup-tab-${tab}`} className="mt-6">
        {tab === 'kinship' ? <KinshipBody graph={graph} /> : <NameCheckPanel treeId={treeId} graph={graph} />}
      </div>
    </>
  );
};

const KinshipBody = ({ graph }: { graph: FamilyGraph<Person> }) => {
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const aToB = aId && bId ? describeRelation(graph, aId, bId) : null;
  const bToA = aId && bId ? describeRelation(graph, bId, aId) : null;

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
            <ResultLine subject={personLabel(graph, aId)} relation={bToA} object={personLabel(graph, bId)} />
            <ResultLine subject={personLabel(graph, bId)} relation={aToB} object={personLabel(graph, aId)} />
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

const ResultLine = ({ subject, relation, object }: { subject: string; relation: Relation | null; object: string }) => (
  <p>
    <strong>{subject}</strong> gọi <strong>{object}</strong> là{' '}
    {relation ? <span className="font-semibold text-son">{relation.term}</span> : <span className="text-ink-muted">không rõ quan hệ</span>}.
    {relation?.via && <span className="text-ink-muted"> ({relation.via})</span>}
  </p>
);
