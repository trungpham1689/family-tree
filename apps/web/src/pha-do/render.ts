import { DEFAULT_BOX, layoutTree, MARRIAGE_LINE_HEIGHT, marriageExtraLines, NAME_CHARS, outsideGenerationsFilter, wrapName } from '@gia-pha/tree-layout';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { marriageNote } from '../family/labels';
import { lifespanText } from '../people/person-display';
import { fieldText } from '../people/profile-fields';
import { decorationScaleOf, pageSizeMm, type ExtraLine, type PhaDoConfig } from './config';
import { layoutDecoration, memberColorsOf, memberFontOf, type FrameStyle } from './decoration';
import { resolveBold, type DecorFontId } from './decoration-fonts';
import { fitSize, textWidthEm, truncateToFit } from './glyph-widths';
import { MM_PER_PX, paperScale, PT_PER_MM, type Drawing, type DrawItem } from './drawing';

/** Dưới cỡ này (px) chữ in ra khó đọc với người lớn tuổi. */
export const MIN_READABLE_PX = 8;

// Kích thước trong hệ toạ độ bố cục (đơn vị trừu tượng, cùng tỉ lệ với cỡ chữ bên dưới).
const BOX_WIDTH = DEFAULT_BOX.width;
const BASE_BOX_HEIGHT = DEFAULT_BOX.height;
const EXTRA_LINE_HEIGHT = 17;
const NAME_SIZE = 15;
const SMALL_SIZE = 12;
/** Lề trái + phải trong ô: chữ luôn nằm gọn trong chiều rộng còn lại. */
const BOX_PADDING = 10;
/** Dòng dài hơn ô thì thu nhỏ chữ cho vừa, tới tối thiểu bằng ngần này cỡ gốc; nhỏ hơn nữa thì cắt đuôi, thêm "…". */
const MIN_LINE_RATIO = 0.55;
const AVATAR_SIZE = 52;
const AVATAR_GAP = 6;
/** Dải chú giải (giới tính, đã mất) dưới cùng vùng cây, tính bằng mm trên khổ A1; khổ khác co giãn theo `paperScale`. */
const LEGEND_HEIGHT = 8;

/** Màu mặc định của chữ (tên) và nền ô thành viên theo kiểu khung (kiểu "Sáng", xem `MEMBER_COLORS`); ô Dâu/Rể nền hồng đào nhạt. */
export const defaultMemberColors = (frame: FrameStyle) => {
  const colors = memberColorsOf(frame);
  return { text: colors.name, fill: colors.fill };
};

const COLORS = {
  muted: '#5c534c',
  son: '#8a1c1c',
  kim: '#b8892b',
  line: '#5c534c',
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
const fitLine = (text: string, size: number, bold: boolean, maxWidth: number, font?: DecorFontId): { text: string; size: number } => {
  const fitted = fitSize(text, size, bold, maxWidth, font);
  if (fitted >= size * MIN_LINE_RATIO) return { text, size: fitted };
  const floor = size * MIN_LINE_RATIO;
  return { text: truncateToFit(text, floor, bold, maxWidth, font), size: floor };
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
      return fieldText(person, 'hometown') || null;
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
/** "Con nuôi" bắt đầu ở cột thứ 5 cộng 0,8 cột; mục cuối (chữ không kèm ô màu) ở cột thứ 6 trừ 0,2 cột (xem `legend`). */
const LEGEND_ADOPTED_COL = 4.8;
const LEGEND_LAST_COL = 5.8;
const LEGEND_LAST_LABEL = 'Vợ hai · goá = thứ tự · tình trạng hôn phối';
/** Cỡ chữ nhãn hôn phối trong ô (đơn vị bố cục); thấp hơn dòng chi tiết một chút. */
const MARRIAGE_SIZE = 11;

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

  const adoptedX = nextX() + LEGEND_COL_WIDTH * k * (LEGEND_ADOPTED_COL - 4);
  items.push(
    { type: 'rect', x: adoptedX, y: y - swatch / 2, width: swatch, height: swatch, radius: swatch / 2, fill: COLORS.genderUnknown, stroke: COLORS.genderUnknown, strokeWidth: 0 },
    label(adoptedX + swatch + labelGap, 'Con nuôi'),
    label(area.x + LEGEND_LAST_COL * LEGEND_COL_WIDTH * k, LEGEND_LAST_LABEL),
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

type TreeLayout = ReturnType<typeof layoutTree>;
const LAYOUT_CACHE_LIMIT = 6;
/** Theo từng đồ thị (đồ thị đổi thì bộ nhớ tự bỏ): xếp cây là phần tốn nhất, và đổi màu, chữ trang trí, khổ giấy không làm đổi nó. */
const layoutCache = new WeakMap<FamilyGraph<Person>, Map<string, TreeLayout>>();

/**
 * Xếp cây (đơn vị bố cục trừu tượng) theo phạm vi, số đời Cháu ngoại, dòng thêm và ảnh trong ô của cấu hình.
 * Có nhớ theo (gốc, độ sâu, Cháu ngoại, dòng thêm, ảnh); kết quả dùng chung, bên gọi chỉ đọc.
 */
export const treeLayout = (graph: FamilyGraph<Person>, config: PhaDoConfig, rootId: string, maxDepth?: number): TreeLayout => {
  const extras = config.extraLines.slice(0, 2);
  const key = [rootId, maxDepth ?? '', config.outsideGenerations, extras.join(','), config.showAvatars].join('|');
  let perGraph = layoutCache.get(graph);
  if (!perGraph) layoutCache.set(graph, (perGraph = new Map()));
  const cached = perGraph.get(key);
  if (cached) return cached;
  const boxHeight =
    BASE_BOX_HEIGHT + extras.length * EXTRA_LINE_HEIGHT + (config.showAvatars ? AVATAR_SIZE + AVATAR_GAP : 0) + marriageExtraLines(graph) * MARRIAGE_LINE_HEIGHT;
  const layout = layoutTree(graph, {
    rootId,
    ...(maxDepth !== undefined ? { maxDepth } : {}),
    includeChild: outsideGenerationsFilter(config.outsideGenerations),
    box: { width: BOX_WIDTH, height: boxHeight },
  });
  perGraph.set(key, layout);
  if (perGraph.size > LAYOUT_CACHE_LIMIT) perGraph.delete(perGraph.keys().next().value!);
  return layout;
};

/** Gốc và độ sâu của phạm vi in; `null` nếu gốc không còn trong gia phả. */
export const scopeRoot = (graph: FamilyGraph<Person>, config: PhaDoConfig): { rootId: string; maxDepth?: number } | null => {
  const { rootId, maxDepth } = rootOf(graph, config);
  return rootId && graph.person(rootId) ? { rootId, ...(maxDepth !== undefined ? { maxDepth } : {}) } : null;
};

/** Cỡ chữ tên trong bố cục (đơn vị bố cục) và dải chú giải, để tính khổ giấy vừa cây. */
export const LAYOUT_NAME_SIZE = NAME_SIZE;
export const legendHeightMm = (page: { width: number; height: number }) => LEGEND_HEIGHT * paperScale(page);

/** Tỉ lệ (đơn vị bố cục → mm) lớn nhất để cây nằm gọn trong vùng cây của trang, trừ dải chú giải. Dùng chung cho vẽ và cho việc tính khổ giấy. */
const fitScaleOf = (layout: { width: number; height: number }, area: { width: number; height: number }, page: { width: number; height: number }): number =>
  Math.min(area.width / layout.width, (area.height - LEGEND_HEIGHT * paperScale(page)) / layout.height);

/**
 * Cỡ chữ tên (px) lớn nhất mà khổ giấy của `config` chứa nổi, không dựng bản vẽ (chỉ xếp cây và bố trí trang trí, cả hai có nhớ).
 * `null` khi không có gì để vẽ (gốc đã xoá, phạm vi rỗng).
 */
export const fitNamePxFor = (graph: FamilyGraph<Person>, config: PhaDoConfig, treeName = ''): number | null => {
  const scope = scopeRoot(graph, config);
  if (!scope) return null;
  const layout = treeLayout(graph, config, scope.rootId, scope.maxDepth);
  if (layout.nodes.length === 0) return null;
  const page = pageSizeMm(config);
  const fitScale = fitScaleOf(layout, layoutDecoration(page, config.decoration, treeName, decorationScaleOf(config)).content, page);
  return (NAME_SIZE * fitScale) / MM_PER_PX;
};

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

  const decoration = layoutDecoration(page, config.decoration, treeName, decorationScaleOf(config));
  const member = memberColorsOf(config.decoration.frame);
  // "Theo kiểu khung": chữ trong ô mang phông riêng của khung (đo độ rộng theo chính phông đó); các lựa chọn khác dùng một phông chung nên không đặt phông riêng.
  const memberFont = config.fontFamily === 'frame' ? memberFontOf(config.decoration.frame) : undefined;
  const fontOf = (wantBold: boolean) => (memberFont ? { bold: resolveBold(memberFont, wantBold), font: memberFont } : { bold: wantBold });
  const area = decoration.content;
  const availableWidth = area.width;
  // Dành một dải mỏng dưới cùng vùng cây cho chú giải — trong vùng "content" nên chắc chắn không
  // đụng khung/hoạ tiết trang trí (những thứ đó nằm ngoài vùng này theo layoutDecoration).
  const k = paperScale(page);
  const availableHeight = area.height - LEGEND_HEIGHT * k;
  const fitScale = fitScaleOf(layout, area, page);
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
      fill: config.memberFillColor ?? (isSpouse ? member.spouse : member.fill),
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
    const note = node.marriage ? marriageNote(node.marriage, person.gender, (id) => graph.person(id)?.full_name) : null;
    const noteLines = [note?.label, note?.also].filter((text): text is string => Boolean(text));
    const avatarUrl = config.showAvatars ? avatarUrls?.get(person.id) : undefined;
    // Xếp các dòng từ trên xuống, căn giữa theo chiều dọc của ô.
    const lineGap = 4;
    const blockHeight =
      (avatarUrl ? AVATAR_SIZE + AVATAR_GAP : 0) +
      nameLines.length * (NAME_SIZE + lineGap) +
      detailLines.length * (SMALL_SIZE + lineGap) +
      noteLines.length * MARRIAGE_LINE_HEIGHT -
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
      const face = fontOf(!isSpouse);
      const { text, size } = fitLine(line, NAME_SIZE, face.bold, node.width - BOX_PADDING, memberFont);
      items.push({ type: 'text', x: centerX, y: my(cursor + NAME_SIZE / 2), text, sizePt: size * scale * PT_PER_MM, ...face, color: config.memberTextColor ?? member.name });
      cursor += NAME_SIZE + lineGap;
    }
    for (const line of detailLines) {
      const face = fontOf(false);
      const { text, size } = fitLine(line, SMALL_SIZE, face.bold, node.width - BOX_PADDING, memberFont);
      items.push({ type: 'text', x: centerX, y: my(cursor + SMALL_SIZE / 2), text, sizePt: size * scale * PT_PER_MM, ...face, color: config.memberTextColor ?? member.detail });
      cursor += SMALL_SIZE + lineGap;
    }
    for (const line of noteLines) {
      const face = fontOf(false);
      const { text, size } = fitLine(line, MARRIAGE_SIZE, face.bold, node.width - BOX_PADDING, memberFont);
      items.push({ type: 'text', x: centerX, y: my(cursor + MARRIAGE_SIZE / 2), text, sizePt: size * scale * PT_PER_MM, ...face, color: config.memberTextColor ?? member.note });
      cursor += MARRIAGE_LINE_HEIGHT;
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
