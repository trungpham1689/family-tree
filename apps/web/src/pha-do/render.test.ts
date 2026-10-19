import { randomFamily } from '@gia-pha/tree-layout';
import { describe, expect, it } from 'vitest';
import { blankPerson } from '../data/blank-person';
import { buildFamilyGraph } from '../family/family-graph';
import { defaultPhaDoConfig, pageSizeMm, readPhaDoConfig, type PhaDoConfig } from './config';
import { MIN_READABLE_PT, renderPhaDo } from './render';
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
      blankPerson({ id: 'chau-b', full_name: 'Phạm Văn Cháu B', gender: 'nam', han_name: '范文' }),
      blankPerson({ id: 'lac', full_name: 'Phạm Văn Lạc', gender: 'nam' }),
    ],
    parentLinks: [
      { parent_id: 'to', child_id: 'con-a', kind: 'ruot' },
      { parent_id: 'to', child_id: 'con-b', kind: 'ruot' },
      { parent_id: 'con-a', child_id: 'chau-a', kind: 'ruot' },
      { parent_id: 'dau-a', child_id: 'chau-a', kind: 'ruot' },
      { parent_id: 'chau-a', child_id: 'chat-a', kind: 'ruot' },
      { parent_id: 'con-b', child_id: 'chau-b', kind: 'ruot' },
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

  it('dòng thêm: ngày giỗ, tên chữ Hán', () => {
    const names = texts({ ...base, extraLines: ['gio', 'han'] });
    expect(names).toContain('Giỗ 12/3 ÂL');
    expect(names).toContain('范文');
  });

  it('viền theo giới tính, nền trắng và gạch chéo góc dưới phải khi đã mất', () => {
    const { drawing } = renderPhaDo(sample(), base);
    const rectBeforeName = (name: string) => {
      const nameIndex = drawing.items.findIndex((item) => item.type === 'text' && item.text === name);
      for (let index = nameIndex - 1; index >= 0; index -= 1) {
        const item = drawing.items[index]!;
        if (item.type === 'rect') return item;
      }
      throw new Error(`Không tìm thấy ô của "${name}".`);
    };

    // to: nam, đã mất → nền trắng (không xám), viền màu nam, có gạch chéo đen sau ô.
    const toRectIndex = drawing.items.findIndex(
      (item) => item.type === 'rect' && item === rectBeforeName('Phạm Văn Tổ'),
    );
    const toRect = rectBeforeName('Phạm Văn Tổ');
    expect(toRect.fill).toBe('#ffffff');
    expect(toRect.stroke).toBe('#b8892b');
    const markAfterTo = drawing.items[toRectIndex + 1];
    expect(markAfterTo?.type).toBe('line');
    expect((markAfterTo as { stroke: string }).stroke).toBe('#000000');
    expect(texts(base).some((text) => text.startsWith('† '))).toBe(true);

    // dau-a: nữ, còn sống (vợ) → nền ô vợ/chồng, viền màu nữ, không gạch chéo.
    const dauRectIndex = drawing.items.findIndex(
      (item) => item.type === 'rect' && item === rectBeforeName('Nguyễn Thị Dâu'),
    );
    const dauRect = rectBeforeName('Nguyễn Thị Dâu');
    expect(dauRect.fill).toBe('#fbf8f3');
    expect(dauRect.stroke).toBe('#8a1c1c');
    expect(drawing.items[dauRectIndex + 1]?.type).not.toBe('line');
  });

  it('hiện ảnh đại diện khi bật, chỉ cho Người có ảnh', () => {
    const avatars = new Map([['con-a', 'data:image/png;base64,AAA']]);
    const off = renderPhaDo(sample(), { ...base, showAvatars: false }, '', avatars);
    expect(off.drawing.items.some((item) => item.type === 'image')).toBe(false);

    const on = renderPhaDo(sample(), { ...base, showAvatars: true }, '', avatars);
    const images = on.drawing.items.filter((item) => item.type === 'image');
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ href: 'data:image/png;base64,AAA' });
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

const bigFamily = () => {
  const family = randomFamily(99, 800);
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
    expect(big.namePt).toBeLessThan(MIN_READABLE_PT);
    expect(big.warning).toMatch(/khó đọc/);

    expect(renderPhaDo(sample(), { ...base, paper: 'A0' }).warning).toBeNull();
  });

  it('khung, tiêu đề, câu đối chiếm chỗ thì cảnh báo vẫn tính đúng (chữ nhỏ đi)', () => {
    const plain = renderPhaDo(bigFamily(), { ...base, paper: 'A1', decoration: { ...base.decoration, frame: 'none' } });
    const decorated = renderPhaDo(
      bigFamily(),
      {
        ...base,
        paper: 'A1',
        decoration: { frame: 'son-kim', title: '', subtitle: 'Kính dâng tổ tiên – năm 2026', coupletLeft: 'Uống nước nhớ nguồn', coupletRight: 'Ăn quả nhớ kẻ trồng cây' },
      },
      'Họ Phạm',
    );
    expect(decorated.namePt).toBeLessThan(plain.namePt);
    expect(decorated.warning !== null).toBe(decorated.namePt < MIN_READABLE_PT);
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
      extraLines: ['gio', 'han'],
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

describe('trang trí', () => {
  const decorated = (frame: 'son-kim' | 'moc' | 'thanh-nha' | 'none') =>
    renderPhaDo(
      sample(),
      {
        ...base,
        paper: 'A2',
        decoration: { frame, title: '', subtitle: 'Kính dâng tổ tiên – năm 2026', coupletLeft: 'Uống nước nhớ nguồn', coupletRight: 'Ăn quả nhớ kẻ trồng cây' },
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
