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
  worship_keeper: null,
  ...extra,
});

/** Giả lập "lưu vào database": mã trong file thành id. */
const saved = (payload: ImportPayload): ExportData => ({
  persons: payload.persons.map(({ key, fields }) => ({
    ...person(key),
    ...(fields as unknown as Partial<ExportPerson>),
    id: `db-${key}`,
    is_progenitor: key === payload.progenitor,
  })),
  parentLinks: payload.parentLinks.map((link) => ({ child_id: `db-${link.child}`, parent_id: `db-${link.parent}`, kind: link.kind })),
  unions: payload.unions.map((union) => ({
    partner_a: `db-${union.a}`,
    partner_b: `db-${union.b}`,
    order_for_a: union.orderA,
    order_for_b: union.orderB,
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
        person('chau-gai', { full_name: 'Cháu gái', gender: 'nu', birth_order: 1 }),
      ],
      parentLinks: [
        { child_id: 'anh', parent_id: 'to', kind: 'ruot' },
        { child_id: 'em', parent_id: 'to', kind: 'ruot' },
        { child_id: 'chau-trai', parent_id: 'anh', kind: 'ruot' },
        { child_id: 'chau-trai', parent_id: 'dau', kind: 'ruot' },
        { child_id: 'chau-gai', parent_id: 'em', kind: 'ruot' },
      ],
      unions: [
        { partner_a: 'anh', partner_b: 'dau', order_for_a: 1, order_for_b: 1 },
        { partner_a: 'em', partner_b: 'dau', order_for_a: 1, order_for_b: 2 },
        { partner_a: 'chau-trai', partner_b: 'chau-gai', order_for_a: 1, order_for_b: 1 },
      ],
    };
    const { first, second } = roundTrip(data);
    expect(second).toEqual(first);

    const header = first[0]!;
    const dau = first.find((row) => row[header.indexOf('Họ và tên')] === 'Dâu')!;
    expect(dau[header.indexOf('Mã vợ/chồng')]).toMatch(/, /);
  });

  it('gia phả trống thì chỉ có dòng tiêu đề', () => {
    expect(rowsToTable(familyToRows({ persons: [], parentLinks: [], unions: [] }))).toHaveLength(1);
  });
});
