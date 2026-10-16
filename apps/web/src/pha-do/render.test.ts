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

  it('khung tiêu đề chiếm chỗ thì chữ nhỏ đi', () => {
    const plain = renderPhaDo(bigFamily(), { ...base, paper: 'A1' });
    const withHeader = renderPhaDo(bigFamily(), { ...base, paper: 'A1' }, { heightMm: 200 });
    expect(withHeader.namePt).toBeLessThanOrEqual(plain.namePt);
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
