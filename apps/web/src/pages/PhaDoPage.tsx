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
import { FONT_FAMILY_CSS, readPhaDoConfig, type PhaDoConfig } from '../pha-do/config';
import { DESKTOP_LIMITS, IOS_LIMITS, isAppleMobile, planPng } from '../pha-do/png';
import { usePhaDoDesign } from '../pha-do/use-design';
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
      <main id="main" tabIndex={-1} className="focus:outline-none w-full px-4 pb-24 pt-6 lg:px-8 lg:pb-6">
        <h1 className="font-serif text-3xl font-bold text-son">Phả đồ</h1>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {tree.data && family.data && saved.isSuccess && (
          <PhaDoDesigner
            tree={tree.data}
            graph={family.data}
            initial={readPhaDoConfig(saved.data, tree.data.outside_generations)}
          />
        )}
      </main>
      <Footer />
    </>
  );
};

type Zoom = 'fit' | 1 | 2 | 4;
/** 96 dpi: 1 mm trên giấy = 3,78 px; mức phóng `n` hiện bản in ở n/4 kích thước thật (4 = 100%). */
const PX_PER_MM = 96 / 25.4;

const PhaDoDesigner = ({ tree, graph, initial }: { tree: TreeWithRole; graph: FamilyGraph<Person>; initial: PhaDoConfig }) => {
  const { config, change } = usePhaDoDesign({ graph, treeName: tree.name }, initial);
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
  const exportPdf = () => runExport('pha-do-pdf', { drawing: result.drawing, fontFamily: config.fontFamily });
  const exportPng = () => runExport('pha-do-png', { drawing: result.drawing, fontFamily: config.fontFamily, plan: pngPlan });

  const namePx = result.personCount > 0 ? result.namePx : null;
  // Ảnh đại diện còn đang tải: xuất bây giờ sẽ thiếu ảnh mà không báo gì.
  const loadingImages = avatars.isLoading;
  const cannotExport = exporting !== null || result.personCount === 0 || loadingImages;

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start">
      {/* Điện thoại: bản xem trước lên trước, thanh thiết lập ngay bên dưới. */}
      <aside className="order-2 flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:sticky lg:top-4 lg:order-1 lg:max-h-[calc(100dvh-2rem)] lg:min-h-[32rem]">
        <SettingsTabs tab={tab} onChange={setTab} />

        <div role="tabpanel" id="pha-do-panel" aria-labelledby={`pha-do-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === 'content' && <ContentSettings graph={graph} config={config} onChange={(patch) => change({ kind: 'content', patch })} />}
          {tab === 'decoration' && (
            <DecorationSettings treeName={tree.name} decoration={config.decoration} onChange={(patch) => change({ kind: 'content', patch: { decoration: { ...config.decoration, ...patch } } })} />
          )}
          {tab === 'paper' && (
            <PaperTab
              config={config}
              namePx={namePx}
              onPaper={(patch) => change({ kind: 'paper', patch })}
              onAuto={() => change({ kind: 'auto' })}
              onOrientationChange={(orientation) => change({ kind: 'content', patch: { orientation } })}
              onChange={(patch) => change({ kind: 'content', patch })}
              onMemberFontChange={(px) => change({ kind: 'font', px })}
            />
          )}
        </div>

        {/* Thanh xuất luôn hiện, bất kể đang ở tab nào. */}
        {/* Điện thoại: nút Xuất PDF/PNG nằm ở thanh dính đáy màn hình (cuối trang), ở đây chỉ còn Lưu cấu hình. */}
        <div className="space-y-2 border-t border-line bg-paper/60 px-5 pb-4 pt-3">
          <div className="hidden lg:block">{exportError && <ErrorBanner>{exportError}</ErrorBanner>}</div>
          {loadingImages && <p className="text-sm text-ink-muted">Đang tải ảnh đại diện…</p>}
          {save.isError && <ErrorBanner>{save.error.message}</ErrorBanner>}
          <div className="hidden lg:block">
            <Button className="w-full" disabled={cannotExport} onClick={exportPdf}>
              {exporting === 'pha-do-pdf' ? 'Đang tạo PDF…' : 'Xuất PDF (in ấn)'}
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="hidden min-w-0 flex-1 lg:block">
              <Button variant="secondary" className="w-full px-3" disabled={cannotExport} onClick={exportPng}>
                {exporting === 'pha-do-png' ? 'Đang vẽ…' : 'Xuất ảnh PNG'}
              </Button>
            </div>
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
          <p className="text-sm text-ink-muted">
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
          <div className="flex w-full gap-1 sm:w-auto" role="group" aria-label="Phóng to">
            {(['fit', 1, 2, 4] as const).map((level) => (
              <Button
                key={String(level)}
                variant={zoom === level ? 'primary' : 'secondary'}
                className="min-h-11 min-w-0 flex-1 px-2 text-sm sm:min-h-12 sm:flex-none sm:px-5 sm:text-base"
                onClick={() => setZoom(level)}
              >
                {level === 'fit' ? 'Vừa khung' : `${level * 25}%`}
              </Button>
            ))}
          </div>
          <p className="text-sm text-ink-muted sm:hidden">Bản xem trước đang thu nhỏ vừa màn hình. Chọn 50% trở lên rồi vuốt để đọc rõ chữ.</p>
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
            style={{ width: zoom === 'fit' ? '100%' : `${result.drawing.width * PX_PER_MM * (zoom / 4)}px` }}
            // SVG do chính app dựng, chữ đã được thoát ký tự (drawingToSvg).
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        {exportError && (
          <p role="alert" className="mb-2 text-sm text-danger">
            {exportError}
          </p>
        )}
        <div className="flex gap-2">
          <Button className="min-w-0 flex-1 px-3" disabled={cannotExport} onClick={exportPdf}>
            {exporting === 'pha-do-pdf' ? 'Đang tạo PDF…' : 'Xuất PDF'}
          </Button>
          <Button variant="secondary" className="min-w-0 flex-1 px-3" disabled={cannotExport} onClick={exportPng}>
            {exporting === 'pha-do-png' ? 'Đang vẽ…' : 'Xuất PNG'}
          </Button>
        </div>
      </div>
    </div>
  );
};
