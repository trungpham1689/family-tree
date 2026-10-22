import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { buildFamilyGraph } from '../family/family-graph';
import { blankPerson } from '../test-support/person';
import { defaultPhaDoConfig, type PhaDoConfig } from './config';
import { DEFAULT_DECORATION, DECOR_LOOKS, FRAME_LABELS, type Decoration, type FrameStyle } from './decoration';
import { DECOR_FONTS, decorFaceFile, resolveBold, type DecorFontId } from './decoration-fonts';
import { PT_PER_MM, type DrawItem, type DrawRect, type DrawText } from './drawing';
import { renderPhaDo } from './render';

/**
 * Chữ không bao giờ chồng lên chữ khác, tràn ra ngoài ô của mình, hay đè lên hoạ tiết khung. Đo bằng phông NotoSerif thật
 * (cùng phông bản xuất), nên bắt được cả trường hợp ước lượng độ rộng theo số ký tự bị lệch.
 */
const fontDir = join(import.meta.dirname, '..', '..', 'public', 'fonts');
const doc = new jsPDF({ unit: 'mm', format: 'a4' });
doc.addFileToVFS('r.ttf', readFileSync(join(fontDir, 'NotoSerif-400Regular.ttf')).toString('binary'));
doc.addFileToVFS('b.ttf', readFileSync(join(fontDir, 'NotoSerif-700Bold.ttf')).toString('binary'));
doc.addFont('r.ttf', 'N', 'normal');
doc.addFont('b.ttf', 'N', 'bold');
// Phông trang trí: đo bằng chính file phông bản xuất, mỗi phông một tên `D-<phông>`.
for (const id of Object.keys(DECOR_FONTS) as DecorFontId[]) {
  for (const bold of [false, true]) {
    if (!DECOR_FONTS[id][bold ? 'bold' : 'regular']) continue;
    const file = decorFaceFile(id, bold);
    doc.addFileToVFS(file.split('/').pop()!, readFileSync(join(fontDir, file.split('/').pop()!)).toString('binary'));
    doc.addFont(file.split('/').pop()!, `D-${id}`, bold ? 'bold' : 'normal');
  }
}

type Box = { left: number; right: number; top: number; bottom: number };
const textBox = (item: DrawText): Box => {
  doc.setFont(item.font ? `D-${item.font}` : 'N', (item.font ? resolveBold(item.font, item.bold) : item.bold) ? 'bold' : 'normal');
  doc.setFontSize(item.sizePt);
  const width = doc.getTextWidth(item.text);
  const em = item.sizePt / PT_PER_MM;
  const left = item.align === 'start' ? item.x : item.x - width / 2;
  return { left, right: left + width, top: item.y - em * 0.45, bottom: item.y + em * 0.45 };
};
const intersects = (a: Box, b: Box) => a.left < b.right - 0.01 && b.left < a.right - 0.01 && a.top < b.bottom - 0.01 && b.top < a.bottom - 0.01;
const inside = (inner: Box, rect: DrawRect) =>
  inner.left >= rect.x - 0.01 && inner.right <= rect.x + rect.width + 0.01 && inner.top >= rect.y - 0.01 && inner.bottom <= rect.y + rect.height + 0.01;

const people = [
  blankPerson({ id: 'to', full_name: 'Nguyễn Hoàng Thiên Phương Thảo Nguyên', gender: 'nam', is_progenitor: true, birth_year: 1884, is_deceased: true, death_year: 1945, anniversary_day: 12, anniversary_month: 3, hometown: 'Xã Nghĩa Hưng, huyện Nghĩa Đàn, tỉnh Nghệ An' }),
  ...['Phạm Văn Cả', 'TRẦN THỊ MƯỜI MỘT', 'Lê Quỳnh Trâm Anh', 'Mmmmmmmmmmmmmm Wwwwwwwwww'].map((name, i) =>
    blankPerson({ id: `c${i}`, full_name: name, gender: i % 2 ? 'nu' : 'nam', birth_year: 1910 + i, hometown: 'Làng Đông, xã Thượng Lâm, huyện Mỹ Đức, Hà Nội' }),
  ),
  ...['Phạm Thị Ngô Thùy Dương', 'Vũ Nguyễn Quỳnh Như', 'Đặng', 'Ngô Bảo Châu'].map((name, i) =>
    blankPerson({ id: `g${i}`, full_name: name, gender: i % 2 ? 'nu' : 'nam', birth_year: 1940 + i }),
  ),
  // Rể lấy hai chị em c1 và c3; c1 còn một đời chồng nữa. Tên dài để thử nhãn "cũng là chồng của …".
  blankPerson({ id: 're', full_name: 'Hoàng Nguyễn Văn Anh Tuấn Rể', gender: 'nam', birth_year: 1905 }),
  blankPerson({ id: 're2', full_name: 'Đỗ Văn Hai', gender: 'nam', birth_year: 1906 }),
];
const graph = buildFamilyGraph({
  persons: people,
  parentLinks: [
    ...[0, 1, 2, 3].map((i) => ({ parent_id: 'to', child_id: `c${i}`, kind: 'ruot' as const })),
    ...[0, 1, 2, 3].map((i) => ({ parent_id: `c${i}`, child_id: `g${i}`, kind: 'ruot' as const })),
  ],
  unions: [
    { id: 'u1', partner_a: 'c1', partner_b: 're', order_for_a: 1, order_for_b: 1, status: 'goa' },
    { id: 'u2', partner_a: 'c3', partner_b: 're', order_for_a: 1, order_for_b: 2, status: 'con' },
    { id: 'u3', partner_a: 'c1', partner_b: 're2', order_for_a: 2, order_for_b: 1, status: 'ly_hon' },
  ],
  positions: [],
});

const standard = { ...DEFAULT_DECORATION, title: '', subtitle: '', coupletLeft: 'Uống nước nhớ nguồn', coupletRight: 'Ăn quả nhớ kẻ trồng cây' };
const decorations: Decoration[] = [
  // Mọi khung × mọi phương án (phông chữ khác nhau, rộng hẹp khác nhau): chữ vẫn không chồng, không tràn.
  ...(Object.keys(FRAME_LABELS) as FrameStyle[]).flatMap((frame) => DECOR_LOOKS.map((look) => ({ ...standard, frame, look }))),
  ...DECOR_LOOKS.map((look) => ({ ...DEFAULT_DECORATION, look, frame: 'hoang-gia' as const, title: 'Gia phả dòng họ Nguyễn Hoàng Thiên Phương Thảo Nguyên ở Nghệ An', subtitle: 'Kính dâng tổ tiên – năm 2026, nhân dịp trùng tu nhà thờ họ', coupletLeft: 'Công đức tổ tông muôn đời sáng', coupletRight: 'Phúc ấm con cháu vạn thuở bền' })),
  { ...DEFAULT_DECORATION, frame: 'hoang-gia', title: 'Gia phả dòng họ Nguyễn Hoàng Thiên Phương Thảo Nguyên ở Nghệ An', subtitle: 'Kính dâng tổ tiên – năm 2026, nhân dịp trùng tu nhà thờ họ', coupletLeft: 'Công đức tổ tông muôn đời sáng', coupletRight: 'Phúc ấm con cháu vạn thuở bền' },
  { ...DEFAULT_DECORATION, frame: 'thanh-nha', title: 'Họ Phạm', subtitle: '', coupletLeft: 'Nguyễn Nghiêng Nghiệp', coupletRight: 'Khuyến Khuyên Quyền Trường' },
  { ...DEFAULT_DECORATION, frame: 'none', title: 'Họ Phạm', subtitle: 'x', coupletLeft: 'Trường tồn', coupletRight: 'Thịnh vượng' },
  // Cỡ chữ người dùng đặt rất to/rất nhỏ: chữ vẫn tự co cho vừa, không chồng.
  { ...standard, frame: 'son-kim', title: 'Họ Phạm', subtitle: 'Kính dâng tổ tiên', titleSize: 400, subtitleSize: 400, coupletSize: 400 },
  { ...standard, frame: 'hoanh-phi', title: 'Họ Phạm', subtitle: 'Kính dâng tổ tiên', titleSize: 4, subtitleSize: 4, coupletSize: 4 },
];
const papers: Partial<PhaDoConfig>[] = [
  { paper: 'A3', orientation: 'portrait' },
  { paper: 'A1', orientation: 'landscape' },
  { paper: 'custom', customWidthCm: 60, customHeightCm: 40, orientation: 'landscape' },
  { paper: 'A0', orientation: 'portrait' },
];

describe('chữ trên Phả đồ không chồng lên nhau', () => {
  for (const decoration of decorations) {
    for (const paper of papers) {
      for (const extraLines of [[], ['que' as const, 'gio' as const]]) {
        const label = `${decoration.frame}${decoration.look} · ${paper.paper} ${paper.orientation} · ${extraLines.length} dòng phụ`;
        it(label, () => {
          const config: PhaDoConfig = { ...defaultPhaDoConfig(1), ...paper, decoration, extraLines };
          const { drawing } = renderPhaDo(graph, config, 'Họ Phạm');
          const items: DrawItem[] = drawing.items;
          const texts = items.filter((item): item is DrawText => item.type === 'text');
          const boxes = texts.map(textBox);
          const cards = items.filter((item): item is DrawRect => item.type === 'rect' && item.radius > 0 && item.width < drawing.width * 0.5);
          const ornaments = items.flatMap((item): Box[] =>
            item.type === 'line' && item.seamless
              ? [{ left: Math.min(...item.points.map((p) => p[0])), right: Math.max(...item.points.map((p) => p[0])), top: Math.min(...item.points.map((p) => p[1])), bottom: Math.max(...item.points.map((p) => p[1])) }]
              : [],
          );

          for (const [index, box] of boxes.entries()) {
            const text = texts[index]!;
            expect(box.left, `"${text.text}" ra ngoài lề trái trang`).toBeGreaterThanOrEqual(0);
            expect(box.right, `"${text.text}" ra ngoài lề phải trang`).toBeLessThanOrEqual(drawing.width);
            for (const ornament of ornaments) expect(intersects(box, ornament), `"${text.text}" đè lên hoạ tiết khung`).toBe(false);
            const card = cards.find((rect) => text.x >= rect.x && text.x <= rect.x + rect.width && text.y >= rect.y && text.y <= rect.y + rect.height);
            if (card) expect(inside(box, card), `"${text.text}" tràn ra khỏi ô`).toBe(true);
            for (let other = index + 1; other < boxes.length; other += 1) {
              expect(intersects(box, boxes[other]!), `"${text.text}" chồng lên "${texts[other]!.text}"`).toBe(false);
            }
          }
        });
      }
    }
  }
});

describe('nhãn hôn phối trên Phả đồ', () => {
  it('ghi thứ tự, tình trạng và "cũng là chồng của …" cho rể lấy hai chị em', () => {
    const { drawing } = renderPhaDo(graph, { ...defaultPhaDoConfig(1), paper: 'A1', orientation: 'landscape' }, 'Họ Phạm');
    const texts = drawing.items.filter((item): item is DrawText => item.type === 'text').map((item) => item.text);
    expect(texts.some((text) => text.startsWith('Chồng · goá'))).toBe(true);
    expect(texts.some((text) => text.startsWith('Chồng hai · ly hôn'))).toBe(true);
    expect(texts.some((text) => text.includes('cũng là chồng của'))).toBe(true);
  });
});
