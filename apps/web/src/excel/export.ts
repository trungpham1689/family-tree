/**
 * Xuất Gia phả ra đúng định dạng file mẫu (cùng cột, nối bằng mã), để sao lưu
 * hoặc sửa hàng loạt rồi nhập lại. Mã được đặt theo cấu trúc cây chứ không theo id trong database,
 * nên xuất → nhập lại → xuất lần nữa cho ra cùng một file.
 */
import type { SheetData } from 'write-excel-file/universal';
import type { Row } from '../data/database.types';
import { PERSON_FIELD_KEYS } from '../people/person-form';
import { COLUMNS, type RawRow } from './columns';
import { GUIDE_SHEET, DATA_SHEET, templateSheets } from './template';

/**
 * Người trong file xuất: mọi trường hồ sơ (PERSON_FIELD_KEYS, nguồn duy nhất) trừ hai ngày dương tự tính, cộng id và các cờ
 * hệ thống mà Excel mang theo. Thêm một trường hồ sơ thì kiểu này đòi hỏi nó ngay ở chỗ dựng dữ liệu.
 */
export type ExportPerson = Pick<Row<'persons'>, 'id' | 'is_progenitor' | 'hidden_from_public' | 'founds_branch'> &
  Pick<Row<'persons'>, Exclude<(typeof PERSON_FIELD_KEYS)[number], 'birth_solar_date' | 'death_solar_date'>>;

export type ExportData = {
  persons: readonly ExportPerson[];
  parentLinks: readonly { child_id: string; parent_id: string; kind: string }[];
  unions: readonly {
    partner_a: string;
    partner_b: string;
    order_for_a: number;
    order_for_b: number;
    status: string;
    marriage_year?: number | null;
    marriage_month?: number | null;
    marriage_day?: number | null;
  }[];
};

const collator = new Intl.Collator('vi');

const dateText = (
  precision: string | null,
  year: number | null,
  month: number | null,
  day: number | null,
  approx: boolean,
): string => {
  if (year === null) return '';
  const core = precision === 'ngay' ? `${day}/${month}/${year}` : precision === 'thang' ? `${month}/${year}` : `${year}`;
  return approx ? `khoảng ${core}` : core;
};

const calendarText = (calendar: string, leap: boolean, year: number | null): string => {
  if (year === null) return '';
  if (calendar === 'am') return leap ? 'Âm nhuận' : 'Âm';
  return 'Dương';
};

const STATUS_TEXT: Record<string, string> = { con: 'Còn', ly_hon: 'Ly hôn', goa: 'Goá' };

/** "15/8/1950", "8/1950", "1950"; "-" khi chưa biết (giữ đúng vị trí trong danh sách cách nhau dấu phẩy). */
const marriageText = (year: number | null, month: number | null, day: number | null): string =>
  year === null ? '-' : month === null ? `${year}` : day === null ? `${month}/${year}` : `${day}/${month}/${year}`;

const genderText = (gender: string | null) => (gender === 'nam' ? 'Nam' : gender === 'nu' ? 'Nữ' : '');

/** Thứ tự xuất: đi từ Thuỷ tổ theo kiểu cây (người, vợ/chồng, rồi từng con), sau đó tới Người chưa nối. */
const exportOrder = ({ persons, parentLinks, unions }: ExportData): ExportPerson[] => {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const children = new Map<string, string[]>();
  const hasParents = new Set<string>();
  for (const link of parentLinks) {
    children.set(link.parent_id, [...(children.get(link.parent_id) ?? []), link.child_id]);
    hasParents.add(link.child_id);
  }
  const spouses = new Map<string, { id: string; order: number }[]>();
  for (const union of unions) {
    spouses.set(union.partner_a, [...(spouses.get(union.partner_a) ?? []), { id: union.partner_b, order: union.order_for_a }]);
    spouses.set(union.partner_b, [...(spouses.get(union.partner_b) ?? []), { id: union.partner_a, order: union.order_for_b }]);
  }

  const compareSiblings = (a: ExportPerson, b: ExportPerson) =>
    (a.birth_order ?? 999) - (b.birth_order ?? 999) ||
    (a.birth_year ?? 99_999) - (b.birth_year ?? 99_999) ||
    collator.compare(a.full_name, b.full_name);

  const ordered: ExportPerson[] = [];
  const seen = new Set<string>();
  const visit = (start: ExportPerson) => {
    const stack = [start];
    while (stack.length > 0) {
      const person = stack.pop()!;
      if (seen.has(person.id)) continue;
      seen.add(person.id);
      ordered.push(person);
      // Dâu/rể đứng ngay sau người trong họ.
      for (const spouse of (spouses.get(person.id) ?? []).slice().sort((a, b) => a.order - b.order)) {
        const other = byId.get(spouse.id);
        if (other && !seen.has(other.id) && !hasParents.has(other.id)) {
          seen.add(other.id);
          ordered.push(other);
        }
      }
      const kids = (children.get(person.id) ?? []).flatMap((id) => byId.get(id) ?? []).sort(compareSiblings);
      for (let index = kids.length - 1; index >= 0; index -= 1) stack.push(kids[index]!);
    }
  };

  const progenitor = persons.find((person) => person.is_progenitor);
  if (progenitor) visit(progenitor);
  const rest = persons
    .filter((person) => !seen.has(person.id))
    .sort((a, b) => Number(hasParents.has(a.id)) - Number(hasParents.has(b.id)) || compareSiblings(a, b));
  for (const person of rest) visit(person);
  return ordered;
};

/** Gia phả → các dòng theo cột của file mẫu. */
export const familyToRows = (data: ExportData): RawRow[] => {
  const ordered = exportOrder(data);
  const width = Math.max(3, String(ordered.length).length);
  const code = new Map(ordered.map((person, index) => [person.id, `N${String(index + 1).padStart(width, '0')}`]));
  const position = new Map(ordered.map((person, index) => [person.id, index]));
  const byId = new Map(data.persons.map((person) => [person.id, person]));

  const parentsOf = new Map<string, { id: string; kind: string }[]>();
  for (const link of data.parentLinks) {
    parentsOf.set(link.child_id, [...(parentsOf.get(link.child_id) ?? []), { id: link.parent_id, kind: link.kind }]);
  }

  // Mỗi hôn phối ghi ở dòng của một người: người không có cha mẹ trong cây (dâu/rể),
  // hoặc nếu cả hai cùng có/không có thì người đứng sau trong file.
  const spouseRefs = new Map<
    string,
    { code: string; order: number; ownOrder: number; status: string; marriage: string }[]
  >();
  for (const union of data.unions) {
    const aHasParents = parentsOf.has(union.partner_a);
    const bHasParents = parentsOf.has(union.partner_b);
    const writeOnA =
      aHasParents !== bHasParents ? !aHasParents : (position.get(union.partner_a) ?? 0) > (position.get(union.partner_b) ?? 0);
    const [writer, other, orderOfWriterForOther, orderOfOtherForWriter] = writeOnA
      ? [union.partner_a, union.partner_b, union.order_for_b, union.order_for_a]
      : [union.partner_b, union.partner_a, union.order_for_a, union.order_for_b];
    spouseRefs.set(writer, [
      ...(spouseRefs.get(writer) ?? []),
      {
        code: code.get(other)!,
        order: orderOfWriterForOther,
        ownOrder: orderOfOtherForWriter,
        status: union.status,
        marriage: marriageText(union.marriage_year ?? null, union.marriage_month ?? null, union.marriage_day ?? null),
      },
    ]);
  }

  return ordered.map((person) => {
    const parents = (parentsOf.get(person.id) ?? []).slice().sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'ruot' ? -1 : 1));
    // File chỉ có hai cột cha, mẹ: ưu tiên cha mẹ ruột; người chưa rõ giới tính vào ô còn trống.
    let father: string | undefined;
    let mother: string | undefined;
    for (const parent of parents) {
      const gender = byId.get(parent.id)?.gender;
      if (gender === 'nam' && !father) father = parent.id;
      else if (gender === 'nu' && !mother) mother = parent.id;
      else if (gender !== 'nam' && gender !== 'nu') {
        if (!father) father = parent.id;
        else if (!mother) mother = parent.id;
      }
    }
    const chosen = [father, mother].filter((id): id is string => id !== undefined);
    const allAdopted = chosen.length > 0 && chosen.every((id) => parents.find((p) => p.id === id)?.kind === 'nuoi');
    const refs = (spouseRefs.get(person.id) ?? []).slice().sort((a, b) => a.ownOrder - b.ownOrder || a.code.localeCompare(b.code));

    const row: RawRow = {
      code: code.get(person.id)!,
      fullName: person.full_name,
      gender: genderText(person.gender),
      fatherCode: father ? code.get(father) : '',
      motherCode: mother ? code.get(mother) : '',
      parentKind: allAdopted ? 'Nuôi' : '',
      birthOrder: person.birth_order?.toString() ?? '',
      spouseCode: refs.map((ref) => ref.code).join(', '),
      spouseOrder: refs.map((ref) => ref.order).join(', '),
      spouseStatus: refs.some((ref) => ref.status !== 'con') ? refs.map((ref) => STATUS_TEXT[ref.status] ?? 'Còn').join(', ') : '',
      marriageDate: refs.some((ref) => ref.marriage !== '-') ? refs.map((ref) => ref.marriage).join(', ') : '',
      commonName: person.common_name ?? '',
      tabooName: person.taboo_name ?? '',
      courtesyName: person.courtesy_name ?? '',
      hanName: person.han_name ?? '',
      birthDate: dateText(person.birth_precision, person.birth_year, person.birth_month, person.birth_day, person.birth_approx),
      birthCalendar: calendarText(person.birth_calendar, person.birth_leap, person.birth_year),
      birthPlace: person.birth_place ?? '',
      hometown: person.hometown ?? '',
      residence: person.residence ?? '',
      occupation: person.occupation ?? '',
      education: person.education ?? '',
      title: person.title ?? '',
      phone: person.phone ?? '',
      email: person.email ?? '',
      biography: person.biography ?? '',
      roleNote: person.role_note ?? '',
      deceased: person.is_deceased ? 'Có' : '',
      deathDate: dateText(person.death_precision, person.death_year, person.death_month, person.death_day, person.death_approx),
      deathCalendar: calendarText(person.death_calendar, person.death_leap, person.death_year),
      anniversary:
        person.anniversary_manual && person.anniversary_day !== null && person.anniversary_month !== null
          ? `${person.anniversary_day}/${person.anniversary_month}`
          : '',
      burialPlace: person.burial_place ?? '',
      burialMapUrl: person.burial_map_url ?? '',
      worshipPlace: person.worship_place ?? '',
      worshipKeeperCode: person.worship_keeper_id ? (code.get(person.worship_keeper_id) ?? '') : '',
      hiddenFromPublic: person.hidden_from_public ? 'Có' : '',
      foundsBranch: person.founds_branch ? 'Có' : '',
    };
    return row;
  });
};

/** Các dòng → bảng ô (dòng tiêu đề + dữ liệu), dùng chung cho file xuất và test. */
export const rowsToTable = (rows: readonly RawRow[]): string[][] => [
  COLUMNS.map((column) => column.header),
  ...rows.map((row) => COLUMNS.map((column) => row[column.key] ?? '')),
];

/** File xuất: sheet dữ liệu như file mẫu, kèm sheet hướng dẫn để nhập lại. */
export const exportSheets = (rows: readonly RawRow[]) => {
  const [dataTemplate, guide] = templateSheets();
  const [header, ...body] = rowsToTable(rows);
  const data: SheetData = [
    header!.map((text) => ({ value: text, fontWeight: 'bold' as const })),
    ...body.map((cells) => cells.map((text) => (text === '' ? null : { value: text, type: String }))),
  ];
  return [
    { ...dataTemplate!, sheet: DATA_SHEET, data },
    { ...guide!, sheet: GUIDE_SHEET },
  ];
};
