import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { TreePageShell } from '../tree/TreePageShell';
import { buildTimeline, type TimelineKind } from '../family/timeline';

const KIND_STYLE: Record<TimelineKind, { icon: string; dot: string }> = {
  sinh: { icon: '🌱', dot: 'bg-la' },
  cuoi: { icon: '💍', dot: 'bg-kim' },
  mat: { icon: '🕯️', dot: 'bg-son' },
  lich_su: { icon: '📜', dot: 'bg-tram' },
};

/** Dòng thời gian của gia phả: sinh, cưới, mất theo năm, xen các mốc lịch sử Việt Nam. */
export const TimelinePage = () => {
  const { treeId = '' } = useParams();
  return <TreePageShell treeId={treeId}>{({ graph }) => <TimelineBody treeId={treeId} graph={graph} />}</TreePageShell>;
};

const TimelineBody = ({ treeId, graph }: { treeId: string; graph: FamilyGraph<Person> }) => {
  const [withHistory, setWithHistory] = useState(true);
  const entries = useMemo(
    () => buildTimeline(graph.persons, graph.unions, withHistory),
    [graph, withHistory],
  );
  const years = useMemo(() => {
    const groups = new Map<number, typeof entries>();
    for (const entry of entries) groups.set(entry.year, [...(groups.get(entry.year) ?? []), entry]);
    return [...groups];
  }, [entries]);


  return (
    <>
      <h1 className="font-serif text-3xl font-bold text-son">Dòng thời gian</h1>
      <p className="mt-1 text-ink-muted">Những mốc sinh, cưới, mất của gia đình theo năm. Thêm ngày cưới ở trang của từng người.</p>

      <label className="mt-4 flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5" checked={withHistory} onChange={(event) => setWithHistory(event.target.checked)} />
        <span>Hiện mốc lịch sử Việt Nam</span>
      </label>

      {entries.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-muted">
          Chưa có mốc nào: cần năm sinh, năm mất hoặc năm cưới của các Người.
        </p>
      )}

      <ol className="mt-6 border-l-2 border-line pl-6">
        {years.map(([year, items]) => (
          <li key={year} className="relative pb-6 [contain-intrinsic-size:auto_96px] [content-visibility:auto]">
            <span aria-hidden="true" className="absolute -left-[33px] top-1 size-3 rounded-full border-2 border-paper bg-son" />
            <h2 className="font-serif text-xl font-bold text-son">{year}</h2>
            <ul className="mt-1 space-y-2">
              {items.map((entry, index) => (
                <li key={`${entry.kind}-${entry.personId ?? ''}-${index}`} className="flex items-start gap-2">
                  <span aria-hidden="true">{KIND_STYLE[entry.kind].icon}</span>
                  <span className={entry.kind === 'lich_su' ? 'text-ink-muted italic' : ''}>
                    {entry.personId ? (
                      <Link to={`/gia-pha/${treeId}/nguoi/${entry.personId}`} className="font-semibold hover:text-son hover:underline">
                        {entry.text}
                      </Link>
                    ) : (
                      entry.text
                    )}
                    {entry.detail && <span className="text-ink-muted"> — {entry.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
};
