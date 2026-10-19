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
import {
  EXTRA_LINE_LABELS,
  FONT_FAMILY_CSS,
  readPhaDoConfig,
  type ExtraLine,
  type PhaDoConfig,
} from '../pha-do/config';
import { DESKTOP_LIMITS, IOS_LIMITS, isAppleMobile, planPng } from '../pha-do/png';
import { renderPhaDo } from '../pha-do/render';
import { drawingToSvg } from '../pha-do/svg';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { Collapsible } from '../ui/Collapsible';
import { ErrorBanner, Select } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { OUTSIDE_OPTIONS, outsideLabel } from '../family/outside-generations';
import { useTreeExport } from '../export/use-tree-export';
import { FullPageMessage } from '../ui/FullPageMessage';
import { DecorationSettings, ScopeSettings, PaperSettings, FontSettings } from '../pha-do/PhaDoSettings';

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
          />
        )}
      </main>
      <Footer />
    </>
  );
};

type Zoom = 'fit' | 1 | 2 | 4;

const PhaDoDesigner = ({ tree, graph, initial }: { tree: TreeWithRole; graph: FamilyGraph<Person>; initial: PhaDoConfig }) => {
  const [config, setConfig] = useState(initial);
  const [zoom, setZoom] = useState<Zoom>('fit');
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
  const update = (patch: Partial<PhaDoConfig>) => setConfig((current) => ({ ...current, ...patch }));

  const exportPdf = () => runExport('pha-do-pdf', { drawing: result.drawing, fontFamily: config.fontFamily });
  const exportPng = () => runExport('pha-do-png', { drawing: result.drawing, fontFamily: config.fontFamily, plan: pngPlan });

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="space-y-3">
        <Collapsible title="Phạm vi & nội dung" defaultOpen>
          <ScopeSettings graph={graph} config={config} onChange={update} />

          <label className="block">
            <span className="mb-1 block font-medium">Hiển thị</span>
            <Select className="w-full" value={config.outsideGenerations} onChange={(event) => update({ outsideGenerations: Number(event.target.value) })}>
              {OUTSIDE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {outsideLabel(n)}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-son"
              checked={config.showAvatars}
              onChange={(event) => update({ showAvatars: event.target.checked })}
            />
            Hiện ảnh đại diện trong mỗi ô
          </label>

          <fieldset>
            <legend className="mb-1 font-medium">Thêm trong mỗi ô (tối đa 2 dòng)</legend>
            <p className="mb-2 text-sm text-ink-muted">Luôn có tên và năm sinh – mất.</p>
            {(Object.keys(EXTRA_LINE_LABELS) as ExtraLine[]).map((line) => {
              const checked = config.extraLines.includes(line);
              return (
                <label key={line} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-son"
                    checked={checked}
                    disabled={!checked && config.extraLines.length >= 2}
                    onChange={() =>
                      update({ extraLines: checked ? config.extraLines.filter((item) => item !== line) : [...config.extraLines, line] })
                    }
                  />
                  {EXTRA_LINE_LABELS[line]}
                </label>
              );
            })}
          </fieldset>
        </Collapsible>

        <Collapsible title="Trang trí" defaultOpen>
          <DecorationSettings treeName={tree.name} decoration={config.decoration} onChange={(patch) => update({ decoration: { ...config.decoration, ...patch } })} />
        </Collapsible>

        <Collapsible title="Khổ giấy & chữ">
          <PaperSettings config={config} onChange={update} />
          <FontSettings config={config} onChange={update} />
        </Collapsible>

        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <Button className="w-full" disabled={exporting !== null || result.personCount === 0} onClick={exportPdf}>
            {exporting === 'pha-do-pdf' ? 'Đang tạo PDF…' : 'Xuất PDF (in ấn)'}
          </Button>
          <Button variant="secondary" className="w-full" disabled={exporting !== null || result.personCount === 0} onClick={exportPng}>
            {exporting === 'pha-do-png' ? 'Đang vẽ ảnh PNG…' : `Xuất ảnh PNG (${pngPlan.dpi} dpi)`}
          </Button>
          <p className="text-sm text-ink-muted">
            Ảnh PNG {pngPlan.width} × {pngPlan.height} điểm ảnh.
            {pngPlan.reduced &&
              ` Khổ này lớn hơn giới hạn ảnh của trình duyệt nên sẽ xuất ở ${pngPlan.dpi} dpi thay vì 300 dpi; bản PDF vẫn sắc nét ở mọi cỡ.`}
          </p>
          {canEdit && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={save.isPending}
              onClick={() => save.mutate({ treeId: tree.id, config })}
            >
              {save.isPending ? 'Đang lưu…' : save.isSuccess ? 'Đã lưu cấu hình' : 'Lưu cấu hình để in lại'}
            </Button>
          )}
          {exportError && <ErrorBanner>{exportError}</ErrorBanner>}
          {save.isError && <ErrorBanner>{save.error.message}</ErrorBanner>}
        </div>
      </aside>

      <section aria-label="Xem trước bản in" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-muted">
            {result.personCount} người · {result.drawing.width} × {result.drawing.height} mm · chữ tên ~{result.namePt.toFixed(1)} pt
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
