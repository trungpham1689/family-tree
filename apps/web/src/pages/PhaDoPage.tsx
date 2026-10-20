import { canEditTree } from '../data/permissions';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import {
  useFamily,
  usePersonAvatars,
  usePhaDoConfig,
  useSavePhaDoConfig,
  useTree,
} from '../data/tree-queries';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { FONT_FAMILY_CSS, hasStoredMemberFont, readPhaDoConfig, type PhaDoConfig } from '../pha-do/config';
import { DESKTOP_LIMITS, IOS_LIMITS, isAppleMobile, planPng } from '../pha-do/png';
import { autoMemberFontPx, fitPaperToFont } from '../pha-do/auto-fit';
import { renderPhaDo } from '../pha-do/render';
import { drawingToSvg } from '../pha-do/svg';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { useTreeExport } from '../export/use-tree-export';
import { FullPageMessage } from '../ui/FullPageMessage';
import { ContentSettings, DecorationSettings, PaperTab, SettingsTabs, type SettingsTab } from '../pha-do/PhaDoSettings';

/** Thiết kế bản in Phả đồ: phạm vi, khổ giấy, nội dung ô; xem trước đúng như bản in và xuất PDF vector. */
export const PhaDoPage = () => {
  const { treeId = '' } = useParams();
  const tree = useTree(treeId);
  const family = useFamily(treeId);
  const saved = usePhaDoConfig(treeId);
  // Form chỉ lấy cấu hình lúc dựng; bản khôi phục từ bộ nhớ đệm có thể cũ hơn bản vừa lưu, nên chờ lượt tải lại đầu tiên xong.
  const [settled, setSettled] = useState(false);
  if (!settled && saved.isSuccess && !saved.isFetching) setSettled(true);

  if (tree.isPending || family.isPending || saved.isPending || (saved.isSuccess && !settled)) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error ?? saved.error;

  return (
    <>
      <AppHeader />
      <TreeTabs treeId={treeId} />
      <main className="w-full px-4 py-6 lg:px-8">
        <h1 className="font-serif text-3xl font-bold text-son">Phả đồ</h1>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {tree.data && family.data && saved.isSuccess && (
          <PhaDoDesigner
            tree={tree.data}
            graph={family.data}
            initial={readPhaDoConfig(saved.data, tree.data.outside_generations)}
            fontStored={hasStoredMemberFont(saved.data)}
          />
        )}
      </main>
      <Footer />
    </>
  );
};

type Zoom = 'fit' | 1 | 2 | 4;

const PhaDoDesigner = ({
  tree,
  graph,
  initial,
  fontStored,
}: {
  tree: TreeWithRole;
  graph: FamilyGraph<Person>;
  initial: PhaDoConfig;
  /** Cấu hình đã lưu có cỡ chữ ô chưa; chưa thì lấy cỡ chữ đang hiện lúc mở lần đầu. */
  fontStored: boolean;
}) => {
  const [config, setConfig] = useState(() =>
    fontStored ? initial : { ...initial, memberFontPx: autoMemberFontPx(graph, initial, tree.name) },
  );
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [tab, setTab] = useState<SettingsTab>('content');
  const { running: exporting, error: exportError, run: runExport } = useTreeExport(tree.name);
  const save = useSavePhaDoConfig(tree.id);
  const canEdit = canEditTree(tree.role);

  const avatars = usePersonAvatars(graph.persons, config.showAvatars);
  const result = useMemo(
    () => renderPhaDo(graph, config, tree.name, avatars.data),
    [graph, config, tree.name, avatars.data],
  );
  const pngPlan = useMemo(
    () => planPng(result.drawing, isAppleMobile() ? IOS_LIMITS : DESKTOP_LIMITS),
    [result.drawing],
  );
  const svg = useMemo(() => drawingToSvg(result.drawing, undefined, FONT_FAMILY_CSS[config.fontFamily]), [result, config.fontFamily]);
  /**
   * Mọi thay đổi liên quan tới hiển thị đều tự co giãn cho vừa khít khung trang trí: khổ giấy tự tính theo nội dung (chế độ tự động),
   * hoặc, khi người dùng đã chọn một khổ cụ thể, cỡ chữ tự chỉnh cho vừa khổ đó.
   */
  const refit = (next: PhaDoConfig): PhaDoConfig =>
    next.autoPaper
      ? fitPaperToFont(graph, next, tree.name, avatars.data)
      : { ...next, memberFontPx: autoMemberFontPx(graph, next, tree.name, avatars.data) };
  const update = (patch: Partial<PhaDoConfig>) => setConfig((current) => refit({ ...current, ...patch }));
  /** Người dùng chọn khổ giấy/kích thước cụ thể: giữ khổ đó, cỡ chữ tự chỉnh theo. */
  const updatePaper = (patch: Partial<PhaDoConfig>) => setConfig((current) => refit({ ...current, ...patch, autoPaper: false }));

  const changeMemberFont = (memberFontPx: number) =>
    setConfig((current) => fitPaperToFont(graph, { ...current, memberFontPx, autoPaper: true }, tree.name, avatars.data));

  const exportPdf = () => runExport('pha-do-pdf', { drawing: result.drawing, fontFamily: config.fontFamily });
  const exportPng = () => runExport('pha-do-png', { drawing: result.drawing, fontFamily: config.fontFamily, plan: pngPlan });

  const setAuto = () => setConfig((current) => fitPaperToFont(graph, { ...current, autoPaper: true }, tree.name, avatars.data));
  const namePx = result.personCount > 0 ? result.namePx : null;

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start">
      {/* Điện thoại: bản xem trước lên trước, thanh thiết lập ngay bên dưới. */}
      <aside className="order-2 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:sticky lg:top-4 lg:order-1 lg:max-h-[calc(100dvh-2rem)] lg:min-h-[32rem]">
        <SettingsTabs tab={tab} onChange={setTab} />

        <div role="tabpanel" id="pha-do-panel" aria-labelledby={`pha-do-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'content' && <ContentSettings graph={graph} config={config} onChange={update} />}
          {tab === 'decoration' && (
            <DecorationSettings treeName={tree.name} decoration={config.decoration} onChange={(patch) => update({ decoration: { ...config.decoration, ...patch } })} />
          )}
          {tab === 'paper' && (
            <PaperTab
              config={config}
              namePx={namePx}
              onPaper={updatePaper}
              onAuto={setAuto}
              onOrientationChange={(orientation) => update({ orientation })}
              onChange={update}
              onMemberFontChange={changeMemberFont}
            />
          )}
        </div>

        {/* Thanh xuất luôn hiện, bất kể đang ở tab nào. */}
        <div className="space-y-2 border-t border-line bg-paper/60 px-5 pb-4 pt-3">
          {exportError && <ErrorBanner>{exportError}</ErrorBanner>}
          {save.isError && <ErrorBanner>{save.error.message}</ErrorBanner>}
          <Button className="w-full" disabled={exporting !== null || result.personCount === 0} onClick={exportPdf}>
            {exporting === 'pha-do-pdf' ? 'Đang tạo PDF…' : 'Xuất PDF (in ấn)'}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" className="min-w-0 flex-1 px-3" disabled={exporting !== null || result.personCount === 0} onClick={exportPng}>
              {exporting === 'pha-do-png' ? 'Đang vẽ…' : 'Xuất ảnh PNG'}
            </Button>
            {canEdit && (
              <Button
                variant="secondary"
                className="min-w-0 flex-1 px-3"
                disabled={save.isPending}
                onClick={() => save.mutate({ treeId: tree.id, config })}
              >
                {save.isPending ? 'Đang lưu…' : save.isSuccess ? 'Đã lưu cấu hình' : 'Lưu cấu hình'}
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-muted">
            Ảnh PNG {pngPlan.width} × {pngPlan.height} px ({pngPlan.dpi} dpi).
            {pngPlan.reduced && ` Khổ này vượt giới hạn ảnh của trình duyệt nên xuất ở ${pngPlan.dpi} dpi thay vì 300 dpi; PDF vẫn sắc nét ở mọi cỡ.`}
          </p>
        </div>
      </aside>

      <section aria-label="Xem trước bản in" className="order-1 min-w-0 space-y-3 lg:order-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-muted">
            {result.personCount} người · {result.drawing.width} × {result.drawing.height} mm · chữ tên ~{result.namePx.toFixed(1)} px
          </p>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Phóng to">
            {(['fit', 1, 2, 4] as const).map((level) => (
              <Button
                key={String(level)}
                variant={zoom === level ? 'primary' : 'secondary'}
                onClick={() => setZoom(level)}
              >
                {level === 'fit' ? 'Vừa khung' : `${level * 100}%`}
              </Button>
            ))}
          </div>
        </div>
        {result.missingRoot && (
          <ErrorBanner>Người được chọn làm gốc không còn trong gia phả. Hãy chọn lại phạm vi.</ErrorBanner>
        )}
        {result.warning && (
          <p role="alert" className="rounded-xl bg-kim-soft px-4 py-3 font-medium">
            ⚠ {result.warning}
          </p>
        )}
        <div className="max-h-[78dvh] overflow-auto rounded-2xl border border-line bg-paper p-4">
          <div
            className="mx-auto bg-white shadow-lg [&>svg]:h-auto [&>svg]:w-full"
            style={{ width: zoom === 'fit' ? '100%' : `${result.drawing.width * 3.78 * (zoom / 4)}px` }}
            // SVG do chính app dựng, chữ đã được thoát ký tự (drawingToSvg).
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </section>
    </div>
  );
};
