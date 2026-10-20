import { describe, expect, it } from 'vitest';
import { familyToRows, rowsToTable, type ExportData, type ExportPerson } from './export';
import { buildImportPreview, type ImportPayload } from './import-preview';

const person = (id: string, extra: Partial<ExportPerson> = {}): ExportPerson => ({
  id,
  full_name: id,
  gender: 'nam',
  is_progenitor: false,
  birth_order: null,
  common_name: null,
  taboo_name: null,
  courtesy_name: null,
  han_name: null,
  birth_calendar: 'duong',
  birth_precision: null,
  birth_year: null,
  birth_month: null,
  birth_day: null,
  birth_leap: false,
  birth_approx: false,
  birth_place: null,
  hometown: null,
  residence: null,
  occupation: null,
  education: null,
  title: null,
  phone: null,
  email: null,
  biography: null,
  role_note: null,
  is_deceased: false,
  death_calendar: 'duong',
  death_precision: null,
  death_year: null,
  death_month: null,
  death_day: null,
  death_leap: false,
  death_approx: false,
  anniversary_day: null,
  anniversary_month: null,
  anniversary_manual: false,
  burial_place: null,
  burial_map_url: null,
  worship_place: null,
  worship_keeper_id: null,
  hidden_from_public: false,
  founds_branch: false,
  ...extra,
});

/** Giả lập "lưu vào database": mã trong file thành id. */
const saved = (payload: ImportPayload): ExportData => ({
  persons: payload.persons.map(({ key, fields, hiddenFromPublic, foundsBranch, worshipKeeper }) => ({
    ...person(key),
    ...(fields as unknown as Partial<ExportPerson>),
    id: `db-${key}`,
    is_progenitor: key === payload.progenitor,
    hidden_from_public: hiddenFromPublic,
    founds_branch: foundsBranch,
    worship_keeper_id: worshipKeeper ? `db-${worshipKeeper}` : null,
  })),
  parentLinks: payload.parentLinks.map((link) => ({ child_id: `db-${link.child}`, parent_id: `db-${link.parent}`, kind: link.kind })),
  unions: payload.unions.map((union) => ({
    partner_a: `db-${union.a}`,
    partner_b: `db-${union.b}`,
    order_for_a: union.orderA,
    order_for_b: union.orderB,
    status: union.status,
    marriage_year: union.marriageYear,
    marriage_month: union.marriageMonth,
    marriage_day: union.marriageDay,
  })),
});

const roundTrip = (data: ExportData) => {
  const first = rowsToTable(familyToRows(data));
  const preview = buildImportPreview(first);
  expect(preview.errors).toEqual([]);
  return { first, second: rowsToTable(familyToRows(saved(preview.payload!))) };
};

describe('xuất Excel', () => {
  it('góa phụ tái giá với em chồng, hôn nhân trong họ: xuất → nhập → xuất khớp nhau', () => {
    const data: ExportData = {
      persons: [
        person('to', { is_progenitor: true, full_name: 'Tổ' }),
        person('anh', { full_name: 'Anh', birth_order: 1 }),
        person('em', { full_name: 'Em', birth_order: 2 }),
        person('dau', { full_name: 'Dâu', gender: 'nu' }),
        person('chau-trai', { full_name: 'Cháu trai', birth_order: 1 }),
        person('chau-gai', { full_name: 'Cháu gái', gender: 'nu', birth_order: 1, hidden_from_public: true, founds_branch: true, worship_keeper_id: 'em' }),
      ],
      parentLinks: [
        { child_id: 'anh', parent_id: 'to', kind: 'ruot' },
        { child_id: 'em', parent_id: 'to', kind: 'ruot' },
        { child_id: 'chau-trai', parent_id: 'anh', kind: 'ruot' },
        { child_id: 'chau-trai', parent_id: 'dau', kind: 'ruot' },
        { child_id: 'chau-gai', parent_id: 'em', kind: 'ruot' },
      ],
      unions: [
        { partner_a: 'anh', partner_b: 'dau', order_for_a: 1, order_for_b: 1, status: 'goa', marriage_year: 1950, marriage_month: 8, marriage_day: 15 },
        { partner_a: 'em', partner_b: 'dau', order_for_a: 1, order_for_b: 2, status: 'con', marriage_year: 1960, marriage_month: null, marriage_day: null },
        { partner_a: 'chau-trai', partner_b: 'chau-gai', order_for_a: 1, order_for_b: 1, status: 'ly_hon', marriage_year: null, marriage_month: null, marriage_day: null },
      ],
    };
    const { first, second } = roundTrip(data);
    expect(second).toEqual(first);

    const header = first[0]!;
    const dau = first.find((row) => row[header.indexOf('Họ và tên')] === 'Dâu')!;
    expect(dau[header.indexOf('Mã vợ/chồng')]).toMatch(/, /);
    // Tình trạng hôn phối, ngày cưới (kể cả chỉ biết năm), cờ ẩn / lập chi và người phụ trách cúng giỗ đi theo file.
    expect(dau[header.indexOf('Tình trạng hôn phối')]).toBe('Goá, Còn');
    expect(dau[header.indexOf('Ngày cưới')]).toBe('15/8/1950, 1960');
    const chauGai = first.find((row) => row[header.indexOf('Họ và tên')] === 'Cháu gái')!;
    expect(chauGai[header.indexOf('Ẩn khỏi link công khai')]).toBe('Có');
    expect(chauGai[header.indexOf('Lập chi mới')]).toBe('Có');
    expect(chauGai[header.indexOf('Mã người phụ trách cúng giỗ')]).not.toBe('');
  });

  it('con gái ba đời chồng: mỗi con giữ đúng cha, thứ tự và tình trạng hôn phối đi theo file', () => {
    const data: ExportData = {
      persons: [
        person('cha', { is_progenitor: true, full_name: 'Cha' }),
        person('me', { full_name: 'Mẹ', gender: 'nu' }),
        person('lan', { full_name: 'Lan', gender: 'nu', birth_order: 1 }),
        person('re1', { full_name: 'Rể 1' }),
        person('re2', { full_name: 'Rể 2' }),
        person('re3', { full_name: 'Rể 3' }),
        person('c1', { full_name: 'Con 1', birth_order: 1 }),
        person('c2', { full_name: 'Con 2', birth_order: 2 }),
        person('c3', { full_name: 'Con 3', birth_order: 3 }),
        person('c4', { full_name: 'Con chưa rõ cha', birth_order: 4 }),
      ],
      parentLinks: [
        { child_id: 'lan', parent_id: 'cha', kind: 'ruot' },
        { child_id: 'lan', parent_id: 'me', kind: 'ruot' },
        ...['c1:re1', 'c2:re2', 'c3:re3'].flatMap((pair) => {
          const [child, father] = pair.split(':') as [string, string];
          return [
            { child_id: child, parent_id: 'lan', kind: 'ruot' },
            { child_id: child, parent_id: father, kind: 'ruot' },
          ];
        }),
        { child_id: 'c4', parent_id: 'lan', kind: 'ruot' },
      ],
      unions: [
        { partner_a: 'cha', partner_b: 'me', order_for_a: 1, order_for_b: 1, status: 'con' },
        { partner_a: 'lan', partner_b: 're1', order_for_a: 1, order_for_b: 1, status: 'ly_hon' },
        { partner_a: 'lan', partner_b: 're2', order_for_a: 2, order_for_b: 1, status: 'goa' },
        { partner_a: 'lan', partner_b: 're3', order_for_a: 3, order_for_b: 1, status: 'con' },
      ],
    };
    const { first, second } = roundTrip(data);
    expect(second).toEqual(first);

    const preview = buildImportPreview(first);
    const fatherOf = (childName: string) => {
      const code = (name: string) => preview.payload!.persons.find((p) => (p.fields as { full_name?: string }).full_name === name)!.key;
      return preview.payload!.parentLinks.filter((l) => l.child === code(childName) && l.parent !== code('Lan')).map((l) => l.parent);
    };
    const codeOf = (name: string) => preview.payload!.persons.find((p) => (p.fields as { full_name?: string }).full_name === name)!.key;
    expect(fatherOf('Con 1')).toEqual([codeOf('Rể 1')]);
    expect(fatherOf('Con 2')).toEqual([codeOf('Rể 2')]);
    expect(fatherOf('Con 3')).toEqual([codeOf('Rể 3')]);
    expect(fatherOf('Con chưa rõ cha')).toEqual([]);
    const lan = preview.payload!.unions.filter((u) => u.a === codeOf('Lan') || u.b === codeOf('Lan'));
    expect(lan.map((u) => [u.a === codeOf('Lan') ? u.orderA : u.orderB, u.status]).sort()).toEqual([[1, 'ly_hon'], [2, 'goa'], [3, 'con']]);
  });

  it('gia phả trống thì chỉ có dòng tiêu đề', () => {
    expect(rowsToTable(familyToRows({ persons: [], parentLinks: [], unions: [] }))).toHaveLength(1);
  });
});

describe('xuất Excel: thứ tự các con', () => {
  const kids = (children: ExportPerson[]) =>
    familyToRows({
      persons: [person('cha', { is_progenitor: true }), ...children],
      parentLinks: children.map((child) => ({ child_id: child.id, parent_id: 'cha', kind: 'ruot' })),
      unions: [],
    })
      .map((row) => row.fullName)
      .filter((name) => name !== 'cha');
  const named = (id: string, extra: Partial<ExportPerson>) => person(id, { full_name: id, ...extra });

  it('con sinh trước đứng trước: cùng năm thì theo tháng, ngày (không chỉ năm)', () => {
    expect(
      kids([
        named('c', { birth_year: 1990, birth_month: 9, birth_day: 1 }),
        named('a', { birth_year: 1990, birth_month: 2, birth_day: 20 }),
        named('b', { birth_year: 1990, birth_month: 2, birth_day: 25 }),
        named('d', { birth_year: 1989 }),
      ]),
    ).toEqual(['d', 'a', 'b', 'c']);
  });

  it('Thứ tự con đã ghi quyết định trước ngày sinh', () => {
    expect(kids([named('x', { birth_year: 1980, birth_order: 2 }), named('y', { birth_year: 1990, birth_order: 1 })])).toEqual(['y', 'x']);
  });
});
