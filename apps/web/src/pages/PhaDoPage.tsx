import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { loadFontBinary } from '../data/pha-do';
import { useFamily, usePersonAvatars, usePhaDoConfig, useSavePhaDoConfig, useTree } from '../data/tree-queries';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { personLabel } from '../people/person-label';
import { PersonPicker } from '../people/PersonPicker';
import {
  EXTRA_LINE_LABELS,
  PAPER_SIZES,
  readPhaDoConfig,
  type ExtraLine,
  type PaperName,
  type PhaDoConfig,
} from '../pha-do/config';
import { defaultTitle, FRAME_LABELS, type Decoration, type FrameStyle } from '../pha-do/decoration';
import { DESKTOP_LIMITS, IOS_LIMITS, isAppleMobile, planPng } from '../pha-do/png';
import { renderPhaDo } from '../pha-do/render';
import { drawingToSvg } from '../pha-do/svg';
import { TreeTabs } from '../tree/TreeTabs';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner, Select, TextField } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';

/** Thiết kế bản in Phả đồ: phạm vi, khổ giấy, nội dung ô; xem trước đúng như bản in và xuất PDF vector. */
export const PhaDoPage = () => {
  const { treeId = '' } = useParams();
  const tree = useTree(treeId);
  const family = useFamily(treeId);
  const saved = usePhaDoConfig(treeId);

  if (tree.isPending || family.isPending || saved.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error ?? saved.error;

  return (
    <>
      <AppHeader />
      <TreeTabs treeId={treeId} />
      <main className="mx-auto max-w-7xl px-4 py-6">
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
  const [exporting, setExporting] = useState<'pdf' | 'png' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const save = useSavePhaDoConfig(tree.id);
  const canEdit = tree.role === 'owner' || tree.role === 'editor';

  const avatars = usePersonAvatars(graph.persons, config.showAvatars);
  const result = useMemo(
    () => renderPhaDo(graph, config, tree.name, avatars.data),
    [graph, config, tree.name, avatars.data],
  );
  const pngPlan = useMemo(
    () => planPng(result.drawing, isAppleMobile() ? IOS_LIMITS : DESKTOP_LIMITS),
    [result.drawing],
  );
  const svg = useMemo(() => drawingToSvg(result.drawing), [result]);
  const update = (patch: Partial<PhaDoConfig>) => setConfig((current) => ({ ...current, ...patch }));

  const paperLabel = config.paper === 'custom' ? `${config.customWidthCm}x${config.customHeightCm}cm` : config.paper;
  const loadFonts = async () => {
    const [regular, bold] = await Promise.all([
      loadFontBinary('/fonts/NotoSerif-400Regular.ttf'),
      loadFontBinary('/fonts/NotoSerif-700Bold.ttf'),
    ]);
    return { regular, bold };
  };

  const exportPdf = async () => {
    setExporting('pdf');
    setExportError(null);
    try {
      const [{ drawingToPdf }, fonts] = await Promise.all([import('../pha-do/pdf'), loadFonts()]);
      drawingToPdf(result.drawing, fonts, `Gia phả ${tree.name}`).save(`pha-do-${paperLabel}.pdf`);
    } catch {
      setExportError('Không tạo được file PDF. Hãy thử lại.');
    } finally {
      setExporting(null);
    }
  };

  const exportPng = async () => {
    setExporting('png');
    setExportError(null);
    try {
      const [{ renderPng }, { downloadBlob }, fonts] = await Promise.all([
        import('../pha-do/png-export'),
        import('../lib/download'),
        loadFonts(),
      ]);
      downloadBlob(await renderPng(result.drawing, fonts, pngPlan), `pha-do-${paperLabel}-${pngPlan.dpi}dpi.png`);
    } catch {
      setExportError('Không tạo được ảnh PNG (trình duyệt có thể thiếu bộ nhớ). Hãy thử khổ nhỏ hơn hoặc dùng PDF.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="space-y-6">
        <ScopeSettings graph={graph} config={config} onChange={update} />
        <DecorationSettings treeName={tree.name} decoration={config.decoration} onChange={(patch) => update({ decoration: { ...config.decoration, ...patch } })} />

        <label className="block">
          <span className="mb-1 block font-medium">Hiển thị</span>
          <Select className="w-full" value={config.outsideGenerations} onChange={(event) => update({ outsideGenerations: Number(event.target.value) })}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Chỉ đinh' : `Hiện Cháu ngoại ${n} đời`}
              </option>
            ))}
          </Select>
        </label>

        <PaperSettings config={config} onChange={update} />

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

        <div className="space-y-3 border-t border-line pt-4">
          <Button className="w-full" disabled={exporting !== null || result.personCount === 0} onClick={exportPdf}>
            {exporting === 'pdf' ? 'Đang tạo PDF…' : 'Xuất PDF (in ấn)'}
          </Button>
          <Button variant="secondary" className="w-full" disabled={exporting !== null || result.personCount === 0} onClick={exportPng}>
            {exporting === 'png' ? 'Đang vẽ ảnh PNG…' : `Xuất ảnh PNG (${pngPlan.dpi} dpi)`}
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

const DecorationSettings = ({
  treeName,
  decoration,
  onChange,
}: {
  treeName: string;
  decoration: Decoration;
  onChange: (patch: Partial<Decoration>) => void;
}) => (
  <fieldset className="space-y-3">
    <legend className="mb-1 font-medium">Trang trí</legend>
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(FRAME_LABELS) as FrameStyle[]).map((frame) => (
        <label
          key={frame}
          className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm ${
            decoration.frame === frame ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
          }`}
        >
          <input type="radio" className="sr-only" checked={decoration.frame === frame} onChange={() => onChange({ frame })} />
          {FRAME_LABELS[frame]}
        </label>
      ))}
    </div>
    <TextField
      label="Tiêu đề"
      placeholder={defaultTitle(treeName)}
      maxLength={120}
      value={decoration.title}
      onChange={(event) => onChange({ title: event.target.value })}
    />
    <TextField
      label="Phụ đề"
      placeholder="Kính dâng tổ tiên – năm 2026"
      maxLength={200}
      value={decoration.subtitle}
      onChange={(event) => onChange({ subtitle: event.target.value })}
    />
    <TextField
      label="Câu đối – vế bên trái"
      placeholder="Uống nước nhớ nguồn"
      maxLength={200}
      value={decoration.coupletLeft}
      onChange={(event) => onChange({ coupletLeft: event.target.value })}
    />
    <TextField
      label="Câu đối – vế bên phải"
      placeholder="Ăn quả nhớ kẻ trồng cây"
      maxLength={200}
      value={decoration.coupletRight}
      onChange={(event) => onChange({ coupletRight: event.target.value })}
    />
    <p className="text-sm text-ink-muted">Câu đối viết dọc, mỗi chữ một dòng, hai bên Phả đồ.</p>
  </fieldset>
);

const ScopeSettings = ({
  graph,
  config,
  onChange,
}: {
  graph: FamilyGraph<Person>;
  config: PhaDoConfig;
  onChange: (patch: Partial<PhaDoConfig>) => void;
}) => {
  const progenitor = graph.persons.find((person) => person.is_progenitor);
  const branchRoots = progenitor ? graph.childrenOf(progenitor.id).map(({ person }) => person) : [];
  const scope = config.scope;

  const option = (kind: PhaDoConfig['scope']['kind'], label: string, onPick: () => void) => (
    <label
      className={`flex min-h-12 cursor-pointer items-center rounded-xl border px-4 ${
        scope.kind === kind ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
      }`}
    >
      <input type="radio" className="sr-only" checked={scope.kind === kind} onChange={onPick} />
      {label}
    </label>
  );

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 font-medium">Phạm vi in</legend>
      {option('all', 'Cả gia phả', () => onChange({ scope: { kind: 'all' } }))}
      {option('branch', 'Một Chi', () => {
        const first = branchRoots[0];
        if (first) onChange({ scope: { kind: 'branch', personId: first.id } });
      })}
      {scope.kind === 'branch' && (
        <Select
          aria-label="Chọn Chi"
          className="w-full"
          value={scope.personId}
          onChange={(event) => onChange({ scope: { kind: 'branch', personId: event.target.value } })}
        >
          {branchRoots.map((person) => (
            <option key={person.id} value={person.id}>
              Chi {person.full_name}
            </option>
          ))}
        </Select>
      )}
      {option('from-person', 'Từ một người xuống N đời', () =>
        onChange({ scope: { kind: 'from-person', personId: progenitor?.id ?? '', depth: 3 } }),
      )}
      {scope.kind === 'from-person' && (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <p className="font-medium">{graph.person(scope.personId) ? personLabel(graph, scope.personId) : 'Chưa chọn người'}</p>
          <PersonPicker
            graph={graph}
            label="Đổi người"
            onPick={(personId) => onChange({ scope: { ...scope, personId } })}
          />
          <TextField
            label="Số đời bên dưới"
            type="number"
            min={1}
            max={30}
            value={scope.depth}
            onChange={(event) => {
              const depth = Number(event.target.value);
              if (Number.isInteger(depth) && depth >= 1 && depth <= 30) onChange({ scope: { ...scope, depth } });
            }}
          />
        </div>
      )}
    </fieldset>
  );
};

const PaperSettings = ({ config, onChange }: { config: PhaDoConfig; onChange: (patch: Partial<PhaDoConfig>) => void }) => (
  <fieldset className="space-y-2">
    <legend className="mb-1 font-medium">Khổ giấy</legend>
    <Select
      aria-label="Khổ giấy"
      className="w-full"
      value={config.paper}
      onChange={(event) => onChange({ paper: event.target.value as PaperName })}
    >
      {(Object.keys(PAPER_SIZES) as (keyof typeof PAPER_SIZES)[]).map((name) => (
        <option key={name} value={name}>
          {name} ({PAPER_SIZES[name].width / 10} × {PAPER_SIZES[name].height / 10} cm)
        </option>
      ))}
      <option value="custom">Tự nhập kích thước</option>
    </Select>
    {config.paper === 'custom' && (
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Rộng (cm)"
          type="number"
          min={10}
          max={500}
          value={config.customWidthCm}
          onChange={(event) => onChange({ customWidthCm: Math.min(500, Math.max(10, Number(event.target.value) || 10)) })}
        />
        <TextField
          label="Cao (cm)"
          type="number"
          min={10}
          max={500}
          value={config.customHeightCm}
          onChange={(event) => onChange({ customHeightCm: Math.min(500, Math.max(10, Number(event.target.value) || 10)) })}
        />
      </div>
    )}
    <div className="flex gap-2">
      {(['landscape', 'portrait'] as const).map((orientation) => (
        <label
          key={orientation}
          className={`flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 ${
            config.orientation === orientation ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
          }`}
        >
          <input
            type="radio"
            className="sr-only"
            checked={config.orientation === orientation}
            onChange={() => onChange({ orientation })}
          />
          {orientation === 'landscape' ? 'Ngang' : 'Dọc'}
        </label>
      ))}
    </div>
  </fieldset>
);
