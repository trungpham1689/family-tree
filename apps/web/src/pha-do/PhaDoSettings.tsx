import { useId, useMemo, useState, type ReactNode } from 'react';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { OUTSIDE_OPTIONS, outsideLabel } from '../family/outside-generations';
import { personLabel } from '../people/person-label';
import { PersonPicker } from '../people/PersonPicker';
import {
  CUSTOM_CM_MAX,
  CUSTOM_CM_MIN,
  EXTRA_LINE_LABELS,
  FONT_FAMILY_LABELS,
  FONT_PX_MAX,
  FONT_PX_MIN,
  PAPER_SIZES,
  pageSizeMm,
  type ExtraLine,
  type PaperName,
  type PhaDoConfig,
  type PhaDoFontFamily,
} from './config';
import { DECOR_FONTS } from './decoration-fonts';
import { defaultTitle, DECOR_LOOKS, FRAME_LABELS, LOOK_LABELS, paletteOf, type Decoration, type DecorLook, type FrameStyle } from './decoration';
import { useFrameThumbnails } from './frame-thumbnails';
import { defaultMemberColors } from './render';
import { Chip } from '../ui/Chip';
import { Select, TextField } from '../ui/fields';
import { Segmented } from '../ui/Segmented';
import { onTabKeyDown } from '../ui/tab-keys';

/** Ba nhóm thiết lập của thanh bên: mỗi lúc chỉ hiện một nhóm để thanh bên ngắn gọn. */
export type SettingsTab = 'content' | 'decoration' | 'paper';

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'content', label: 'Nội dung', icon: 'M4 5h12M4 10h12M4 15h8' },
  { id: 'decoration', label: 'Trang trí', icon: 'M10 2.5l2.2 4.9 5.3.5-4 3.6 1.2 5.3L10 14l-4.7 2.8 1.2-5.3-4-3.6 5.3-.5z' },
  { id: 'paper', label: 'Khổ giấy & chữ', icon: 'M5 2.5h7l4 4v11H5zM12 2.5v4h4' },
];

export const SettingsTabs = ({ tab, onChange }: { tab: SettingsTab; onChange: (tab: SettingsTab) => void }) => (
  <div
    role="tablist"
    aria-label="Nhóm thiết lập"
    className="flex border-b border-line bg-paper/60"
    onKeyDown={(event) => onTabKeyDown(event, TABS.map((item) => item.id), tab, onChange, (id) => `pha-do-tab-${id}`)}
  >
    {TABS.map((item) => {
      const on = tab === item.id;
      return (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`pha-do-tab-${item.id}`}
          aria-selected={on}
          tabIndex={on ? 0 : -1}
          aria-controls="pha-do-panel"
          onClick={() => onChange(item.id)}
          className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-sm ${
            on ? 'font-bold text-son shadow-[inset_0_-3px_0_var(--color-son)]' : 'font-medium text-ink-muted hover:text-ink'
          }`}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 fill-none stroke-current" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d={item.icon} />
          </svg>
          <span className="max-w-full truncate">{item.label}</span>
        </button>
      );
    })}
  </div>
);

const SECTION_LABEL_CLASS = 'mb-2 flex items-baseline justify-between gap-2 text-xs font-bold uppercase tracking-wider text-ink-muted';

/** Nhãn nhóm thiết lập; truyền `htmlFor` thì là <label> của ô nhập tương ứng (không lồng <p> trong <label>). */
const SectionLabel = ({ children, aside, htmlFor }: { children: ReactNode; aside?: ReactNode; htmlFor?: string }) => {
  const content = (
    <>
      <span>{children}</span>
      {aside && <span className="font-medium normal-case tracking-normal">{aside}</span>}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} className={SECTION_LABEL_CLASS}>
      {content}
    </label>
  ) : (
    <p className={SECTION_LABEL_CLASS}>{content}</p>
  );
};

const Note = ({ children }: { children: ReactNode }) => <p className="mt-2 text-sm text-ink-muted">{children}</p>;

const FRAME_STYLES = Object.keys(FRAME_LABELS) as FrameStyle[];
const shortLabel = (frame: FrameStyle) => FRAME_LABELS[frame].split(' (')[0]!;

/** Chọn kiểu khung: cả 12 ảnh xem trước luôn hiện (6 cột), bấm một lần là chọn; tên kiểu đang chọn nằm cạnh tiêu đề. */
const FramePicker = ({ frame, onChange }: { frame: FrameStyle; onChange: (frame: FrameStyle) => void }) => {
  const thumbnails = useFrameThumbnails(FRAME_STYLES);
  return (
    <section>
      <SectionLabel aside={<span className="font-semibold text-son">{shortLabel(frame)}</span>}>Kiểu khung</SectionLabel>
      <div role="radiogroup" aria-label="Kiểu khung" className="grid grid-cols-6 gap-2">
        {FRAME_STYLES.map((style) => (
          <label
            key={style}
            title={FRAME_LABELS[style]}
            className={`relative block min-w-0 cursor-pointer rounded-md has-focus-visible:outline-3 has-focus-visible:outline-focus ${
              frame === style ? 'ring-2 ring-son ring-offset-2' : 'opacity-90 hover:opacity-100'
            }`}
          >
            <input type="radio" name="frame-style" className="sr-only" aria-label={FRAME_LABELS[style]} checked={frame === style} onChange={() => onChange(style)} />
            {thumbnails.get(style) ? (
              <img src={thumbnails.get(style)} alt="" className="block aspect-[3/4] w-full rounded-sm border border-line bg-white object-cover" />
            ) : (
              <span aria-hidden="true" className="block aspect-[3/4] w-full animate-pulse rounded-sm border border-line bg-paper" />
            )}
          </label>
        ))}
      </div>
    </section>
  );
};

/**
 * Chọn phương án nền, màu chữ, phông chữ của khung đang chọn: mỗi nút là một mẫu giấy (đúng màu nền, màu tiêu đề, phông tiêu đề),
 * nên nhìn là biết phương án nào hợp ý. Tên phương án nằm cạnh tiêu đề.
 */
const LookPicker = ({ frame, look, onChange }: { frame: FrameStyle; look: DecorLook; onChange: (look: DecorLook) => void }) => (
  <section>
    <SectionLabel aside={<span className="font-semibold text-son">{LOOK_LABELS[look]}</span>}>Nền, màu chữ, phông chữ</SectionLabel>
    <div role="radiogroup" aria-label="Phương án nền, màu chữ, phông chữ" className="grid grid-cols-2 gap-2">
      {DECOR_LOOKS.map((option) => {
        const palette = paletteOf(frame, option);
        const on = look === option;
        return (
          <label
            key={option}
            className={`relative block min-w-0 cursor-pointer rounded-xl has-focus-visible:outline-3 has-focus-visible:outline-focus ${
              on ? 'ring-2 ring-son ring-offset-2' : 'hover:opacity-100'
            }`}
          >
            <input type="radio" name="decor-look" className="sr-only" checked={on} onChange={() => onChange(option)} aria-label={`${option}: ${LOOK_LABELS[option]}`} />
            <span className="block rounded-xl border border-line px-3 py-3 text-center" style={{ backgroundColor: palette.background }}>
              <span
                className="block truncate text-xl leading-tight"
                style={{ color: palette.title, fontFamily: DECOR_FONTS[palette.titleFont].css, fontWeight: 700 }}
              >
                Gia phả
              </span>
              <span className="mt-1 block truncate text-sm" style={{ color: palette.text, fontFamily: DECOR_FONTS[palette.bodyFont].css }}>
                Tổ tông muôn đời
              </span>
            </span>
            <span className="mt-1 block text-center text-sm font-medium">
              {option} · {LOOK_LABELS[option]}
            </span>
          </label>
        );
      })}
    </div>
  </section>
);

const NUMBER_CONTROL = 'min-h-12 w-full rounded-xl border border-line bg-surface px-4 tabular-nums disabled:bg-paper disabled:text-ink-muted';

/**
 * Ô nhập số có đơn vị. Đang gõ thì giữ nguyên chữ người dùng gõ (không bóp về min/max giữa chừng nên gõ "150" không bị
 * đổi thành "10" ngay ở phím "1"); chỉ báo ra ngoài khi là số hợp lệ trong khoảng; rời ô thì kẹp vào khoảng. Không đang gõ thì
 * luôn hiện giá trị hiện hành, nên giá trị đổi từ nơi khác (ví dụ khổ giấy tự tính) hiện ra ngay.
 */
const NumberField = ({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  compact = false,
  disabled = false,
  ariaLabel,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Gọn, nhãn cùng hàng với ô nhập (dùng cạnh dòng chữ mà nó điều khiển). */
  compact?: boolean;
  disabled?: boolean;
  /** Tên đọc cho trình đọc màn hình khi nhãn nhìn thấy quá ngắn (nhiều ô cùng nhãn "Cỡ chữ"). */
  ariaLabel?: string;
  onChange: (value: number) => void;
}) => {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const inRange = (text: string) => {
    const parsed = Number(text);
    return text.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
  };
  return (
    <div className={compact ? 'flex items-center gap-2' : 'min-w-0'}>
      <label htmlFor={id} className={compact ? 'shrink-0 text-sm text-ink-muted' : 'mb-1 block text-sm text-ink-muted'}>
        {label}
      </label>
      <div className="relative min-w-0">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
          className={compact ? 'min-h-10 w-24 rounded-lg border border-line bg-surface pl-3 pr-8 tabular-nums' : `${NUMBER_CONTROL} pr-11`}
          value={draft ?? String(value)}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = inRange(event.target.value);
            if (parsed !== null) onChange(parsed);
          }}
          onBlur={() => {
            const parsed = Number(draft);
            if (draft !== null && draft.trim() !== '' && Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
            setDraft(null);
          }}
        />
        <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 flex items-center text-sm text-ink-muted ${compact ? 'right-2' : 'right-3'}`}>
          {unit}
        </span>
      </div>
    </div>
  );
};

const SizeField = ({
  label = 'Cỡ chữ',
  ariaLabel,
  compact,
  value,
  onChange,
}: {
  label?: string;
  ariaLabel?: string;
  compact?: boolean;
  value: number;
  onChange: (px: number) => void;
}) => (
  <NumberField
    label={label}
    unit="px"
    min={FONT_PX_MIN}
    max={FONT_PX_MAX}
    value={value}
    onChange={onChange}
    {...(compact !== undefined ? { compact } : {})}
    {...(ariaLabel ? { ariaLabel } : {})}
  />
);

/** Một dòng chữ trang trí: tên ở trái, cỡ chữ của chính nó ở phải cùng hàng, ô chữ đầy chiều ngang bên dưới. */
const TextWithSize = ({
  label,
  placeholder,
  maxLength,
  text,
  onText,
  size,
  onSize,
}: {
  label: string;
  placeholder: string;
  maxLength: number;
  text: string;
  onText: (text: string) => void;
  size: number;
  onSize: (px: number) => void;
}) => {
  const id = useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <SizeField compact ariaLabel={`Cỡ chữ ${label.toLowerCase()}`} value={size} onChange={onSize} />
      </div>
      <input
        id={id}
        className="min-h-12 w-full rounded-xl border border-line bg-surface px-4"
        placeholder={placeholder}
        maxLength={maxLength}
        value={text}
        onChange={(event) => onText(event.target.value)}
      />
    </div>
  );
};

export const DecorationSettings = ({
  treeName,
  decoration,
  autoPaper,
  sizeScale,
  onChange,
}: {
  treeName: string;
  decoration: Decoration;
  /** Khổ giấy tự động: cỡ chữ trang trí tự giảm dần khi khổ lớn hơn A1 (xem `autoDecorationScale`). */
  autoPaper: boolean;
  /** Hệ số cỡ chữ trang trí của khổ hiện tại (`decorationScaleOf`): các ô cỡ chữ hiện cỡ thật = cỡ đã lưu × hệ số, đổi khổ thì số đổi theo. */
  sizeScale: number;
  onChange: (patch: Partial<Decoration>) => void;
}) => {
  const shown = (px: number) => Number((px * sizeScale).toFixed(1));
  const stored = (px: number) => Math.min(FONT_PX_MAX, Math.max(FONT_PX_MIN, px / sizeScale));
  return (
  <div className="min-w-0 space-y-6">
    <FramePicker frame={decoration.frame} onChange={(frame) => onChange({ frame })} />
    <LookPicker frame={decoration.frame} look={decoration.look} onChange={(look) => onChange({ look })} />

    <section className="space-y-4">
      <SectionLabel>Chữ trang trí</SectionLabel>
      <TextWithSize
        label="Tiêu đề"
        placeholder={defaultTitle(treeName)}
        maxLength={120}
        text={decoration.title}
        onText={(title) => onChange({ title })}
        size={shown(decoration.titleSize)}
        onSize={(titleSize) => onChange({ titleSize: stored(titleSize) })}
      />
      <TextWithSize
        label="Phụ đề"
        placeholder="Kính dâng tổ tiên – năm 2026"
        maxLength={200}
        text={decoration.subtitle}
        onText={(subtitle) => onChange({ subtitle })}
        size={shown(decoration.subtitleSize)}
        onSize={(subtitleSize) => onChange({ subtitleSize: stored(subtitleSize) })}
      />
      <fieldset className="min-w-0 space-y-3 rounded-xl border border-line p-3">
        <legend className="sr-only">Câu đối</legend>
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">Câu đối</p>
          <SizeField compact ariaLabel="Cỡ chữ câu đối" value={shown(decoration.coupletSize)} onChange={(coupletSize) => onChange({ coupletSize: stored(coupletSize) })} />
        </div>
        <TextField
          label="Vế bên trái"
          placeholder="Uống nước nhớ nguồn"
          maxLength={200}
          value={decoration.coupletLeft}
          onChange={(event) => onChange({ coupletLeft: event.target.value })}
        />
        <TextField
          label="Vế bên phải"
          placeholder="Ăn quả nhớ kẻ trồng cây"
          maxLength={200}
          value={decoration.coupletRight}
          onChange={(event) => onChange({ coupletRight: event.target.value })}
        />
        <p className="text-sm text-ink-muted">Viết dọc, mỗi chữ một dòng, hai bên Phả đồ.</p>
      </fieldset>
      <Note>
        Cỡ chữ (px) tính trên trang có cạnh ngắn 1000 px, tự co giãn theo khổ giấy nên đổi khổ giấy vẫn giữ đúng tỉ lệ.
        {autoPaper
          ? ' Khổ giấy tự động: từ khổ A1 trở lên, cỡ chữ trang trí tự giảm dần theo khổ (chiều cao chữ thật vẫn tăng, nhưng chậm hơn khổ giấy) để tiêu đề không át cả cây; các ô cỡ chữ hiện đúng cỡ đang dùng.'
          : ''}{' '}
        Chữ vẫn tự co lại nếu không đủ chỗ.
      </Note>
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
  // Chi chọn được: các con của Thuỷ tổ và mọi Người "Lập chi mới" ở Đời sâu hơn, xếp theo thứ bậc trong danh sách Đời.
  const branchRoots = useMemo(() => {
    const rank = new Map(graph.generations().flatMap((group) => group.persons).map((person, index) => [person.id, index]));
    const children = progenitor ? graph.childrenOf(progenitor.id).map(({ person }) => person) : [];
    const founders = graph.persons.filter((person) => person.founds_branch && rank.has(person.id));
    const unique = new Map([...children, ...founders].map((person) => [person.id, person]));
    return [...unique.values()].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  }, [graph, progenitor]);
  const scope = config.scope;

  return (
    <section>
      <SectionLabel>Phạm vi in</SectionLabel>
      <Segmented
        label="Phạm vi in"
        value={scope.kind}
        options={[
          { value: 'all', label: 'Cả gia phả' },
          { value: 'branch', label: 'Một Chi' },
          { value: 'from-person', label: 'Từ một người' },
        ]}
        onChange={(kind) => {
          if (kind === 'all') onChange({ scope: { kind: 'all' } });
          else if (kind === 'branch') {
            const first = branchRoots[0];
            if (first) onChange({ scope: { kind: 'branch', personId: first.id } });
          } else onChange({ scope: { kind: 'from-person', personId: progenitor?.id ?? '', depth: 3 } });
        }}
      />
      {scope.kind === 'branch' && (
        <Select
          aria-label="Chọn Chi"
          className="mt-3 w-full"
          value={scope.personId}
          onChange={(event) => onChange({ scope: { kind: 'branch', personId: event.target.value } })}
        >
          {branchRoots.map((person) => (
            <option key={person.id} value={person.id}>
              Chi {person.full_name} (Đời {graph.placement(person.id).generation})
            </option>
          ))}
        </Select>
      )}
      {scope.kind === 'from-person' && (
        <div className="mt-3 space-y-3 rounded-xl border border-line p-3">
          <p className="font-medium">{graph.person(scope.personId) ? personLabel(graph, scope.personId) : 'Chưa chọn người'}</p>
          <PersonPicker graph={graph} label="Đổi người" onPick={(personId) => onChange({ scope: { ...scope, personId } })} />
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
    </section>
  );
};

/** Tab "Nội dung": phạm vi in, Cháu ngoại, và những gì hiện trong mỗi ô. */
export const ContentSettings = ({
  graph,
  config,
  onChange,
}: {
  graph: FamilyGraph<Person>;
  config: PhaDoConfig;
  onChange: (patch: Partial<PhaDoConfig>) => void;
}) => {
  const full = config.extraLines.length >= 2;
  const toggleLine = (line: ExtraLine) =>
    onChange({ extraLines: config.extraLines.includes(line) ? config.extraLines.filter((item) => item !== line) : [...config.extraLines, line] });
  return (
    <div className="min-w-0 space-y-6">
      <ScopeSettings graph={graph} config={config} onChange={onChange} />

      <section>
        <SectionLabel htmlFor="pha-do-outside">Cháu ngoại</SectionLabel>
        <Select
          id="pha-do-outside"
          className="w-full"
          value={config.outsideGenerations}
          onChange={(event) => onChange({ outsideGenerations: Number(event.target.value) })}
        >
          {OUTSIDE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {outsideLabel(n)}
            </option>
          ))}
        </Select>
      </section>

      <section>
        <SectionLabel aside={`Chữ: ${config.extraLines.length}/2 dòng`}>Trong mỗi ô</SectionLabel>
        <div className="flex flex-wrap gap-2">
          <Chip on={config.showAvatars} onClick={() => onChange({ showAvatars: !config.showAvatars })}>
            Ảnh đại diện
          </Chip>
          {(Object.keys(EXTRA_LINE_LABELS) as ExtraLine[]).map((line) => {
            const on = config.extraLines.includes(line);
            return (
              <Chip key={line} on={on} disabled={!on && full} onClick={() => toggleLine(line)}>
                {EXTRA_LINE_LABELS[line]}
              </Chip>
            );
          })}
        </div>
        <Note>Luôn có tên và năm sinh – mất. Thêm tối đa 2 dòng chữ.</Note>
      </section>
    </div>
  );
};

type PaperChoice = 'auto' | PaperName;
const PAPER_CHOICES: { value: PaperChoice; label: string }[] = [
  { value: 'auto', label: 'Tự động' },
  ...(Object.keys(PAPER_SIZES) as (keyof typeof PAPER_SIZES)[]).map((name) => ({ value: name, label: name })),
  { value: 'custom', label: 'Tự nhập' },
];

const round1 = (value: number) => Math.round(value * 10) / 10;

export const PaperSettings = ({
  config,
  onChange,
  onAuto,
  onOrientationChange,
}: {
  config: PhaDoConfig;
  /** Người dùng chọn khổ/kích thước cụ thể (giữ khổ đó, cỡ chữ tự chỉnh theo). */
  onChange: (patch: Partial<PhaDoConfig>) => void;
  /** Bật khổ tự động: khổ tự co giãn theo nội dung. */
  onAuto: () => void;
  onOrientationChange: (orientation: PhaDoConfig['orientation']) => void;
}) => {
  const choice: PaperChoice = config.autoPaper ? 'auto' : config.paper;
  const page = pageSizeMm(config);
  const editable = choice === 'custom';
  return (
    <section>
      <SectionLabel>Khổ giấy</SectionLabel>
      <div role="radiogroup" aria-label="Khổ giấy" className="grid grid-cols-3 gap-2">
        {PAPER_CHOICES.map((option) => {
          const on = option.value === choice;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                if (option.value === 'auto') onAuto();
                else if (option.value === 'custom') onChange({ paper: 'custom', customWidthCm: round1(page.width / 10), customHeightCm: round1(page.height / 10) });
                else onChange({ paper: option.value });
              }}
              className={`min-h-11 rounded-xl border-[1.5px] text-sm ${on ? 'border-son bg-son/7 font-bold text-son' : 'border-line bg-surface font-medium'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <NumberField
          label="Rộng"
          unit="cm"
          min={CUSTOM_CM_MIN}
          max={CUSTOM_CM_MAX}
          step={0.1}
          disabled={!editable}
          value={editable ? config.customWidthCm : round1(page.width / 10)}
          onChange={(customWidthCm) => onChange({ customWidthCm })}
        />
        <span aria-hidden="true" className="pb-3 text-ink-muted">
          ×
        </span>
        <NumberField
          label="Cao"
          unit="cm"
          min={CUSTOM_CM_MIN}
          max={CUSTOM_CM_MAX}
          step={0.1}
          disabled={!editable}
          value={editable ? config.customHeightCm : round1(page.height / 10)}
          onChange={(customHeightCm) => onChange({ customHeightCm })}
        />
      </div>
      <div className="mt-3">
        <Segmented
          label="Hướng giấy"
          value={config.orientation}
          options={[
            { value: 'landscape', label: 'Ngang' },
            { value: 'portrait', label: 'Dọc' },
          ]}
          onChange={onOrientationChange}
        />
      </div>
      <Note>
        {choice === 'auto'
          ? 'Khổ giấy tự co giãn theo nội dung (người, ô, khung, tiêu đề, câu đối…): đổi gì, mọi thứ vẫn vừa khít khung. Chọn một khổ hoặc "Tự nhập" để cố định.'
          : 'Khổ cố định: khi nội dung đổi, cỡ chữ tự chỉnh cho vừa khổ này. Chọn "Tự động" để khổ giấy tự co giãn theo nội dung.'}
      </Note>
    </section>
  );
};

/** Chọn một màu; "Gốc" trả về màu như trước khi tuỳ chỉnh (null). */
const ColorField = ({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (color: string | null) => void;
}) => {
  const id = useId();
  return (
    <div className="flex min-h-12 min-w-0 items-center gap-2 rounded-xl border border-line bg-surface pl-1.5 pr-2">
      <input
        id={id}
        type="color"
        className="size-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
        value={value ?? fallback}
        onChange={(event) => onChange(event.target.value)}
      />
      <label htmlFor={id} className="min-w-0 flex-1 text-sm font-semibold">
        {label}
      </label>
      {value !== null && (
        <button type="button" aria-label={`Về ${label.toLowerCase()} mặc định`} className="min-h-9 shrink-0 px-1 text-sm text-son underline" onClick={() => onChange(null)}>
          Gốc
        </button>
      )}
    </div>
  );
};

export const FontSettings = ({
  config,
  namePx,
  onChange,
  onMemberFontChange,
}: {
  config: PhaDoConfig;
  /** Cỡ chữ tên thực tế sau khi co cho vừa khổ giấy (null nếu chưa có bản vẽ). */
  namePx: number | null;
  onChange: (patch: Partial<PhaDoConfig>) => void;
  /** Đổi cỡ chữ ô; khổ giấy tự co giãn. */
  onMemberFontChange: (px: number) => void;
}) => (
  <section>
    <SectionLabel>Chữ trong ô thành viên</SectionLabel>
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
      <SizeField label="Cỡ chữ" ariaLabel="Cỡ chữ tên trong ô thành viên" value={config.memberFontPx} onChange={onMemberFontChange} />
      <div>
        <label htmlFor="pha-do-font-family" className="mb-1 block text-sm text-ink-muted">
          Phông chữ
        </label>
        <Select
          id="pha-do-font-family"
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
      </div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <ColorField
        label="Màu chữ"
        value={config.memberTextColor}
        fallback={defaultMemberColors(config.decoration.frame).text}
        onChange={(memberTextColor) => onChange({ memberTextColor })}
      />
      <ColorField
        label="Màu nền"
        value={config.memberFillColor}
        fallback={defaultMemberColors(config.decoration.frame).fill}
        onChange={(memberFillColor) => onChange({ memberFillColor })}
      />
    </div>
    <Note>
      {namePx !== null && namePx < config.memberFontPx - 0.05
        ? `Chữ tên đang co lại còn khoảng ${namePx.toFixed(1)} px vì không đủ chỗ trên khổ giấy này. Hãy in một Chi, hoặc giảm cỡ chữ.`
        : 'Đổi cỡ chữ thì khổ giấy tự co giãn cho vừa khít. Viền ô vẫn theo giới tính; nền ô Dâu/Rể mặc định đậm hơn một nấc; màu chữ và nền ô mặc định đổi theo kiểu khung.'}
    </Note>
    <p className="mt-1 text-sm text-ink-muted">"Theo kiểu khung" dùng phông riêng của từng khung (Noto Serif, Merriweather, Lora…). Bản xuất PDF/PNG dùng đúng phông đã chọn (riêng "Chữ hệ thống" xuất bằng Noto Serif).</p>
  </section>
);

/** Tab "Khổ giấy & chữ". */
export const PaperTab = ({
  config,
  namePx,
  onPaper,
  onAuto,
  onOrientationChange,
  onChange,
  onMemberFontChange,
}: {
  config: PhaDoConfig;
  namePx: number | null;
  onPaper: (patch: Partial<PhaDoConfig>) => void;
  onAuto: () => void;
  onOrientationChange: (orientation: PhaDoConfig['orientation']) => void;
  onChange: (patch: Partial<PhaDoConfig>) => void;
  onMemberFontChange: (px: number) => void;
}) => (
  <div className="min-w-0 space-y-6">
    <PaperSettings config={config} onChange={onPaper} onAuto={onAuto} onOrientationChange={onOrientationChange} />
    <FontSettings config={config} namePx={namePx} onChange={onChange} onMemberFontChange={onMemberFontChange} />
  </div>
);
