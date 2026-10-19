import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { todayInVietnam } from '../calendar/month-grid';
import { loadFontBinary } from '../data/pha-do';
import { useFamily, useTree } from '../data/tree-queries';
import { anniversaryText } from '../people/person-display';
import { branchSummaries, buildNarrative, closingNote, notablePersons, originSummary } from '../pha-ky/narrative';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

/** Phả ký: văn bản tường thuật từng đời (khác Phả đồ, vốn là sơ đồ hình). */
export const PhaKyPage = () => {
  const { treeId = '' } = useParams();
  const tree = useTree(treeId);
  const family = useFamily(treeId);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const today = todayInVietnam();
  const generations = useMemo(() => (family.data ? buildNarrative(family.data) : []), [family.data]);
  const notable = useMemo(() => (family.data ? notablePersons(family.data) : []), [family.data]);
  const origin = useMemo(() => (family.data ? originSummary(family.data) : null), [family.data]);
  const branches = useMemo(() => (family.data ? branchSummaries(family.data) : []), [family.data]);

  if (tree.isPending || family.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error;

  const exportPdf = async () => {
    if (!tree.data) return;
    setExporting(true);
    setExportError(null);
    try {
      const [{ narrativeToPdf }, regular, bold] = await Promise.all([
        import('../pha-ky/pdf'),
        loadFontBinary('/fonts/NotoSerif-400Regular.ttf'),
        loadFontBinary('/fonts/NotoSerif-700Bold.ttf'),
      ]);

      const before = [
        tree.data.description ? { heading: 'Lời mở đầu', paragraphs: [tree.data.description] } : null,
        origin?.progenitorName
          ? {
              heading: 'Nguồn gốc và Thuỷ tổ',
              paragraphs: [
                `Dòng họ tôn ${origin.progenitorName} làm Thuỷ tổ — người đời đầu tiên còn ghi lại được.` +
                  (origin.hometown ? ` Quê quán tại ${origin.hometown}.` : ''),
                ...(origin.anniversaryDay !== null && origin.anniversaryMonth !== null
                  ? [`Giỗ Thuỷ tổ: ${anniversaryText({ day: origin.anniversaryDay, month: origin.anniversaryMonth }, today)}`]
                  : []),
                ...(origin.worshipPlace
                  ? [`Nơi thờ: ${origin.worshipPlace}${origin.worshipKeeper ? ` (người phụ trách: ${origin.worshipKeeper})` : ''}`]
                  : []),
                ...(origin.burialPlace ? [`Mộ tổ: ${origin.burialPlace}`] : []),
              ],
            }
          : null,
        branches.length > 1
          ? {
              heading: 'Các chi trong họ',
              paragraphs: branches.map((branch) => `${branch.founderName} — ${branch.memberCount} người.`),
            }
          : null,
        notable.length > 0
          ? {
              heading: 'Người có chức tước, công trạng',
              paragraphs: notable.map((person) => `${person.fullName} — ${person.title}`),
            }
          : null,
      ].filter((section) => section !== null);

      const after = generations.length > 0 ? [{ heading: 'Lời kết', paragraphs: [closingNote(today)] }] : [];

      narrativeToPdf(generations, { regular, bold }, `Phả ký ${tree.data.name}`, before, after).save(`pha-ky-${tree.data.name}.pdf`);
    } catch {
      setExportError('Không tạo được file PDF. Hãy thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <AppHeader />
      <TreeTabs treeId={treeId} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl font-bold text-son">Phả ký</h1>
          {generations.length > 0 && (
            <Button disabled={exporting} onClick={exportPdf}>
              {exporting ? 'Đang tạo…' : 'Xuất PDF'}
            </Button>
          )}
        </div>
        <p className="mt-1 text-ink-muted">Nguồn gốc, các chi, nhân vật tiêu biểu và văn bản tường thuật từng đời — suy từ dữ liệu Người đã ghi.</p>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {exportError && <ErrorBanner>{exportError}</ErrorBanner>}

        {family.isSuccess && (
          <div className="mt-6 space-y-8">
            {generations.length === 0 && <p className="text-ink-muted">Gia phả chưa có ai.</p>}

            {tree.data?.description && (
              <section aria-label="Lời mở đầu" className="rounded-2xl border border-son/30 bg-son/5 p-5">
                <h2 className="font-serif text-xl font-bold text-son">Lời mở đầu</h2>
                <p className="mt-2 whitespace-pre-line leading-relaxed italic">{tree.data.description}</p>
              </section>
            )}

            {origin?.progenitorName && (
              <section aria-label="Nguồn gốc và Thuỷ tổ" className="rounded-2xl border border-line bg-surface p-5">
                <h2 className="font-serif text-xl font-bold">Nguồn gốc và Thuỷ tổ</h2>
                <p className="mt-2 leading-relaxed">
                  Dòng họ tôn{' '}
                  <a href={`#${origin.progenitorId}`} className="font-semibold text-son hover:underline">
                    {origin.progenitorName}
                  </a>{' '}
                  làm Thuỷ tổ — người đời đầu tiên còn ghi lại được.
                  {origin.hometown && ` Quê quán tại ${origin.hometown}.`}
                </p>
                {(origin.anniversaryDay !== null || origin.worshipPlace || origin.burialPlace) && (
                  <ul className="mt-3 space-y-1 text-ink-muted">
                    {origin.anniversaryDay !== null && origin.anniversaryMonth !== null && (
                      <li>
                        Giỗ Thuỷ tổ: {anniversaryText({ day: origin.anniversaryDay, month: origin.anniversaryMonth }, today)}
                      </li>
                    )}
                    {origin.worshipPlace && (
                      <li>
                        Nơi thờ: {origin.worshipPlace}
                        {origin.worshipKeeper ? ` (người phụ trách: ${origin.worshipKeeper})` : ''}
                      </li>
                    )}
                    {origin.burialPlace && <li>Mộ tổ: {origin.burialPlace}</li>}
                  </ul>
                )}
              </section>
            )}

            {branches.length > 1 && (
              <section aria-label="Các chi trong họ" className="rounded-2xl border border-line bg-surface p-5">
                <h2 className="font-serif text-xl font-bold">Các chi trong họ</h2>
                <p className="mt-1 text-sm text-ink-muted">Mỗi chi do một người con của Thuỷ tổ (Đời 2) lập ra.</p>
                <ul className="mt-3 space-y-2">
                  {branches.map((branch) => (
                    <li key={branch.branchId}>
                      <a href={`#${branch.branchId}`} className="font-semibold text-son hover:underline">
                        {branch.founderName}
                      </a>
                      <span className="text-ink-muted"> — {branch.memberCount} người</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {notable.length > 0 && (
              <section aria-label="Người có chức tước, công trạng" className="rounded-2xl border border-line bg-surface p-5">
                <h2 className="font-serif text-xl font-bold">Người có chức tước, công trạng</h2>
                <p className="mt-1 text-sm text-ink-muted">Theo ô "Chức vụ / danh hiệu" trong hồ sơ từng người.</p>
                <ul className="mt-3 space-y-2">
                  {notable.map((person) => (
                    <li key={person.personId}>
                      <a href={`#${person.personId}`} className="font-semibold text-son hover:underline">
                        {person.fullName}
                      </a>
                      <span className="text-ink-muted"> — {person.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {generations.map((group) => (
              <section key={group.generation}>
                <h2 className="font-serif text-2xl font-bold">Đời {group.generation}</h2>
                <div className="mt-3 space-y-3">
                  {group.items.map((item) => (
                    <p key={item.personId} id={item.personId} className="leading-relaxed target:bg-kim-soft/40">
                      {item.text}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            {generations.length > 0 && (
              <section aria-label="Lời kết" className="rounded-2xl border border-dashed border-line px-5 py-4">
                <p className="leading-relaxed text-ink-muted italic">{closingNote(today)}</p>
              </section>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
};
