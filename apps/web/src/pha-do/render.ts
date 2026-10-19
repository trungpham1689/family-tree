import { layoutTree, outsideGenerationsFilter, wrapName } from '@gia-pha/tree-layout';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { lifespanText } from '../people/person-display';
import { pageSizeMm, type ExtraLine, type PhaDoConfig } from './config';
import { layoutDecoration } from './decoration';
import { PT_PER_MM, type Drawing, type DrawItem } from './drawing';

/** Dưới cỡ này (pt) chữ in ra khó đọc với người lớn tuổi. */
export const MIN_READABLE_PT = 6;
/** Không phóng chữ quá to khi gia phả ít người. */
const MAX_NAME_PT = 28;

// Kích thước trong hệ toạ độ bố cục (đơn vị trừu tượng, cùng tỉ lệ với cỡ chữ bên dưới).
const BOX_WIDTH = 168;
const BASE_BOX_HEIGHT = 72;
const EXTRA_LINE_HEIGHT = 17;
const NAME_SIZE = 15;
const SMALL_SIZE = 12;
const NAME_CHARS = 18;
const AVATAR_SIZE = 52;
const AVATAR_GAP = 6;
/** Dải chú giải (giới tính, đã mất) dưới cùng vùng cây, tính bằng mm trên trang. */
const LEGEND_HEIGHT = 8;

const COLORS = {
  ink: '#1f1a17',
  muted: '#5c534c',
  son: '#8a1c1c',
  kim: '#b8892b',
  line: '#5c534c',
  box: '#ffffff',
  spouseBox: '#fbf8f3',
  // Viền theo giới tính — nhận ra ngay không cần đọc chữ.
  genderUnknown: '#a39a8f',
};

export type PhaDoResult = {
  drawing: Drawing;
  personCount: number;
  /** Cỡ chữ tên khi in ra (pt). */
  namePt: number;
  warning: string | null;
  /** Gốc của phạm vi không còn tồn tại (ví dụ Người đã bị xoá). */
  missingRoot: boolean;
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

/** Chú giải màu viền (giới tính) và nền (đã mất): một hàng trong dải LEGEND_HEIGHT dưới vùng cây. */
const legend = (area: { x: number; y: number; width: number; height: number }): DrawItem[] => {
  const y = area.y + area.height - LEGEND_HEIGHT / 2;
  const swatch = 3.5;
  const rows: [string, string][] = [
    [COLORS.kim, 'Nam'],
    [COLORS.son, 'Nữ'],
  ];
  let x = area.x;
  const items: DrawItem[] = [];
  for (const [color, label] of rows) {
    items.push(
      { type: 'rect', x, y: y - swatch / 2, width: swatch, height: swatch, radius: 1, fill: color, stroke: color, strokeWidth: 0 },
      { type: 'text', x: x + swatch + 2, y, text: label, sizePt: 9, bold: false, color: COLORS.muted, align: 'start' },
    );
    x += swatch + 2 + label.length * 3.6 + 10;
  }
  items.push({ type: 'text', x, y, text: '† Đã mất', sizePt: 9, bold: false, color: COLORS.muted, align: 'start' });
  x += '† Đã mất'.length * 3.6 + 10;
  items.push(
    {
      type: 'rect',
      x,
      y: y - swatch / 2,
      width: swatch,
      height: swatch,
      radius: 1,
      fill: 'none',
      stroke: COLORS.muted,
      strokeWidth: 0.6,
      dash: [1.2, 0.8],
    },
    { type: 'text', x: x + swatch + 2, y, text: 'Dâu/Rể (viền đứt)', sizePt: 9, bold: false, color: COLORS.muted, align: 'start' },
  );
  x += swatch + 2 + 'Dâu/Rể (viền đứt)'.length * 3.6 + 10;
  items.push(
    { type: 'rect', x, y: y - swatch / 2, width: swatch, height: swatch, radius: swatch / 2, fill: COLORS.genderUnknown, stroke: COLORS.genderUnknown, strokeWidth: 0 },
    { type: 'text', x: x + swatch + 2, y, text: 'Con nuôi', sizePt: 9, bold: false, color: COLORS.muted, align: 'start' },
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

/** Dựng bản vẽ Phả đồ theo cấu hình: chọn phạm vi, xếp cây, co giãn vừa khổ giấy, kèm cảnh báo chữ nhỏ. */
export const renderPhaDo = (
  graph: FamilyGraph<Person>,
  config: PhaDoConfig,
  treeName = '',
  avatarUrls?: ReadonlyMap<string, string>,
): PhaDoResult => {
  const page = pageSizeMm(config);
  const { rootId, maxDepth } = rootOf(graph, config);
  const empty = { drawing: { ...page, items: [] }, personCount: 0, namePt: 0, warning: null };
  if (!rootId || !graph.person(rootId)) return { ...empty, missingRoot: true };

  const extras = config.extraLines.slice(0, 2);
  const boxHeight = BASE_BOX_HEIGHT + extras.length * EXTRA_LINE_HEIGHT + (config.showAvatars ? AVATAR_SIZE + AVATAR_GAP : 0);
  const layout = layoutTree(graph, {
    rootId,
    ...(maxDepth !== undefined ? { maxDepth } : {}),
    includeChild: outsideGenerationsFilter(config.outsideGenerations),
    box: { width: BOX_WIDTH, height: boxHeight },
  });

  const decoration = layoutDecoration(page, config.decoration, treeName);
  const area = decoration.content;
  const availableWidth = area.width;
  // Dành một dải mỏng dưới cùng vùng cây cho chú giải — trong vùng "content" nên chắc chắn không
  // đụng khung/hoạ tiết trang trí (những thứ đó nằm ngoài vùng này theo layoutDecoration).
  const availableHeight = area.height - LEGEND_HEIGHT;
  const fitScale = Math.min(availableWidth / layout.width, availableHeight / layout.height);
  const maxNamePt = MAX_NAME_PT * (config.fontScale || 1);
  const scale = Math.min(fitScale, maxNamePt / (NAME_SIZE * PT_PER_MM));
  const namePt = NAME_SIZE * scale * PT_PER_MM;
  const smallPt = SMALL_SIZE * scale * PT_PER_MM;

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
      fill: isSpouse ? COLORS.spouseBox : COLORS.box,
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
    for (const text of nameLines) {
      items.push({ type: 'text', x: centerX, y: my(cursor + NAME_SIZE / 2), text, sizePt: namePt, bold: !isSpouse, color: COLORS.ink });
      cursor += NAME_SIZE + lineGap;
    }
    for (const text of detailLines) {
      items.push({ type: 'text', x: centerX, y: my(cursor + SMALL_SIZE / 2), text, sizePt: smallPt, bold: false, color: COLORS.muted });
      cursor += SMALL_SIZE + lineGap;
    }
  }

  const personCount = new Set(layout.nodes.map((node) => node.personId)).size;
  const warning =
    namePt < MIN_READABLE_PT
      ? `Chữ in ra chỉ khoảng ${namePt.toFixed(1)} pt, rất khó đọc. Hãy chọn khổ giấy lớn hơn (A0 hoặc tự nhập) hoặc in tách theo từng Chi.`
      : null;

  items.push(...legend(area));
  items.push(...decoration.above);
  return { drawing: { ...page, items }, personCount, namePt, warning, missingRoot: false };
};
