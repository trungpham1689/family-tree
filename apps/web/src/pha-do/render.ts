import { layoutTree, outsideGenerationsFilter, wrapName } from '@gia-pha/tree-layout';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { lifespanText } from '../people/person-display';
import { pageSizeMm, type ExtraLine, type PhaDoConfig } from './config';
import { layoutDecoration } from './decoration';
import { fitSize, textWidthEm, truncateToFit } from './glyph-widths';
import { MM_PER_PX, paperScale, PT_PER_MM, type Drawing, type DrawItem } from './drawing';

/** Dưới cỡ này (px) chữ in ra khó đọc với người lớn tuổi. */
export const MIN_READABLE_PX = 8;

// Kích thước trong hệ toạ độ bố cục (đơn vị trừu tượng, cùng tỉ lệ với cỡ chữ bên dưới).
const BOX_WIDTH = 168;
const BASE_BOX_HEIGHT = 72;
const EXTRA_LINE_HEIGHT = 17;
const NAME_SIZE = 15;
const SMALL_SIZE = 12;
const NAME_CHARS = 18;
/** Lề trái + phải trong ô: chữ luôn nằm gọn trong chiều rộng còn lại. */
const BOX_PADDING = 10;
/** Dòng dài hơn ô thì thu nhỏ chữ cho vừa, tới tối thiểu bằng ngần này cỡ gốc; nhỏ hơn nữa thì cắt đuôi, thêm "…". */
const MIN_LINE_RATIO = 0.55;
const AVATAR_SIZE = 52;
const AVATAR_GAP = 6;
/** Dải chú giải (giới tính, đã mất) dưới cùng vùng cây, tính bằng mm trên khổ A1; khổ khác co giãn theo `paperScale`. */
const LEGEND_HEIGHT = 8;

/** Màu mặc định của chữ (tên) và nền ô thành viên; ô Dâu/Rể nền hơi ngả kem. */
export const DEFAULT_MEMBER_COLORS = { text: '#1f1a17', fill: '#ffffff' };

const COLORS = {
  ink: DEFAULT_MEMBER_COLORS.text,
  muted: '#5c534c',
  son: '#8a1c1c',
  kim: '#b8892b',
  line: '#5c534c',
  box: DEFAULT_MEMBER_COLORS.fill,
  spouseBox: '#fbf8f3',
  // Viền theo giới tính — nhận ra ngay không cần đọc chữ.
  genderUnknown: '#a39a8f',
};

export type PhaDoResult = {
  drawing: Drawing;
  personCount: number;
  /** Cỡ chữ tên thực tế quy ra px CSS (nhỏ hơn cỡ đã chọn nếu phải co lại cho vừa khổ giấy). */
  namePx: number;
  /** Cỡ chữ tên (px) mà khổ giấy hiện tại vừa khít cây; lớn hơn `namePx` khi cây ít người nên chữ chạm cỡ đã chọn trước. */
  fitNamePx: number;
  warning: string | null;
  /** Gốc của phạm vi không còn tồn tại (ví dụ Người đã bị xoá). */
  missingRoot: boolean;
};

/** Chữ vừa chiều rộng ô: thu nhỏ khi vượt, cắt đuôi khi phải thu quá nhiều. Không bao giờ để chữ tràn ra ngoài ô. */
const fitLine = (text: string, size: number, bold: boolean, maxWidth: number): { text: string; size: number } => {
  const fitted = fitSize(text, size, bold, maxWidth);
  if (fitted >= size * MIN_LINE_RATIO) return { text, size: fitted };
  const floor = size * MIN_LINE_RATIO;
  return { text: truncateToFit(text, floor, bold, maxWidth), size: floor };
};

const extraText = (line: ExtraLine, person: Person, generation: number | null): string | null => {
  switch (line) {
    case 'gio':
      return person.is_deceased && person.anniversary_day !== null && person.anniversary_month !== null
        ? `Giỗ ${person.anniversary_day}/${person.anniversary_month} ÂL`
        : null;
    case 'doi':
      return generation !== null ? `Đời ${generation}` : null;
    case 'que':
      return person.hometown;
  }
};

/**
 * Chú giải màu viền (giới tính) và nền (đã mất): một hàng trong dải LEGEND_HEIGHT dưới vùng cây.
 * Mỗi mục chiếm đúng một ô rộng bằng nhau (LEGEND_COL_WIDTH) nên khoảng cách luôn đều, không phụ
 * thuộc độ dài chữ của từng mục (ước lượng độ rộng theo ký tự vốn không đều giữa các nhãn).
 */
const LEGEND_COL_WIDTH = 32;
const LEGEND_TEXT_PT = 9;
const LEGEND_SWATCH = 3.5;
const LEGEND_LABEL_GAP = 2;
/** Mục cuối của chú giải bắt đầu ở cột thứ 5 cộng 0,8 cột (xem `legend`). */
const LEGEND_LAST_COL = 4.8;
const LEGEND_LAST_LABEL = 'Con nuôi';

/** Chiều ngang (mm) chú giải chiếm trên trang `page`, tính từ chính các hằng số vẽ chú giải để khổ giấy tự tính chừa đủ chỗ. */
export const legendWidthMm = (page: { width: number; height: number }): number =>
  paperScale(page) *
  (LEGEND_LAST_COL * LEGEND_COL_WIDTH + LEGEND_SWATCH + LEGEND_LABEL_GAP + (textWidthEm(LEGEND_LAST_LABEL, false) * LEGEND_TEXT_PT) / PT_PER_MM);

const legend = (area: { x: number; y: number; width: number; height: number }, k: number): DrawItem[] => {
  const y = area.y + area.height - (LEGEND_HEIGHT * k) / 2;
  const swatch = LEGEND_SWATCH * k;
  const labelGap = LEGEND_LABEL_GAP * k;
  const sizePt = LEGEND_TEXT_PT * k;
  let col = 0;
  const nextX = () => area.x + col++ * LEGEND_COL_WIDTH * k;
  const label = (x: number, text: string): DrawItem => ({ type: 'text', x, y, text, sizePt, bold: false, color: COLORS.muted, align: 'start' });
  const items: DrawItem[] = [];

  for (const [color, text] of [
    [COLORS.kim, 'Nam'],
    [COLORS.son, 'Nữ'],
  ] as const) {
    const x = nextX();
    items.push(
      { type: 'rect', x, y: y - swatch / 2, width: swatch, height: swatch, radius: k, fill: color, stroke: color, strokeWidth: 0 },
      label(x + swatch + labelGap, text),
    );
  }

  items.push(label(nextX(), '† Đã mất'));

  const dauReX = nextX();
  items.push(
    {
      type: 'rect',
      x: dauReX,
      y: y - swatch / 2,
      width: swatch,
      height: swatch,
      radius: k,
      fill: 'none',
      stroke: COLORS.muted,
      strokeWidth: 0.6 * k,
      dash: [1.2 * k, 0.8 * k],
    },
    label(dauReX + swatch + labelGap, 'Dâu/Rể (viền đứt)'),
  );

  const adoptedX = nextX() + LEGEND_COL_WIDTH * k * (LEGEND_LAST_COL - 4);
  items.push(
    { type: 'rect', x: adoptedX, y: y - swatch / 2, width: swatch, height: swatch, radius: swatch / 2, fill: COLORS.genderUnknown, stroke: COLORS.genderUnknown, strokeWidth: 0 },
    label(adoptedX + swatch + labelGap, LEGEND_LAST_LABEL),
  );
  return items;
};

const rootOf = (graph: FamilyGraph<Person>, config: PhaDoConfig): { rootId: string | null; maxDepth?: number } => {
  switch (config.scope.kind) {
    case 'all':
      return { rootId: graph.persons.find((person) => person.is_progenitor)?.id ?? null };
    case 'branch':
      return { rootId: config.scope.personId };
    case 'from-person':
      return { rootId: config.scope.personId, maxDepth: config.scope.depth };
  }
};

/** Xếp cây (đơn vị bố cục trừu tượng) theo phạm vi, số đời Cháu ngoại, dòng thêm và ảnh trong ô của cấu hình. */
export const treeLayout = (graph: FamilyGraph<Person>, config: PhaDoConfig, rootId: string, maxDepth?: number) => {
  const extras = config.extraLines.slice(0, 2);
  const boxHeight = BASE_BOX_HEIGHT + extras.length * EXTRA_LINE_HEIGHT + (config.showAvatars ? AVATAR_SIZE + AVATAR_GAP : 0);
  return layoutTree(graph, {
    rootId,
    ...(maxDepth !== undefined ? { maxDepth } : {}),
    includeChild: outsideGenerationsFilter(config.outsideGenerations),
    box: { width: BOX_WIDTH, height: boxHeight },
  });
};

/** Gốc và độ sâu của phạm vi in; `null` nếu gốc không còn trong gia phả. */
export const scopeRoot = (graph: FamilyGraph<Person>, config: PhaDoConfig): { rootId: string; maxDepth?: number } | null => {
  const { rootId, maxDepth } = rootOf(graph, config);
  return rootId && graph.person(rootId) ? { rootId, ...(maxDepth !== undefined ? { maxDepth } : {}) } : null;
};

/** Cỡ chữ tên trong bố cục (đơn vị bố cục) và dải chú giải, để tính khổ giấy vừa cây. */
export const LAYOUT_NAME_SIZE = NAME_SIZE;
export const legendHeightMm = (page: { width: number; height: number }) => LEGEND_HEIGHT * paperScale(page);

/** Dựng bản vẽ Phả đồ theo cấu hình: chọn phạm vi, xếp cây, co giãn vừa khổ giấy, kèm cảnh báo chữ nhỏ. */
export const renderPhaDo = (
  graph: FamilyGraph<Person>,
  config: PhaDoConfig,
  treeName = '',
  avatarUrls?: ReadonlyMap<string, string>,
): PhaDoResult => {
  const page = pageSizeMm(config);
  const { rootId, maxDepth } = rootOf(graph, config);
  const empty = { drawing: { ...page, items: [] }, personCount: 0, namePx: 0, fitNamePx: 0, warning: null };
  if (!rootId || !graph.person(rootId)) return { ...empty, missingRoot: true };

  const extras = config.extraLines.slice(0, 2);
  const layout = treeLayout(graph, config, rootId, maxDepth);

  const decoration = layoutDecoration(page, config.decoration, treeName);
  const area = decoration.content;
  const availableWidth = area.width;
  // Dành một dải mỏng dưới cùng vùng cây cho chú giải — trong vùng "content" nên chắc chắn không
  // đụng khung/hoạ tiết trang trí (những thứ đó nằm ngoài vùng này theo layoutDecoration).
  const k = paperScale(page);
  const availableHeight = area.height - LEGEND_HEIGHT * k;
  const fitScale = Math.min(availableWidth / layout.width, availableHeight / layout.height);
  const scale = Math.min(fitScale, (config.memberFontPx * MM_PER_PX) / NAME_SIZE);
  const namePx = (NAME_SIZE * scale) / MM_PER_PX;
  const fitNamePx = (NAME_SIZE * fitScale) / MM_PER_PX;

  // Căn giữa cây trong vùng còn trống.
  const offsetX = area.x + (availableWidth - layout.width * scale) / 2;
  const offsetY = area.y + (availableHeight - layout.height * scale) / 2;
  const mx = (x: number) => offsetX + x * scale;
  const my = (y: number) => offsetY + y * scale;

  const items: DrawItem[] = [...decoration.below];
  for (const line of layout.lines) {
    items.push({
      type: 'line',
      points: line.points.map(([x, y]) => [mx(x), my(y)]),
      stroke: line.kind === 'union' ? COLORS.kim : COLORS.line,
      strokeWidth: (line.kind === 'union' ? 2 : 1.5) * scale,
    });
  }

  for (const node of layout.nodes) {
    const person = graph.person(node.personId);
    if (!person) continue;
    const isSpouse = node.role === 'spouse';
    const adopted = graph.parentsOf(person.id).some((parent) => parent.kind === 'nuoi');
    const genderColor = person.gender === 'nam' ? COLORS.kim : person.gender === 'nu' ? COLORS.son : COLORS.genderUnknown;
    items.push({
      type: 'rect',
      x: mx(node.x),
      y: my(node.y),
      width: node.width * scale,
      height: node.height * scale,
      radius: 8 * scale,
      fill: config.memberFillColor ?? (isSpouse ? COLORS.spouseBox : COLORS.box),
      stroke: genderColor,
      strokeWidth: 2 * scale,
      // Dâu/Rể: kết hôn vào họ, không nối máu mủ — viền đứt để phân biệt với Đinh.
      ...(isSpouse ? { dash: [3 * scale, 1.5 * scale] } : {}),
    });
    if (adopted) {
      items.push({
        type: 'rect',
        x: mx(node.x) + 4 * scale,
        y: my(node.y + node.height) - 7 * scale,
        width: 3 * scale,
        height: 3 * scale,
        radius: 1.5 * scale,
        fill: COLORS.genderUnknown,
        stroke: COLORS.genderUnknown,
        strokeWidth: 0,
      });
    }
    const centerX = mx(node.x + node.width / 2);
    const nameLines = wrapName(person.full_name, NAME_CHARS).slice(0, 2);
    const lifespan = lifespanText(person);
    const detailLines = [
      lifespan && person.is_deceased ? `† ${lifespan}` : lifespan,
      ...extras.map((line) => extraText(line, person, graph.placement(person.id).generation)),
    ].filter((text): text is string => Boolean(text));
    const avatarUrl = config.showAvatars ? avatarUrls?.get(person.id) : undefined;
    // Xếp các dòng từ trên xuống, căn giữa theo chiều dọc của ô.
    const lineGap = 4;
    const blockHeight =
      (avatarUrl ? AVATAR_SIZE + AVATAR_GAP : 0) +
      nameLines.length * (NAME_SIZE + lineGap) +
      detailLines.length * (SMALL_SIZE + lineGap) -
      lineGap;
    let cursor = node.y + (node.height - blockHeight) / 2;
    if (avatarUrl) {
      items.push({
        type: 'image',
        x: mx(node.x + node.width / 2 - AVATAR_SIZE / 2),
        y: my(cursor),
        width: AVATAR_SIZE * scale,
        height: AVATAR_SIZE * scale,
        href: avatarUrl,
        // Viền ảnh theo giới tính; đã mất thì chuyển xám để thấy ngay trạng thái.
        round: { borderColor: person.is_deceased ? COLORS.muted : genderColor, borderWidth: 1.5 * scale },
      });
      cursor += AVATAR_SIZE + AVATAR_GAP;
    }
    for (const line of nameLines) {
      const { text, size } = fitLine(line, NAME_SIZE, !isSpouse, node.width - BOX_PADDING);
      items.push({ type: 'text', x: centerX, y: my(cursor + NAME_SIZE / 2), text, sizePt: size * scale * PT_PER_MM, bold: !isSpouse, color: config.memberTextColor ?? COLORS.ink });
      cursor += NAME_SIZE + lineGap;
    }
    for (const line of detailLines) {
      const { text, size } = fitLine(line, SMALL_SIZE, false, node.width - BOX_PADDING);
      items.push({ type: 'text', x: centerX, y: my(cursor + SMALL_SIZE / 2), text, sizePt: size * scale * PT_PER_MM, bold: false, color: config.memberTextColor ?? COLORS.muted });
      cursor += SMALL_SIZE + lineGap;
    }
  }

  const personCount = new Set(layout.nodes.map((node) => node.personId)).size;
  const warning =
    namePx < MIN_READABLE_PX
      ? `Chữ in ra chỉ khoảng ${namePx.toFixed(1)} px, rất khó đọc. Hãy chọn khổ giấy lớn hơn (A0 hoặc tự nhập) hoặc in tách theo từng Chi.`
      : null;

  items.push(...legend(area, k));
  items.push(...decoration.above);
  return { drawing: { ...page, items }, personCount, namePx, fitNamePx, warning, missingRoot: false };
};
