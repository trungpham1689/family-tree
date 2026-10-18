import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { loadFontBinary } from '../data/pha-do';
import { useFamily, useTree } from '../data/tree-queries';
import { buildNarrative } from '../pha-ky/narrative';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { FullPageMessage } from '../ui/FullPageMessage';

/** Phả ký: văn bản tường thuật từng đời (khác Phả đồ, vốn là sơ đồ hình). */
export const PhaKyPage = () => {
  const { treeId = '' } = useParams();
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const tree = useTree(treeId);
  const family = useFamily(treeId);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const generations = useMemo(() => (family.data ? buildNarrative(family.data) : []), [family.data]);

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
      narrativeToPdf(generations, { regular, bold }, `Phả ký ${tree.data.name}`).save(`pha-ky-${tree.data.name}.pdf`);
    } catch {
      setExportError('Không tạo được file PDF. Hãy thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <AppHeader email={email} />
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
        <p className="mt-1 text-ink-muted">Văn bản tường thuật từng đời, suy từ dữ liệu Người đã ghi.</p>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {exportError && <ErrorBanner>{exportError}</ErrorBanner>}

        {family.isSuccess && (
          <div className="mt-6 space-y-8">
            {generations.length === 0 && <p className="text-ink-muted">Gia phả chưa có ai.</p>}
            {generations.map((group) => (
              <section key={group.generation}>
                <h2 className="font-serif text-2xl font-bold">Đời {group.generation}</h2>
                <div className="mt-3 space-y-3">
                  {group.items.map((item) => (
                    <p key={item.personId} className="leading-relaxed">
                      {item.text}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
};
