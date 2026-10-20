import { describe, expect, it } from 'vitest';
import { blankPerson } from '../test-support/person';
import { babyRelation, type BabyParents } from './baby-relation';
import { buildFamilyGraph } from './family-graph';

/**
 * Cụ Tổ ─ Cụ Tb
 *  ├ Cả (1920, nam) ─ Vợ Cả
 *  │   ├ Lan (nữ, 1945), Bình (nam, 1948; cha của bé), Cường (nam, 1952) ─ Thu (vợ Cường)
 *  ├ Hai (1925, nam)
 *  │   └ Hòa (nam, 1950)
 *  └ Út (nữ, 1932)
 * Mai (vợ Bình, mẹ của bé) con của Ông Ng ─ Bà Ng; em trai Nam (1955), chị Dì Hà (1950)
 * Con của Bình và Mai: Chị Chi (nữ). Con của Bình và vợ khác: Anh Anh (nam, 1975).
 * Bé: con của Bình và Mai.
 */
const person = (id: string, name: string, gender: 'nam' | 'nu', birth_year: number | null = null) => blankPerson({ id, full_name: name, gender, birth_year });
const graph = buildFamilyGraph({
  persons: [
    person('to', 'Phạm Tổ', 'nam', 1890),
    person('tb', 'Nguyễn Tb', 'nu', 1895),
    person('ca', 'Phạm Cả', 'nam', 1920),
    person('voca', 'Trần Vợ Cả', 'nu', 1922),
    person('hai', 'Phạm Hai', 'nam', 1925),
    person('ut', 'Phạm Út', 'nu', 1932),
    person('lan', 'Phạm Lan', 'nu', 1945),
    person('binh', 'Phạm Bình', 'nam', 1948),
    person('cuong', 'Phạm Cường', 'nam', 1952),
    person('thu', 'Lê Thu', 'nu', 1955),
    person('hoa', 'Phạm Hòa', 'nam', 1950),
    person('mai', 'Vũ Mai', 'nu', 1952),
    person('ng', 'Vũ Ng', 'nam', 1925),
    person('bang', 'Đỗ Bà Ng', 'nu', 1928),
    person('nam', 'Vũ Nam', 'nam', 1955),
    person('ha', 'Vũ Hà', 'nu', 1950),
    person('chi', 'Phạm Chi', 'nu', 1975),
    person('anh', 'Phạm Anh', 'nam', 1978),
    person('vokhac', 'Hoàng Vợ Khác', 'nu', 1955),
    person('ngoai', 'Người Lạ', 'nam', 1950),
    person('cc', 'Phạm Cc', 'nu', 1976),
    person('hc', 'Phạm Hc', 'nam', 1977),
  ],
  parentLinks: [
    ...['ca', 'hai', 'ut'].flatMap((id) => [{ child_id: id, parent_id: 'to', kind: 'ruot' }, { child_id: id, parent_id: 'tb', kind: 'ruot' }]),
    ...['lan', 'binh', 'cuong'].flatMap((id) => [{ child_id: id, parent_id: 'ca', kind: 'ruot' }, { child_id: id, parent_id: 'voca', kind: 'ruot' }]),
    { child_id: 'hoa', parent_id: 'hai', kind: 'ruot' },
    { child_id: 'cc', parent_id: 'cuong', kind: 'ruot' },
    { child_id: 'cc', parent_id: 'thu', kind: 'ruot' },
    { child_id: 'hc', parent_id: 'hoa', kind: 'ruot' },
    ...['mai', 'nam', 'ha'].flatMap((id) => [{ child_id: id, parent_id: 'ng', kind: 'ruot' }, { child_id: id, parent_id: 'bang', kind: 'ruot' }]),
    { child_id: 'chi', parent_id: 'binh', kind: 'ruot' },
    { child_id: 'chi', parent_id: 'mai', kind: 'ruot' },
    { child_id: 'anh', parent_id: 'binh', kind: 'ruot' },
    { child_id: 'anh', parent_id: 'vokhac', kind: 'ruot' },
  ],
  unions: [
    { id: 'u1', partner_a: 'to', partner_b: 'tb', order_for_a: 1, order_for_b: 1, status: 'con' },
    { id: 'u2', partner_a: 'ca', partner_b: 'voca', order_for_a: 1, order_for_b: 1, status: 'con' },
    { id: 'u3', partner_a: 'cuong', partner_b: 'thu', order_for_a: 1, order_for_b: 1, status: 'con' },
    { id: 'u4', partner_a: 'binh', partner_b: 'mai', order_for_a: 1, order_for_b: 1, status: 'con' },
    { id: 'u5', partner_a: 'binh', partner_b: 'vokhac', order_for_a: 2, order_for_b: 1, status: 'ly_hon' },
  ],
  positions: [],
});

const parents: BabyParents = { fatherId: 'binh', motherId: 'mai' };
const term = (id: string, p = parents) => babyRelation(graph, p, id)?.term ?? null;

describe('quan hệ với bé: trực hệ', () => {
  it('cha mẹ, ông bà nội ngoại, cụ', () => {
    expect(term('binh')).toBe('Ba');
    expect(term('mai')).toBe('Mẹ');
    expect(term('ca')).toBe('Ông nội');
    expect(term('voca')).toBe('Bà nội');
    expect(term('ng')).toBe('Ông ngoại');
    expect(term('bang')).toBe('Bà ngoại');
    expect(term('to')).toBe('Cụ ông nội');
    expect(term('tb')).toBe('Cụ bà nội');
  });
});

describe('quan hệ với bé: bên nội', () => {
  it('anh chị em của cha: bác (lớn hơn), chú (em trai); ruột', () => {
    expect(term('lan')).toBe('Bác ruột');
    expect(term('cuong')).toBe('Chú ruột');
    expect(babyRelation(graph, parents, 'lan')!.via).toBe('chị gái của Ba (Phạm Bình)');
  });

  it('anh chị em của ông nội: ông chú, bà cô', () => {
    expect(term('hai')).toBe('Ông chú ruột');
    expect(term('ut')).toBe('Bà cô ruột');
    expect(babyRelation(graph, parents, 'hai')!.via).toBe('em trai của Ông nội (Phạm Cả)');
  });

  it('con của anh em ông nội là chú/bác họ; anh chị em của bé', () => {
    expect(term('hoa')).toBe('Chú họ'); // sinh sau Bình
    expect(term('chi')).toBe('Chị ruột');
    expect(term('anh')).toBe('Anh (cùng ba khác mẹ)');
  });
});

describe('quan hệ với bé: anh chị em họ', () => {
  it('con của chú/bác: anh chị em họ; con của anh em họ của cha: họ xa', () => {
    expect(term('cc')).toBe('Chị họ');
    expect(babyRelation(graph, parents, 'cc')!.via).toBe('chung Ông nội Phạm Cả');
    expect(term('hc')).toBe('Anh họ xa');
    expect(babyRelation(graph, parents, 'hc')!.via).toBe('chung Cụ ông nội Phạm Tổ');
  });
});

describe('quan hệ với bé: bên ngoại', () => {
  it('anh chị em của mẹ: cậu, dì', () => {
    expect(term('nam')).toBe('Cậu ruột');
    expect(term('ha')).toBe('Dì ruột');
  });
});

describe('quan hệ với bé: vợ/chồng của họ hàng', () => {
  it('thím (vợ chú); chồng/vợ của họ hàng khác', () => {
    expect(term('thu')).toBe('Thím');
    expect(babyRelation(graph, parents, 'thu')!.via).toContain('vợ của chú ruột Phạm Cường');
  });

  it('người không có quan hệ nào: null', () => {
    expect(term('ngoai')).toBeNull();
  });
});

describe('quan hệ với bé: khi chưa rõ mẹ', () => {
  it('chỉ có cha: vẫn ra bên nội; bên ngoại không có', () => {
    const onlyFather: BabyParents = { fatherId: 'binh', motherId: null };
    expect(term('ca', onlyFather)).toBe('Ông nội');
    expect(term('lan', onlyFather)).toBe('Bác ruột');
    expect(term('nam', onlyFather)).toBeNull();
    expect(term('mai', onlyFather)).toBe('Vợ của ba');
  });

  it('chỉ có mẹ: toàn bên ngoại', () => {
    const onlyMother: BabyParents = { fatherId: null, motherId: 'mai' };
    expect(term('mai', onlyMother)).toBe('Mẹ');
    expect(term('ng', onlyMother)).toBe('Ông ngoại');
    expect(term('nam', onlyMother)).toBe('Cậu ruột');
    expect(term('ha', onlyMother)).toBe('Dì ruột');
    expect(term('ca', onlyMother)).toBeNull();
  });

  it('cha không tồn tại: null', () => {
    expect(babyRelation(graph, { fatherId: 'khong-co', motherId: null }, 'ca')).toBeNull();
    expect(babyRelation(graph, { fatherId: null, motherId: null }, 'ca')).toBeNull();
  });
});

describe('quan hệ với bé: họ hàng khác nhánh không so Thứ tự con', () => {
  it('thiếu năm sinh: chú/bác họ ra "Bác/Chú họ" dù Thứ tự con của hai bên đối nghịch', () => {
    const p = (id: string, gender: 'nam' | 'nu', order: number | null) => blankPerson({ id, full_name: id, gender, birth_year: null, birth_order: order });
    // cu ─ ong ─ (cha, bac) ; cu ─ ong2 ─ x : x là anh em họ của cha (khác nhánh), cha sinh sau (Thứ tự 3) còn x Thứ tự 1.
    const g = buildFamilyGraph({
      persons: [p('cu', 'nam', null), p('ong', 'nam', 1), p('ong2', 'nam', 2), p('cha', 'nam', 3), p('bac', 'nam', 1), p('x', 'nam', 1)],
      parentLinks: [
        { child_id: 'ong', parent_id: 'cu', kind: 'ruot' },
        { child_id: 'ong2', parent_id: 'cu', kind: 'ruot' },
        { child_id: 'cha', parent_id: 'ong', kind: 'ruot' },
        { child_id: 'bac', parent_id: 'ong', kind: 'ruot' },
        { child_id: 'x', parent_id: 'ong2', kind: 'ruot' },
      ],
      unions: [],
      positions: [],
    });
    expect(babyRelation(g, { fatherId: 'cha', motherId: null }, 'x')!.term).toBe('Bác/Chú họ');
    // anh em ruột của cha vẫn so Thứ tự con.
    expect(babyRelation(g, { fatherId: 'cha', motherId: null }, 'bac')!.term).toBe('Bác ruột');
  });

  it('có năm sinh thì phân biệt bác họ và chú họ', () => {
    const p = (id: string, gender: 'nam' | 'nu', year: number | null) => blankPerson({ id, full_name: id, gender, birth_year: year });
    const g = buildFamilyGraph({
      persons: [p('cu', 'nam', 1890), p('ong', 'nam', 1920), p('ong2', 'nam', 1922), p('cha', 'nam', 1950), p('x', 'nam', 1945), p('y', 'nam', 1955)],
      parentLinks: [
        { child_id: 'ong', parent_id: 'cu', kind: 'ruot' },
        { child_id: 'ong2', parent_id: 'cu', kind: 'ruot' },
        { child_id: 'cha', parent_id: 'ong', kind: 'ruot' },
        { child_id: 'x', parent_id: 'ong2', kind: 'ruot' },
        { child_id: 'y', parent_id: 'ong2', kind: 'ruot' },
      ],
      unions: [],
      positions: [],
    });
    expect(babyRelation(g, { fatherId: 'cha', motherId: null }, 'x')!.term).toBe('Bác họ');
    expect(babyRelation(g, { fatherId: 'cha', motherId: null }, 'y')!.term).toBe('Chú họ');
  });
});
