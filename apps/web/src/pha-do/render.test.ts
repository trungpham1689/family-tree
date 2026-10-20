import { randomFamily } from '@gia-pha/tree-layout';
import { describe, expect, it } from 'vitest';
import { blankPerson } from '../test-support/person';
import { buildFamilyGraph } from '../family/family-graph';
import { defaultPhaDoConfig, pageSizeMm, readPhaDoConfig, type PhaDoConfig } from './config';
import { FRAME_LABELS, layoutDecoration, type FrameStyle } from './decoration';
import { PT_PER_MM, type DrawItem } from './drawing';
import { autoMemberFontPx, fitPaperToFont } from './auto-fit';
import { legendWidthMm, MIN_READABLE_PX, renderPhaDo } from './render';
import { drawingToSvg } from './svg';

/**
 * to ─ con-a (vợ: dau-a) ─ chau-a ─ chat-a
 *    └ con-b ─ chau-b
 * lac (chưa nối)
 */
const sample = () =>
  buildFamilyGraph({
    persons: [
      blankPerson({ id: 'to', full_name: 'Phạm Văn Tổ', gender: 'nam', is_progenitor: true, is_deceased: true, anniversary_day: 12, anniversary_month: 3 }),
      blankPerson({ id: 'con-a', full_name: 'Phạm Văn Ả', gender: 'nam', birth_order: 1 }),
      blankPerson({ id: 'dau-a', full_name: 'Nguyễn Thị Dâu', gender: 'nu' }),
      blankPerson({ id: 'con-b', full_name: 'Phạm Văn Bé', gender: 'nam', birth_order: 2 }),
      blankPerson({ id: 'chau-a', full_name: 'Phạm Văn Cháu A', gender: 'nam' }),
      blankPerson({ id: 'chat-a', full_name: 'Phạm Văn Chắt A', gender: 'nam' }),
      blankPerson({ id: 'chau-b', full_name: 'Phạm Văn Cháu B', gender: 'nam', hometown: 'Làng Đông' }),
      blankPerson({ id: 'lac', full_name: 'Phạm Văn Lạc', gender: 'nam' }),
    ],
    parentLinks: [
      { parent_id: 'to', child_id: 'con-a', kind: 'ruot' },
      { parent_id: 'to', child_id: 'con-b', kind: 'ruot' },
      { parent_id: 'con-a', child_id: 'chau-a', kind: 'ruot' },
      { parent_id: 'dau-a', child_id: 'chau-a', kind: 'ruot' },
      { parent_id: 'chau-a', child_id: 'chat-a', kind: 'ruot' },
      { parent_id: 'con-b', child_id: 'chau-b', kind: 'nuoi' },
    ],
    unions: [{ id: 'u', partner_a: 'con-a', partner_b: 'dau-a', order_for_a: 1, order_for_b: 1, status: 'con' }],
    positions: [],
  });

const texts = (config: PhaDoConfig) =>
  renderPhaDo(sample(), config).drawing.items.flatMap((item) => (item.type === 'text' ? [item.text] : []));

const base = defaultPhaDoConfig(1);

describe('seam C: Phả đồ', () => {
  it('cả Gia phả: mọi người đã nối, Người chưa nối bị loại', () => {
    const all = texts(base);
    expect(all).toContain('Phạm Văn Chắt A');
    expect(all).toContain('Nguyễn Thị Dâu');
    expect(all).not.toContain('Phạm Văn Lạc');
  });

  it('một Người xuống N Đời chỉ chứa đúng nhóm đó', () => {
    const result = renderPhaDo(sample(), { ...base, scope: { kind: 'from-person', personId: 'con-a', depth: 1 } });
    const names = result.drawing.items.flatMap((item) => (item.type === 'text' ? [item.text] : []));
    expect(names).toEqual(expect.arrayContaining(['Phạm Văn Ả', 'Nguyễn Thị Dâu', 'Phạm Văn Cháu A']));
    for (const outside of ['Phạm Văn Tổ', 'Phạm Văn Bé', 'Phạm Văn Cháu B', 'Phạm Văn Chắt A']) expect(names).not.toContain(outside);
    expect(result.personCount).toBe(3);
  });

  it('một Chi: từ người đầu Chi xuống hết', () => {
    const names = texts({ ...base, scope: { kind: 'branch', personId: 'con-b' } });
    expect(names).toEqual(expect.arrayContaining(['Phạm Văn Bé', 'Phạm Văn Cháu B']));
    expect(names).not.toContain('Phạm Văn Ả');
  });

  it('dòng thêm: ngày giỗ, quê quán', () => {
    const names = texts({ ...base, extraLines: ['gio', 'que'] });
    expect(names).toContain('Giỗ 12/3 ÂL');
    expect(names).toContain('Làng Đông');
  });

  it('viền theo giới tính, nền trắng kể cả khi đã mất (chỉ thêm dấu † ở dòng năm)', () => {
    const { drawing } = renderPhaDo(sample(), base);
    const rectBeforeName = (name: string) => {
      const nameIndex = drawing.items.findIndex((item) => item.type === 'text' && item.text === name);
      for (let index = nameIndex - 1; index >= 0; index -= 1) {
        const item = drawing.items[index]!;
        if (item.type === 'rect') return item;
      }
      throw new Error(`Không tìm thấy ô của "${name}".`);
    };

    // to: nam, đã mất → vẫn nền trắng, viền màu nam, không có dấu đen nào trên ô.
    const toRect = rectBeforeName('Phạm Văn Tổ');
    expect(toRect.fill).toBe('#ffffff');
    expect(toRect.stroke).toBe('#b8892b');
    expect(texts(base).some((text) => text.startsWith('† '))).toBe(true);

    // dau-a: nữ, còn sống (vợ) → nền ô vợ/chồng, viền màu nữ.
    const dauRect = rectBeforeName('Nguyễn Thị Dâu');
    expect(dauRect.fill).toBe('#fbf8f3');
    expect(dauRect.stroke).toBe('#8a1c1c');
  });

  it('viền đứt cho Dâu/Rể, chấm góc dưới trái cho con nuôi', () => {
    const { drawing } = renderPhaDo(sample(), base);
    // Ô chính luôn rộng hơn hẳn chấm con nuôi (3 đơn vị): lấy rect rộng nhất ngay trước tên.
    const rectBeforeName = (name: string) => {
      const nameIndex = drawing.items.findIndex((item) => item.type === 'text' && item.text === name);
      const rects = [];
      for (let index = nameIndex - 1; index >= 0; index -= 1) {
        const item = drawing.items[index]!;
        if (item.type === 'text') break;
        if (item.type === 'rect') rects.push(item);
      }
      if (rects.length === 0) throw new Error(`Không tìm thấy ô của "${name}".`);
      return rects.reduce((widest, rect) => (rect.width > widest.width ? rect : widest));
    };

    // dau-a: Dâu (vợ của con-a, kết hôn vào họ) → viền đứt.
    expect(rectBeforeName('Nguyễn Thị Dâu').dash).toBeDefined();
    // to: Đinh (máu mủ) → viền liền, không đứt.
    expect(rectBeforeName('Phạm Văn Tổ').dash).toBeUndefined();

    // chau-b: con nuôi của con-b → có chấm đánh dấu ngay trước ô của chính nó.
    const chauBIndex = drawing.items.findIndex(
      (item) => item.type === 'rect' && item === rectBeforeName('Phạm Văn Cháu B'),
    );
    const markAfter = drawing.items[chauBIndex + 1];
    expect(markAfter).toMatchObject({ type: 'rect', fill: '#a39a8f' });
    // chau-a: con ruột → không có chấm, phần tử kế tiếp là dòng tên.
    const chauAIndex = drawing.items.findIndex(
      (item) => item.type === 'rect' && item === rectBeforeName('Phạm Văn Cháu A'),
    );
    expect(drawing.items[chauAIndex + 1]?.type).toBe('text');
  });

  it('hiện ảnh đại diện khi bật, chỉ cho Người có ảnh; viền tròn xám khi đã mất', () => {
    const avatars = new Map([
      ['con-a', 'data:image/png;base64,AAA'],
      ['to', 'data:image/png;base64,BBB'],
    ]);
    const off = renderPhaDo(sample(), { ...base, showAvatars: false }, '', avatars);
    expect(off.drawing.items.some((item) => item.type === 'image')).toBe(false);

    const on = renderPhaDo(sample(), { ...base, showAvatars: true }, '', avatars);
    const images = on.drawing.items.filter((item) => item.type === 'image');
    expect(images).toHaveLength(2);
    const conAImage = images.find((image) => image.href === 'data:image/png;base64,AAA');
    expect(conAImage).toMatchObject({ round: { borderColor: '#b8892b' } }); // con-a: nam, còn sống → viền nam.
    const toImage = images.find((image) => image.href === 'data:image/png;base64,BBB');
    expect(toImage).toMatchObject({ round: { borderColor: '#5c534c' } }); // to: nam, đã mất → viền xám.
  });

  it('gốc không còn tồn tại thì báo thay vì vẽ sai', () => {
    expect(renderPhaDo(sample(), { ...base, scope: { kind: 'branch', personId: 'da-xoa' } }).missingRoot).toBe(true);
  });

  it('mọi phần tử nằm trong trang', () => {
    for (const paper of ['A3', 'A0'] as const) {
      for (const orientation of ['portrait', 'landscape'] as const) {
        const { drawing } = renderPhaDo(sample(), { ...base, paper, orientation });
        for (const item of drawing.items) {
          if (item.type === 'rect') {
            expect(item.x).toBeGreaterThanOrEqual(0);
            expect(item.y).toBeGreaterThanOrEqual(0);
            expect(item.x + item.width).toBeLessThanOrEqual(drawing.width + 1e-6);
            expect(item.y + item.height).toBeLessThanOrEqual(drawing.height + 1e-6);
          }
        }
      }
    }
  });
});

const bigFamily = (size = 800) => {
  const family = randomFamily(99, size);
  return buildFamilyGraph({
    persons: family.persons.map((person) =>
      blankPerson({ id: person.id, full_name: person.full_name, gender: person.gender, birth_year: person.birth_year, is_progenitor: person.id === family.rootId }),
    ),
    parentLinks: family.parentLinks.map((link) => ({ ...link, kind: 'ruot' })),
    unions: family.unions.map((union, index) => ({ ...union, id: `u${index}`, status: 'con' })),
    positions: [],
  });
};

describe('seam C: cảnh báo chữ quá nhỏ', () => {
  it('ép 800 người vào khổ A3 thì cảnh báo; gia phả nhỏ trên A0 thì không', () => {
    const big = renderPhaDo(bigFamily(), { ...base, paper: 'A3', outsideGenerations: 5 });
    expect(big.personCount).toBeGreaterThan(700);
    expect(big.namePx).toBeLessThan(MIN_READABLE_PX);
    expect(big.warning).toMatch(/khó đọc/);
    expect(big.warning).toMatch(/ px,/);
    expect(big.warning).not.toMatch(/\bpt\b/);

    expect(renderPhaDo(sample(), { ...base, paper: 'A0' }).warning).toBeNull();
  });

  it('khung, tiêu đề, câu đối chiếm chỗ thì cảnh báo vẫn tính đúng (chữ nhỏ đi)', () => {
    const plain = renderPhaDo(bigFamily(), { ...base, paper: 'A1', decoration: { ...base.decoration, frame: 'none' } });
    const decorated = renderPhaDo(
      bigFamily(),
      {
        ...base,
        paper: 'A1',
        decoration: { ...base.decoration, frame: 'son-kim', subtitle: 'Kính dâng tổ tiên – năm 2026', coupletLeft: 'Uống nước nhớ nguồn', coupletRight: 'Ăn quả nhớ kẻ trồng cây' },
      },
      'Họ Phạm',
    );
    expect(decorated.namePx).toBeLessThan(plain.namePx);
    expect(decorated.warning !== null).toBe(decorated.namePx < MIN_READABLE_PX);
  });
});

describe('khổ giấy và cấu hình', () => {
  it('khổ chuẩn, khổ tự nhập, hướng giấy', () => {
    expect(pageSizeMm({ ...base, paper: 'A0', orientation: 'portrait' })).toEqual({ width: 841, height: 1189 });
    expect(pageSizeMm({ ...base, paper: 'A3', orientation: 'landscape' })).toEqual({ width: 420, height: 297 });
    expect(pageSizeMm({ ...base, paper: 'custom', customWidthCm: 150, customHeightCm: 90, orientation: 'portrait' })).toEqual({
      width: 900,
      height: 1500,
    });
  });

  it('đọc lại cấu hình đã lưu; giá trị lạ thì về mặc định', () => {
    const saved: PhaDoConfig = { ...base, scope: { kind: 'from-person', personId: 'x', depth: 4 }, paper: 'A2', extraLines: ['doi', 'que'] };
    expect(readPhaDoConfig(JSON.parse(JSON.stringify(saved)), 1)).toEqual(saved);
    expect(readPhaDoConfig({ paper: 'B5', extraLines: ['gio', 'gio', 'x', 'han', 'que'] }, 2)).toMatchObject({
      paper: 'A1',
      outsideGenerations: 2,
      extraLines: ['gio', 'que'],
    });
    expect(readPhaDoConfig(null, 0)).toEqual(defaultPhaDoConfig(0));
  });
});

describe('xem trước', () => {
  it('SVG đúng kích thước mm và có chữ tiếng Việt', () => {
    const svg = drawingToSvg(renderPhaDo(sample(), { ...base, paper: 'A3', orientation: 'landscape' }).drawing);
    expect(svg).toContain('width="420mm" height="297mm"');
    expect(svg).toContain('Phạm Văn Tổ');
  });
});

describe('SVG xem trước: màu và chữ được escape', () => {
  it('màu có ký tự đặc biệt không thoát được khỏi thuộc tính', () => {
    const evil = '"><script>alert(1)</script>';
    const svg = drawingToSvg({
      width: 100,
      height: 100,
      items: [
        { type: 'rect', x: 0, y: 0, width: 10, height: 10, radius: 1, fill: evil, stroke: evil, strokeWidth: 1 },
        { type: 'line', points: [[0, 0], [1, 1]], stroke: evil, strokeWidth: 1 },
        { type: 'text', x: 1, y: 1, text: '<b>Tên</b>', sizePt: 10, bold: false, color: evil },
        { type: 'image', x: 0, y: 0, width: 5, height: 5, href: 'data:image/png;base64,AAA', round: { borderColor: evil, borderWidth: 1 } },
      ],
    });
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&quot;&gt;&lt;script&gt;');
  });
});

describe('trang trí', () => {
  const decorated = (frame: 'son-kim' | 'moc' | 'thanh-nha' | 'none') =>
    renderPhaDo(
      sample(),
      {
        ...base,
        paper: 'A2',
        decoration: { ...base.decoration, frame, subtitle: 'Kính dâng tổ tiên – năm 2026', coupletLeft: 'Uống nước nhớ nguồn', coupletRight: 'Ăn quả nhớ kẻ trồng cây' },
      },
      'họ Phạm',
    );

  it('tiêu đề mặc định theo tên gia phả, phụ đề, câu đối từng chữ theo cột dọc', () => {
    const items = decorated('son-kim').drawing.items.flatMap((item) => (item.type === 'text' ? [item] : []));
    const texts = items.map((item) => item.text);
    expect(texts).toContain('Gia phả họ Phạm');
    expect(texts).toContain('Kính dâng tổ tiên – năm 2026');
    const left = ['Uống', 'nước', 'nhớ', 'nguồn'].map((word) => items.find((item) => item.text === word)!);
    expect(new Set(left.map((item) => item.x)).size).toBe(1);
    expect(left.map((item) => item.y)).toEqual([...left.map((item) => item.y)].sort((a, b) => a - b));
    const right = items.find((item) => item.text === 'trồng')!;
    expect(right.x).toBeGreaterThan(left[0]!.x);
  });

  it('tiêu đề tự đặt thay cho mặc định', () => {
    const result = renderPhaDo(sample(), { ...base, decoration: { ...base.decoration, title: 'Phạm tộc phả đồ' } }, 'họ Phạm');
    const texts = result.drawing.items.flatMap((item) => (item.type === 'text' ? [item.text] : []));
    expect(texts).toContain('Phạm tộc phả đồ');
    expect(texts).not.toContain('Gia phả họ Phạm');
  });

  it.each(['son-kim', 'moc', 'thanh-nha', 'none'] as const)('khung %s: mọi ô của cây nằm trong vùng trang trí', (frame) => {
    const { drawing } = decorated(frame);
    const boxes = drawing.items.filter((item) => item.type === 'rect' && item.fill !== 'none' && item.width < drawing.width);
    for (const box of boxes) {
      if (box.type !== 'rect') continue;
      expect(box.x).toBeGreaterThan(0);
      expect(box.x + box.width).toBeLessThan(drawing.width);
      expect(box.y + box.height).toBeLessThan(drawing.height);
    }
  });
});

describe('cỡ chữ tuỳ chỉnh', () => {
  const textOf = (config: PhaDoConfig, text: string, tree = 'họ Phạm') => {
    const item = renderPhaDo(sample(), config, tree).drawing.items.find((it) => it.type === 'text' && it.text === text);
    if (item?.type !== 'text') throw new Error(`Không thấy "${text}"`);
    return item;
  };
  const titled = { ...base, paper: 'A1' as const, decoration: { ...base.decoration, subtitle: 'Phụ đề', coupletLeft: 'Uống', coupletRight: 'Ăn' } };
  const withSize = (patch: Partial<PhaDoConfig['decoration']>) => ({ ...titled, decoration: { ...titled.decoration, ...patch } });

  it('mặc định tên 14 px khi cây vừa trang', () => {
    expect(renderPhaDo(sample(), { ...base, paper: 'A1' }).namePx).toBeCloseTo(14, 5);
  });

  it('cỡ chữ ô: lớn hơn thì chữ tên to hơn, nhưng không vượt cỡ vừa khổ giấy', () => {
    const small = renderPhaDo(sample(), { ...base, memberFontPx: 10 });
    const large = renderPhaDo(sample(), { ...base, memberFontPx: 30 });
    expect(large.namePx).toBeGreaterThan(small.namePx);
    const capped = renderPhaDo(bigFamily(), { ...base, paper: 'A3', memberFontPx: 400 });
    expect(capped.namePx).toBeLessThan(400);
    expect(capped.namePx).toBeGreaterThan(0);
  });

  it('tiêu đề, phụ đề, câu đối đổi cỡ độc lập', () => {
    expect(textOf(withSize({ titleSize: 100 }), 'Gia phả họ Phạm').sizePt).toBeGreaterThan(textOf(withSize({ titleSize: 50 }), 'Gia phả họ Phạm').sizePt);
    expect(textOf(withSize({ subtitleSize: 80 }), 'Phụ đề').sizePt).toBeGreaterThan(textOf(withSize({ subtitleSize: 40 }), 'Phụ đề').sizePt);
    expect(textOf(withSize({ coupletSize: 60 }), 'Uống').sizePt).toBeGreaterThan(textOf(withSize({ coupletSize: 30 }), 'Uống').sizePt);
    // đổi cỡ phụ đề không động tới tiêu đề
    expect(textOf(withSize({ subtitleSize: 80 }), 'Gia phả họ Phạm').sizePt).toBe(textOf(withSize({ subtitleSize: 40 }), 'Gia phả họ Phạm').sizePt);
  });

  it('cỡ trang trí tính trên trang cạnh ngắn 1000 px: 100 px trên A1 = 1/10 cạnh ngắn 594 mm', () => {
    expect(textOf(withSize({ subtitleSize: 100 }), 'Phụ đề').sizePt).toBeCloseTo(59.4 * PT_PER_MM, 3);
  });

  it('mặc định trang trí 50 / 30 / 30', () => {
    expect([base.decoration.titleSize, base.decoration.subtitleSize, base.decoration.coupletSize]).toEqual([50, 30, 30]);
  });

  it('đọc lại cấu hình: cỡ chữ ngoài khoảng thì về mặc định', () => {
    const read = readPhaDoConfig({ memberFontPx: 9999, decoration: { titleSize: 1, subtitleSize: 50 } }, 1);
    expect(read.memberFontPx).toBe(14);
    expect(read.decoration.titleSize).toBe(50);
    expect(read.decoration.subtitleSize).toBe(50);
  });
});

/**
 * Cùng tỉ lệ khổ giấy, gấp đôi kích thước → mọi phần tử (toạ độ, nét, cỡ chữ, chấm, đường đứt…) phải gấp đôi đúng.
 * Phần tử nào còn cỡ cố định (mm/pt) sẽ lộ ra ở đây.
 */
describe('tỉ lệ theo khổ giấy', () => {
  const geometry = (item: DrawItem): number[] => {
    switch (item.type) {
      case 'rect':
        return [item.x, item.y, item.width, item.height, item.radius, item.strokeWidth, ...(item.dash ?? [])];
      case 'line':
        return [...item.points.flat(), item.strokeWidth];
      case 'text':
        return [item.x, item.y, item.sizePt];
      case 'image':
        return [item.x, item.y, item.width, item.height, item.round?.borderWidth ?? 0];
    }
  };
  const render = (frame: FrameStyle, widthCm: number, heightCm: number) =>
    renderPhaDo(
      sample(),
      {
        ...base,
        paper: 'custom',
        customWidthCm: widthCm,
        customHeightCm: heightCm,
        // Cỡ chữ ô lớn để bị khổ giấy giới hạn (không chạm trần) → mọi thứ co giãn tuyến tính theo khổ.
        memberFontPx: 300,
        showAvatars: true,
        extraLines: ['gio', 'que'],
        decoration: { ...base.decoration, frame, subtitle: 'Kính dâng tổ tiên – năm 2026', coupletLeft: 'Uống nước nhớ nguồn', coupletRight: 'Ăn quả nhớ kẻ trồng cây' },
      },
      'họ Phạm',
      new Map([['con-a', 'data:image/png;base64,AAA']]),
    );

  it.each(Object.keys(FRAME_LABELS) as FrameStyle[])('khung %s: khổ gấp đôi thì mọi thứ gấp đôi', (frame) => {
    const small = render(frame, 50, 35);
    const large = render(frame, 100, 70);
    expect(large.drawing.items).toHaveLength(small.drawing.items.length);
    large.drawing.items.forEach((item, index) => {
      const a = geometry(small.drawing.items[index]!);
      const b = geometry(item);
      expect(b).toHaveLength(a.length);
      b.forEach((value, i) => expect(value).toBeCloseTo(a[i]! * 2, 6));
    });
    expect(large.namePx).toBeCloseTo(small.namePx * 2, 6);
  });
});

describe('khổ giấy tự co giãn cho vừa khít', () => {
  // 60 người: đủ đông để khổ giấy cỡ vài mét, vẫn trong giới hạn 500 cm ở mọi cỡ chữ thử.
  const family = bigFamily(60);
  const decorated = (frame: FrameStyle, extra: Partial<PhaDoConfig> = {}): PhaDoConfig => ({
    ...base,
    ...extra,
    decoration: {
      ...base.decoration,
      frame,
      subtitle: 'Kính dâng tổ tiên – năm 2026',
      coupletLeft: 'Uống nước nhớ nguồn',
      coupletRight: 'Ăn quả nhớ kẻ trồng cây',
    },
  });
  const nodeBoxes = (config: PhaDoConfig, graph = sample()) =>
    renderPhaDo(graph, config, 'họ Phạm').drawing.items.filter(
      (item): item is Extract<DrawItem, { type: 'rect' }> => item.type === 'rect' && item.radius > 0 && (item.fill === '#ffffff' || item.fill === '#fbf8f3'),
    );

  it('cỡ chữ ô đạt đúng cỡ yêu cầu, khổ tự nhập, trong 10–500 cm', () => {
    for (const memberFontPx of [6, 10, 20]) {
      const fitted = fitPaperToFont(family, decorated('son-kim', { memberFontPx, outsideGenerations: 5 }), 'họ Phạm');
      expect(fitted.paper).toBe('custom');
      const after = renderPhaDo(family, fitted, 'họ Phạm');
      expect(after.namePx).toBeCloseTo(memberFontPx, 1);
      expect(after.fitNamePx).toBeGreaterThanOrEqual(memberFontPx - 0.01);
      expect(after.fitNamePx).toBeLessThan(memberFontPx * 1.01);
    }
  });

  it('càng nhiều người / chữ càng to thì khổ càng lớn; chữ nhỏ hơn thì khổ thu lại', () => {
    const area = (config: PhaDoConfig, graph = family) => {
      const page = pageSizeMm(fitPaperToFont(graph, config, 'họ Phạm'));
      return page.width * page.height;
    };
    const config = decorated('son-kim', { outsideGenerations: 5 });
    expect(area({ ...config, memberFontPx: 20 })).toBeGreaterThan(area({ ...config, memberFontPx: 10 }) * 3.5);
    expect(area(decorated('son-kim', { outsideGenerations: 5, memberFontPx: 14 }))).toBeGreaterThan(
      area(decorated('son-kim', { memberFontPx: 14 }), sample()) * 3,
    );
  });

  it.each(Object.keys(FRAME_LABELS) as FrameStyle[])('khung %s: mọi ô nằm trong vùng cây, sát khít một chiều, chữ trang trí không bị co', (frame) => {
    const config = fitPaperToFont(sample(), decorated(frame, { memberFontPx: 20 }), 'họ Phạm');
    const page = pageSizeMm(config);
    const deco = layoutDecoration(page, config.decoration, 'họ Phạm');
    expect(deco.fit).toBeGreaterThanOrEqual(0.999);
    const boxes = nodeBoxes(config);
    const left = Math.min(...boxes.map((box) => box.x));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const top = Math.min(...boxes.map((box) => box.y));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));
    const { content } = deco;
    // Khoảng sai số: làm tròn 0,1 cm của khổ giấy và nét viền ô.
    const eps = Math.max(page.width, page.height) * 0.004 + 1;
    expect(left).toBeGreaterThanOrEqual(content.x - eps);
    expect(right).toBeLessThanOrEqual(content.x + content.width + eps);
    expect(top).toBeGreaterThanOrEqual(content.y - eps);
    expect(bottom).toBeLessThanOrEqual(content.y + content.height + eps);
    // Vừa khít: tỉ lệ khung được chọn theo cây nên cây phủ gần hết vùng cây ở cả hai chiều.
    const fillX = (right - left) / content.width;
    const fillY = (bottom - top) / (content.height - 8 * (Math.min(page.width, page.height) / 594));
    expect(Math.max(fillX, fillY)).toBeGreaterThan(0.97);
    expect(Math.min(fillX, fillY)).toBeGreaterThan(0.8);
  });

  it('tiêu đề dài, câu đối dài: khổ giấy đủ rộng/cao để không chữ nào bị co', () => {
    const config = fitPaperToFont(
      sample(),
      {
        ...decorated('hoang-gia', { memberFontPx: 14 }),
        decoration: {
          ...base.decoration,
          frame: 'hoang-gia',
          title: 'Gia phả dòng họ Nguyễn Hoàng Thiên Phương Thảo Nguyên ở Nghệ An',
          subtitle: 'Kính dâng tổ tiên – năm 2026, nhân dịp trùng tu nhà thờ họ',
          coupletLeft: 'Công đức tổ tông muôn đời sáng rạng ngời',
          coupletRight: 'Phúc ấm con cháu vạn thuở bền lâu',
        },
      },
      'họ Phạm',
    );
    expect(layoutDecoration(pageSizeMm(config), config.decoration, 'họ Phạm').fit).toBeGreaterThanOrEqual(0.999);
  });

  it('giữ hướng giấy: ngang thì rộng ≥ cao, dọc thì cao ≥ rộng', () => {
    const landscape = pageSizeMm(fitPaperToFont(sample(), decorated('son-kim', { memberFontPx: 14, orientation: 'landscape' }), 'họ Phạm'));
    const portrait = pageSizeMm(fitPaperToFont(sample(), decorated('son-kim', { memberFontPx: 14, orientation: 'portrait' }), 'họ Phạm'));
    expect(landscape.width).toBeGreaterThanOrEqual(landscape.height);
    expect(portrait.height).toBeGreaterThanOrEqual(portrait.width);
  });

  it('chặn trong khoảng khổ tự nhập 10–500 cm', () => {
    const big = pageSizeMm(fitPaperToFont(family, decorated('son-kim', { memberFontPx: 300 }), 'họ Phạm'));
    expect(Math.max(big.width, big.height)).toBeLessThanOrEqual(5000);
    const small = pageSizeMm(fitPaperToFont(sample(), decorated('none', { memberFontPx: 4 }), 'họ Phạm'));
    expect(Math.min(small.width, small.height)).toBeGreaterThanOrEqual(100);
  });

  it('gốc không còn: giữ nguyên cấu hình', () => {
    const config = { ...base, scope: { kind: 'branch' as const, personId: 'da-xoa' } };
    expect(fitPaperToFont(sample(), config)).toEqual(config);
  });

  it('autoPaper: mặc định tắt, đọc lại từ cấu hình đã lưu', () => {
    expect(base.autoPaper).toBe(false);
    expect(readPhaDoConfig({ autoPaper: true }, 1).autoPaper).toBe(true);
    expect(readPhaDoConfig({ autoPaper: 'yes' }, 1).autoPaper).toBe(false);
  });
});

describe('cỡ chữ ô mặc định lúc mở lần đầu', () => {
  it('bằng cỡ chữ đang hiện trên khổ mặc định (làm tròn xuống): nhập lại đúng số đó thì khổ giấy giữ nguyên', () => {
    const initial = defaultPhaDoConfig(1);
    const px = autoMemberFontPx(sample(), initial);
    // Cây nhỏ: chữ chạm trần cũ 28 pt = 37,33 px.
    expect(px).toBe(37);
    const first = renderPhaDo(sample(), { ...initial, memberFontPx: px });
    expect(first.namePx).toBeCloseTo(px, 5);
    // Cây đông: chữ bị khổ giấy giới hạn, mặc định là cỡ thực đang hiện.
    const config = { ...initial, outsideGenerations: 5 };
    const crowded = autoMemberFontPx(bigFamily(40), config);
    expect(crowded).toBe(Math.floor(renderPhaDo(bigFamily(40), { ...config, memberFontPx: 300 }).namePx));
    expect(crowded).toBeGreaterThanOrEqual(4);
    expect(crowded).toBeLessThan(37);
  });

});

describe('màu ô thành viên', () => {
  const nodeRects = (config: PhaDoConfig) =>
    renderPhaDo(sample(), config).drawing.items.filter(
      (item): item is Extract<DrawItem, { type: 'rect' }> => item.type === 'rect' && item.radius > 0 && item.width > 20 && item.stroke !== item.fill,
    );
  const personTexts = (config: PhaDoConfig) =>
    renderPhaDo(sample(), config).drawing.items.filter(
      (item): item is Extract<DrawItem, { type: 'text' }> => item.type === 'text' && item.align !== 'start',
    );

  it('mặc định như trước: chữ đen/xám, nền trắng, Dâu/Rể nền kem', () => {
    expect(base.memberTextColor).toBeNull();
    expect(base.memberFillColor).toBeNull();
    expect(new Set(nodeRects(base).map((rect) => rect.fill))).toEqual(new Set(['#ffffff', '#fbf8f3']));
    const colors = new Set(personTexts(base).map((text) => text.color));
    expect(colors).toEqual(new Set(['#1f1a17', '#5c534c']));
  });

  it('đặt màu nền và màu chữ: mọi ô, mọi dòng chữ trong ô dùng màu đó; viền giữ theo giới tính', () => {
    const config = { ...base, memberFillColor: '#ffeecc', memberTextColor: '#003366' };
    const rects = nodeRects(config);
    expect(rects.length).toBeGreaterThan(0);
    expect(rects.every((rect) => rect.fill === '#ffeecc')).toBe(true);
    expect(new Set(rects.map((rect) => rect.stroke))).toEqual(new Set(['#b8892b', '#8a1c1c']));
    expect(personTexts(config).every((text) => text.color === '#003366')).toBe(true);
  });

  it('đọc lại cấu hình: chỉ nhận #rrggbb', () => {
    expect(readPhaDoConfig({ memberFillColor: '#AABBCC', memberTextColor: '#123456' }, 1)).toMatchObject({ memberFillColor: '#aabbcc', memberTextColor: '#123456' });
    expect(readPhaDoConfig({ memberFillColor: 'red', memberTextColor: '#12' }, 1)).toMatchObject({ memberFillColor: null, memberTextColor: null });
  });
});

describe('cỡ chữ ô tự suy và chú giải', () => {
  it('cây rất đông: giữ chữ số thập phân thay vì nâng lên 4 px không chứa nổi; đọc lại từ cấu hình đã lưu được', () => {
    const crowded = { ...defaultPhaDoConfig(5), paper: 'A1' as const };
    const px = autoMemberFontPx(bigFamily(150), crowded);
    const actual = renderPhaDo(bigFamily(150), { ...crowded, memberFontPx: 300 }).namePx;
    expect(actual).toBeLessThan(4);
    expect(px).toBeLessThanOrEqual(actual + 1e-9);
    expect(px).toBeGreaterThanOrEqual(actual - 0.11);
    expect(readPhaDoConfig({ memberFontPx: px }, 1).memberFontPx).toBe(px);
  });

  it('chiều ngang chú giải tính từ chính hằng số vẽ: không item nào vượt, tỉ lệ theo khổ giấy', () => {
    const a1 = { width: 841, height: 594 };
    const items = renderPhaDo(sample(), { ...defaultPhaDoConfig(1), paper: 'A1', decoration: { ...defaultPhaDoConfig(1).decoration, frame: 'none' } }).drawing.items;
    const legendRight = Math.max(...items.filter((i): i is Extract<DrawItem, { type: 'text' }> => i.type === 'text' && i.align === 'start').map((i) => i.x));
    const legendLeft = Math.min(...items.filter((i): i is Extract<DrawItem, { type: 'text' }> => i.type === 'text' && i.align === 'start').map((i) => i.x - 5.5));
    expect(legendWidthMm(a1)).toBeGreaterThan(legendRight - legendLeft); // gồm cả chữ cuối
    expect(legendWidthMm({ width: 420, height: 297 })).toBeCloseTo(legendWidthMm(a1) / 2, 6);
  });
});
