import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTreeExport } from '../export/use-tree-export';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { TreePageShell } from '../tree/TreePageShell';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { buildTimeline, KIND_LABEL, type TimelineKind } from '../family/timeline';
import { firstPhotoOfEvents, useEventPhotoImages, useEventPhotos, useTreeEvents } from '../data/calendar-queries';
import { personLabel } from '../people/person-label';

/** Màu nhãn từng loại mốc; PDF (family/timeline-pdf.ts) dùng đúng các màu này. */
const KIND_COLOR: Record<TimelineKind, string> = {
  sinh: 'text-la',
  cuoi: 'text-kim-text',
  mat: 'text-son',
  su_kien: 'text-[#26666e]',
  lich_su: 'text-tram',
};

/** Dòng thời gian của gia phả: sinh, cưới, mất theo năm, xen các mốc lịch sử Việt Nam. */
export const TimelinePage = () => {
  const { treeId = '' } = useParams();
  return <TreePageShell treeId={treeId}>{({ tree, graph }) => <TimelineBody tree={tree} graph={graph} />}</TreePageShell>;
};

const TimelineBody = ({ tree, graph }: { tree: TreeWithRole; graph: FamilyGraph<Person> }) => {
  const treeId = tree.id;
  const { running, error: exportError, run: runExport } = useTreeExport(tree.name);
  const [withHistory, setWithHistory] = useState(true);
  const treeEvents = useTreeEvents(treeId);
  const eventPhotos = useEventPhotos(treeId);
  const covers = useMemo(() => {
    const shown = new Set((treeEvents.data ?? []).filter((event) => event.show_in_timeline).map((event) => event.id));
    return [...firstPhotoOfEvents(eventPhotos.data ?? []).values()].filter((photo) => shown.has(photo.event_id));
  }, [treeEvents.data, eventPhotos.data]);
  const coverImages = useEventPhotoImages(covers);
  const baseEntries = useMemo(
    () => buildTimeline(graph.persons, graph.unions, withHistory, treeEvents.data ?? [], (personId) => (graph.person(personId) ? personLabel(graph, personId) : null)),
    [graph, withHistory, treeEvents.data],
  );
  // Gắn ảnh đầu tiên của sự kiện vào mốc (data URL, dùng cho cả trang và PDF).
  const entries = useMemo(() => {
    const byEvent = new Map(covers.flatMap((photo) => (coverImages.data?.get(photo.id) ? [[photo.event_id, coverImages.data.get(photo.id)!] as const] : [])));
    return baseEntries.map((entry) => (entry.eventId && byEvent.has(entry.eventId) ? { ...entry, photo: byEvent.get(entry.eventId)! } : entry));
  }, [baseEntries, covers, coverImages.data]);
  const years = useMemo(() => {
    const groups = new Map<number, typeof entries>();
    for (const entry of entries) groups.set(entry.year, [...(groups.get(entry.year) ?? []), entry]);
    return [...groups];
  }, [entries]);


  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-bold text-son">Dòng thời gian</h1>
        {entries.length > 0 && (
          <Button disabled={running !== null} onClick={() => runExport('timeline-pdf', { entries })}>
            {running !== null ? 'Đang tạo…' : 'Xuất PDF'}
          </Button>
        )}
      </div>
      <p className="mt-1 text-ink-muted">Những mốc sinh, cưới, mất và sự kiện của gia đình theo năm. Thêm ngày cưới ở trang của từng người; sự kiện thêm ở tab Sự kiện (chọn đưa vào Dòng thời gian).</p>
      {exportError && <ErrorBanner>{exportError}</ErrorBanner>}

      <label className="mt-4 flex min-h-11 items-center gap-3">
        <input type="checkbox" className="size-5" checked={withHistory} onChange={(event) => setWithHistory(event.target.checked)} />
        <span>Hiện mốc lịch sử Việt Nam</span>
      </label>

      {entries.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center text-ink-muted">
          Chưa có mốc nào: cần năm sinh, năm mất hoặc năm cưới của các Người.
        </p>
      )}

      <ol className="mt-6 border-b border-line">
        {years.map(([year, items]) => (
          <li key={year} className="grid grid-cols-[4.5rem_1fr] border-t border-line sm:grid-cols-[5.75rem_1fr] [contain-intrinsic-size:auto_96px] [content-visibility:auto]">
            <h2 className="border-r border-line py-3 font-serif text-2xl font-bold text-son">{year}</h2>
            <ul className="py-1.5 pl-3 sm:pl-5">
              {items.map((entry, index) => {
                const history = entry.kind === 'lich_su';
                const subject = entry.subject ?? '';
                return (
                  <li
                    key={`${entry.kind}-${entry.personId ?? entry.eventId ?? ''}-${index}`}
                    className={`grid grid-cols-[4.75rem_1fr] items-baseline gap-x-3 py-1.5 sm:grid-cols-[5.25rem_1fr] ${history ? '-ml-2 bg-[#f7f2e8] px-2' : ''}`}
                  >
                    <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${KIND_COLOR[entry.kind]}`}>{KIND_LABEL[entry.kind]}</span>
                    <span className={history ? 'text-ink-muted' : ''}>
                      {entry.personId && subject ? (
                        <>
                          <Link to={`/gia-pha/${treeId}/nguoi/${entry.personId}`} className="font-bold hover:text-son hover:underline">
                            {subject}
                          </Link>
                          {entry.text.slice(subject.length)}
                        </>
                      ) : entry.eventId ? (
                        <Link to={`/gia-pha/${treeId}/su-kien?xem=${entry.eventId}`} className="font-bold hover:text-son hover:underline">
                          {entry.text}
                        </Link>
                      ) : (
                        entry.text
                      )}
                      {entry.detail && <span className="text-sm text-ink-muted"> — {entry.detail}</span>}
                      {entry.description && <span className="mt-0.5 block whitespace-pre-line text-[15px] text-ink-muted">{entry.description}</span>}
                      {entry.photo && <img src={entry.photo} alt={entry.text} className="mt-1.5 max-h-32 max-w-56 border border-line object-cover" />}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
};
