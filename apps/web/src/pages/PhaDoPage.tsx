import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { loadFontBinary } from '../data/pha-do';
import { useFamily, usePhaDoConfig, useSavePhaDoConfig, useTree } from '../data/tree-queries';
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
import { renderPhaDo } from '../pha-do/render';
import { drawingToSvg } from '../pha-do/svg';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner, TextField } from '../ui/fields';
import { FullPageMessage } from '../ui/FullPageMessage';

/** Thiết kế bản in Phả đồ: phạm vi, khổ giấy, nội dung ô; xem trước đúng như bản in và xuất PDF vector. */
export const PhaDoPage = () => {
  const { treeId = '' } = useParams();
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const tree = useTree(treeId);
  const family = useFamily(treeId);
  const saved = usePhaDoConfig(treeId);

  if (tree.isPending || family.isPending || saved.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error ?? saved.error;

  return (
    <>
      <AppHeader email={email} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Link to={`/gia-pha/${treeId}`} className="text-ink-muted hover:text-son">
          ← {tree.data?.name ?? 'Gia phả'}
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-bold text-son">Phả đồ</h1>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {tree.data && family.data && saved.isSuccess && (
          <PhaDoDesigner
            tree={tree.data}
            graph={family.data}
            initial={readPhaDoConfig(saved.data, tree.data.outside_generations)}
          />
        )}
      </main>
    </>
  );
};

type Zoom = 'fit' | 1 | 2 | 4;

const PhaDoDesigner = ({ tree, graph, initial }: { tree: TreeWithRole; graph: FamilyGraph<Person>; initial: PhaDoConfig }) => {
  const [config, setConfig] = useState(initial);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const save = useSavePhaDoConfig(tree.id);
  const canEdit = tree.role === 'owner' || tree.role === 'editor';

  const result = useMemo(() => renderPhaDo(graph, config), [graph, config]);
  const svg = useMemo(() => drawingToSvg(result.drawing), [result]);
  const update = (patch: Partial<PhaDoConfig>) => setConfig((current) => ({ ...current, ...patch }));

  const exportPdf = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const [{ drawingToPdf }, regular, bold] = await Promise.all([
        import('../pha-do/pdf'),
        loadFontBinary('/fonts/NotoSerif-400Regular.ttf'),
        loadFontBinary('/fonts/NotoSerif-700Bold.ttf'),
      ]);
      const doc = drawingToPdf(result.drawing, { regular, bold }, `Gia phả ${tree.name}`);
      const paper = config.paper === 'custom' ? `${config.customWidthCm}x${config.customHeightCm}cm` : config.paper;
      doc.save(`pha-do-${paper}.pdf`);
    } catch {
      setExportError('Không tạo được file PDF. Hãy thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="space-y-6">
        <ScopeSettings graph={graph} config={config} onChange={update} />

        <label className="block">
          <span className="mb-1 block font-medium">Hiển thị</span>
          <select
            className="min-h-12 w-full rounded-xl border border-line bg-surface px-3"
            value={config.outsideGenerations}
            onChange={(event) => update({ outsideGenerations: Number(event.target.value) })}
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Chỉ đinh' : `Hiện Cháu ngoại ${n} đời`}
              </option>
            ))}
          </select>
        </label>

        <PaperSettings config={config} onChange={update} />

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
          <Button className="w-full" disabled={exporting || result.personCount === 0} onClick={exportPdf}>
            {exporting ? 'Đang tạo PDF…' : 'Xuất PDF'}
          </Button>
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
          <div className="flex gap-1" role="group" aria-label="Phóng to">
            {(['fit', 1, 2, 4] as const).map((level) => (
              <Button
                key={String(level)}
                variant={zoom === level ? 'primary' : 'secondary'}
                className="px-3"
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
        <select
          aria-label="Chọn Chi"
          className="min-h-12 w-full rounded-xl border border-line bg-surface px-3"
          value={scope.personId}
          onChange={(event) => onChange({ scope: { kind: 'branch', personId: event.target.value } })}
        >
          {branchRoots.map((person) => (
            <option key={person.id} value={person.id}>
              Chi {person.full_name}
            </option>
          ))}
        </select>
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
    <select
      aria-label="Khổ giấy"
      className="min-h-12 w-full rounded-xl border border-line bg-surface px-3"
      value={config.paper}
      onChange={(event) => onChange({ paper: event.target.value as PaperName })}
    >
      {(Object.keys(PAPER_SIZES) as (keyof typeof PAPER_SIZES)[]).map((name) => (
        <option key={name} value={name}>
          {name} ({PAPER_SIZES[name].width / 10} × {PAPER_SIZES[name].height / 10} cm)
        </option>
      ))}
      <option value="custom">Tự nhập kích thước</option>
    </select>
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
