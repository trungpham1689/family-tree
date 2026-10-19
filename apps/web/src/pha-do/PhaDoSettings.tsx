import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { personLabel } from '../people/person-label';
import { PersonPicker } from '../people/PersonPicker';
import {
  FONT_FAMILY_LABELS,
  FONT_SCALE_OPTIONS,
  PAPER_SIZES,
  type PaperName,
  type PhaDoConfig,
  type PhaDoFontFamily,
} from './config';
import { defaultTitle, FRAME_LABELS, type Decoration, type FrameStyle } from './decoration';
import { Select, TextField } from '../ui/fields';

export const DecorationSettings = ({
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

export const ScopeSettings = ({
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

export const PaperSettings = ({ config, onChange }: { config: PhaDoConfig; onChange: (patch: Partial<PhaDoConfig>) => void }) => (
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

const FONT_SCALE_LABELS: Record<(typeof FONT_SCALE_OPTIONS)[number], string> = {
  0.75: 'Nhỏ',
  1: 'Vừa',
  1.3: 'Lớn',
  1.6: 'Rất lớn',
};

export const FontSettings = ({ config, onChange }: { config: PhaDoConfig; onChange: (patch: Partial<PhaDoConfig>) => void }) => (
  <fieldset className="space-y-2 border-t border-line pt-3">
    <legend className="mb-1 font-medium">Cỡ chữ</legend>
    <div className="grid grid-cols-4 gap-2">
      {FONT_SCALE_OPTIONS.map((scale) => (
        <label
          key={scale}
          className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-1 text-center text-sm ${
            config.fontScale === scale ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
          }`}
        >
          <input type="radio" className="sr-only" checked={config.fontScale === scale} onChange={() => onChange({ fontScale: scale })} />
          {FONT_SCALE_LABELS[scale]}
        </label>
      ))}
    </div>
    <p className="text-sm text-ink-muted">Chữ vẫn tự co lại nếu không đủ chỗ trên khổ giấy đã chọn.</p>

    <label className="block pt-2">
      <span className="mb-1 block font-medium">Phông chữ</span>
      <Select
        className="w-full"
        value={config.fontFamily}
        onChange={(event) => onChange({ fontFamily: event.target.value as PhaDoFontFamily })}
      >
        {(Object.keys(FONT_FAMILY_LABELS) as PhaDoFontFamily[]).map((family) => (
          <option key={family} value={family}>
            {FONT_FAMILY_LABELS[family]}
          </option>
        ))}
      </Select>
      <span className="mt-1 block text-sm text-ink-muted">
        Bản xuất PDF/PNG dùng đúng phông đã chọn ở đây (riêng "Chữ hệ thống" không có file để nhúng, xuất tạm bằng Noto Serif).
      </span>
    </label>
  </fieldset>
);
