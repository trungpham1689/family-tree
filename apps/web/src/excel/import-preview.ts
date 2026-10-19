/**
 * Mô-đun Excel: đọc bảng (đã tách khỏi file .xlsx) thành bản xem trước của Gia phả kèm lỗi từng dòng.
 * Không đụng tới giao diện hay database; phần lưu nhận đúng `ImportPayload` mà mô-đun này tạo ra.
 */
import { EMPTY_DATE_INPUT, type DateInput } from '../people/partial-date-input';
import { EMPTY_PERSON_FORM, parsePersonForm, type PersonFields, type PersonFormValues } from '../people/person-form';
import { normalizeName } from '../tree/tree-search';
import { COLUMNS, HEADER_OF, type ColumnKey, type RawRow } from './columns';

export type ImportError = { row: number; column: string | null; message: string };

export type PreviewPerson = {
  /** Số dòng trong Excel (dòng tiêu đề là 1). */
  row: number;
  code: string;
  name: string;
  generation: number | null;
  relation: string;
};

export type ImportPayload = {
  /** Người theo thứ tự lưu; Thuỷ tổ đứng đầu. */
  persons: {
    key: string;
    fields: PersonFields;
    hiddenFromPublic: boolean;
    foundsBranch: boolean;
    /** Mã (key) của người phụ trách cúng giỗ trong cùng file. */
    worshipKeeper: string | null;
  }[];
  parentLinks: { child: string; parent: string; kind: 'ruot' | 'nuoi' }[];
  unions: {
    a: string;
    b: string;
    orderA: number;
    orderB: number;
    status: 'con' | 'ly_hon' | 'goa';
    marriageYear: number | null;
    marriageMonth: number | null;
    marriageDay: number | null;
  }[];
  progenitor: string | null;
};

export type ImportPreview = {
  errors: ImportError[];
  people: PreviewPerson[];
  total: number;
  generations: number;
  progenitorName: string | null;
  unconnected: number;
  /** Chỉ có khi không còn lỗi. */
  payload: ImportPayload | null;
};

export type CellValue = string | number | boolean | Date | null | undefined;

export const MAX_ROWS = 2000;

// ---------------------------------------------------------------------------
// Đọc ô
// ---------------------------------------------------------------------------

const cellText = (value: CellValue): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    // Ô Excel định dạng ngày: đọc theo UTC để không lệch múi giờ.
    return `${value.getUTCDate()}/${value.getUTCMonth() + 1}/${value.getUTCFullYear()}`;
  }
  if (typeof value === 'boolean') return value ? 'Có' : '';
  return String(value).trim();
};

const HEADER_KEYS = new Map<string, ColumnKey>(COLUMNS.map((column) => [normalizeName(column.header), column.key]));

/** Tìm dòng tiêu đề và trả về các dòng dữ liệu dạng { cột: chữ }. */
export const readTable = (rows: readonly (readonly CellValue[])[]): { rows: { row: number; data: RawRow }[]; missing: string[] } => {
  const headerIndex = rows.findIndex((row) => row.some((cell) => HEADER_KEYS.get(normalizeName(cellText(cell))) === 'code'));
  if (headerIndex === -1) return { rows: [], missing: [HEADER_OF.code, HEADER_OF.fullName] };

  const positions = new Map<number, ColumnKey>();
  rows[headerIndex]!.forEach((cell, index) => {
    const key = HEADER_KEYS.get(normalizeName(cellText(cell)));
    if (key && ![...positions.values()].includes(key)) positions.set(index, key);
  });
  const found = new Set(positions.values());
  const missing = (['code', 'fullName'] as const).filter((key) => !found.has(key)).map((key) => HEADER_OF[key]);

  const data = rows.slice(headerIndex + 1).flatMap((row, offset) => {
    const raw: RawRow = {};
    for (const [index, key] of positions) {
      const text = cellText(row[index]);
      if (text !== '') raw[key] = text;
    }
    return Object.keys(raw).length === 0 ? [] : [{ row: headerIndex + offset + 2, data: raw }];
  });
  return { rows: data, missing };
};

// ---------------------------------------------------------------------------
// Ngày tháng, giới tính, lịch
// ---------------------------------------------------------------------------

const parseCalendar = (text: string | undefined): { calendar: 'duong' | 'am'; leap: boolean } | null => {
  const value = normalizeName(text ?? '');
  if (value === '' || value === 'duong' || value === 'dl' || value === 'duong lich') return { calendar: 'duong', leap: false };
  if (value === 'am' || value === 'al' || value === 'am lich') return { calendar: 'am', leap: false };
  if (value === 'am nhuan' || value === 'nhuan' || value === 'am lich nhuan') return { calendar: 'am', leap: true };
  return null;
};

/** "15/8/1920", "8/1920", "1920", "khoảng 1890", "~1890" → ô nhập ngày của form. Null nếu sai cú pháp. */
export const parseDateText = (text: string, calendar: { calendar: 'duong' | 'am'; leap: boolean }): DateInput | null => {
  let value = normalizeName(text).replaceAll(/[.-]/g, '/').replaceAll(' / ', '/');
  let approximate = false;
  for (const prefix of ['khoang ', 'khoang', '~', 'k.', 'ca. ']) {
    if (value.startsWith(prefix)) {
      approximate = true;
      value = value.slice(prefix.length).trim();
    }
  }
  if (value.endsWith('?')) {
    approximate = true;
    value = value.slice(0, -1).trim();
  }
  const parts = value.split('/').map((part) => part.trim());
  if (parts.some((part) => !/^\d{1,4}$/.test(part))) return null;
  const base = { ...EMPTY_DATE_INPUT, calendar: calendar.calendar, approximate };
  if (parts.length === 1) return { ...base, precision: 'nam', year: parts[0]! };
  if (parts.length === 2) return { ...base, precision: 'thang', month: parts[0]!, year: parts[1]!, leap: calendar.leap };
  if (parts.length === 3) {
    return { ...base, precision: 'ngay', day: parts[0]!, month: parts[1]!, year: parts[2]!, leap: calendar.leap };
  }
  return null;
};

const parseGender = (text: string | undefined): '' | 'nam' | 'nu' | null => {
  const value = normalizeName(text ?? '');
  if (value === '') return '';
  if (value === 'nam' || value === 'trai' || value === 'm') return 'nam';
  if (value === 'nu' || value === 'gai' || value === 'f') return 'nu';
  return null;
};

const parseYes = (text: string | undefined): boolean | null => {
  const value = normalizeName(text ?? '');
  if (value === '' || value === 'khong' || value === 'chua' || value === 'con song') return false;
  if (['co', 'x', 'da mat', 'roi', 'yes', 'true', '1'].includes(value)) return true;
  return null;
};

const parseOrder = (text: string | undefined): number | null | 'invalid' => {
  if (!text) return null;
  return /^\d{1,2}$/.test(text) && Number(text) >= 1 ? Number(text) : 'invalid';
};

/** Lỗi của form hồ sơ → cột Excel tương ứng. */
const FORM_ERROR_COLUMN: Partial<Record<keyof PersonFormValues, ColumnKey>> = {
  fullName: 'fullName',
  birthOrder: 'birthOrder',
  birth: 'birthDate',
  death: 'deathDate',
  anniversaryDay: 'anniversary',
  burialMapUrl: 'burialMapUrl',
  email: 'email',
};

// ---------------------------------------------------------------------------
// Dựng bản xem trước
// ---------------------------------------------------------------------------

type ParsedRow = {
  row: number;
  code: string;
  data: RawRow;
  fields: PersonFields | null;
  gender: '' | 'nam' | 'nu';
  spouseOrders: (number | null)[];
  spouseStatuses: ('con' | 'ly_hon' | 'goa')[];
  marriages: Marriage[];
  parentKind: 'ruot' | 'nuoi';
  hiddenFromPublic: boolean;
  foundsBranch: boolean;
};

type Marriage = { year: number | null; month: number | null; day: number | null };

const parseStatus = (text: string): 'con' | 'ly_hon' | 'goa' | null => {
  const value = normalizeName(text);
  if (value === '' || value === 'con') return 'con';
  if (value === 'ly hon') return 'ly_hon';
  if (value === 'goa') return 'goa';
  return null;
};

const splitList = (text: string | undefined): string[] =>
  (text ?? '')
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);

/** Như splitList nhưng giữ ô trống ("Còn,,Goá"), để giá trị theo từng vợ/chồng không lệch vị trí. */
const splitCells = (text: string | undefined): string[] =>
  text === undefined || text.trim() === '' ? [] : text.split(/[,;]/).map((part) => part.trim());

/** Gom `items` theo khoá: map khoá → danh sách giá trị. */
const groupBy = <T>(items: readonly T[], key: (item: T) => string, value: (item: T) => string): Map<string, string[]> => {
  const groups = new Map<string, string[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), value(item)]);
  return groups;
};

/**
 * Các vòng lặp tổ tiên (A là cha của B ... là cha của A), mỗi vòng là danh sách mã theo đường đi và quay lại điểm đầu.
 * Phần tử cuối là người "đóng" vòng (nơi báo lỗi). Mỗi vòng chỉ báo một lần.
 */
export const findAncestorCycles = (codes: readonly string[], parentLinks: readonly { child: string; parent: string }[]): string[][] => {
  const childrenOf = groupBy(parentLinks, (link) => link.parent, (link) => link.child);
  const state = new Map<string, 'visiting' | 'done'>();
  const reported = new Set<string>();
  const cycles: string[][] = [];
  const visit = (code: string, path: string[]) => {
    state.set(code, 'visiting');
    for (const child of childrenOf.get(code) ?? []) {
      if (state.get(child) === 'visiting') {
        const cycle = [...path.slice(path.indexOf(child)), code, child];
        const key = [...new Set(cycle)].sort().join(',');
        if (!reported.has(key)) {
          reported.add(key);
          cycles.push(cycle);
        }
      } else if (!state.has(child)) {
        visit(child, [...path, code]);
      }
    }
    state.set(code, 'done');
  };
  for (const code of codes) if (!state.has(code)) visit(code, []);
  return cycles;
};

/**
 * Chọn Thuỷ tổ (người gốc, không phải dâu/rể, có nhiều hậu duệ nhất) rồi tính Đời của mọi người nối được vào cây;
 * dâu/rể cùng Đời với người phối ngẫu trong họ. `skip` thì không chọn ai.
 */
export const layoutGenerations = (input: {
  codes: readonly string[];
  skip: boolean;
  marriedIn: (code: string) => boolean;
  childrenOf: ReadonlyMap<string, readonly string[]>;
  parentsOf: ReadonlyMap<string, readonly string[]>;
  spousesOf: ReadonlyMap<string, readonly string[]>;
}): { progenitorCode: string | null; generation: Map<string, number> } => {
  const { codes, skip, marriedIn, childrenOf, parentsOf, spousesOf } = input;
  const countDescendants = (code: string): number => {
    const seen = new Set<string>();
    const stack = [code];
    while (stack.length > 0) {
      for (const child of childrenOf.get(stack.pop()!) ?? []) {
        if (!seen.has(child)) {
          seen.add(child);
          stack.push(child);
        }
      }
    }
    return seen.size;
  };
  const roots = skip ? [] : codes.filter((code) => !parentsOf.has(code) && !(marriedIn(code) && !parentsOf.has(code)));
  let progenitorCode: string | null = null;
  let best = -1;
  for (const root of roots) {
    const count = countDescendants(root);
    if (count > best) {
      best = count;
      progenitorCode = root;
    }
  }

  const generation = new Map<string, number>();
  if (progenitorCode) {
    generation.set(progenitorCode, 1);
    const queue = [progenitorCode];
    while (queue.length > 0) {
      const code = queue.shift()!;
      for (const child of childrenOf.get(code) ?? []) {
        if (!generation.has(child)) {
          generation.set(child, generation.get(code)! + 1);
          queue.push(child);
        }
      }
    }
    for (const [code, value] of [...generation]) {
      for (const spouse of spousesOf.get(code) ?? []) if (!generation.has(spouse) && !parentsOf.has(spouse)) generation.set(spouse, value);
    }
  }
  return { progenitorCode, generation };
};

export const buildImportPreview = (table: readonly (readonly CellValue[])[]): ImportPreview => {
  const errors: ImportError[] = [];
  const fail = (row: number, column: ColumnKey | null, message: string) =>
    errors.push({ row, column: column ? HEADER_OF[column] : null, message });

  const { rows, missing } = readTable(table);
  if (missing.length > 0) {
    errors.push({ row: 1, column: null, message: `Không thấy cột ${missing.map((name) => `"${name}"`).join(', ')}. Hãy dùng file mẫu.` });
    return emptyPreview(errors);
  }
  if (rows.length === 0) {
    errors.push({ row: 2, column: null, message: 'File chưa có dòng dữ liệu nào.' });
    return emptyPreview(errors);
  }
  if (rows.length > MAX_ROWS) {
    errors.push({ row: rows[MAX_ROWS]!.row, column: null, message: `Một gia phả có tối đa ${MAX_ROWS} người; file có ${rows.length} người.` });
    return emptyPreview(errors);
  }

  // ---- Từng dòng ----
  const byCode = new Map<string, ParsedRow>();
  const parsed: ParsedRow[] = [];
  for (const { row, data } of rows) {
    const code = data.code?.trim() ?? '';
    if (code === '') {
      fail(row, 'code', 'Thiếu mã. Mỗi người cần một mã riêng để nối quan hệ.');
      continue;
    }
    const duplicate = byCode.get(code);
    if (duplicate) {
      fail(row, 'code', `Mã "${code}" trùng với dòng ${duplicate.row}.`);
      continue;
    }

    const gender = parseGender(data.gender);
    if (gender === null) fail(row, 'gender', `Giới tính "${data.gender}" không hiểu được. Ghi Nam hoặc Nữ.`);
    const deceasedFlag = parseYes(data.deceased);
    if (deceasedFlag === null) fail(row, 'deceased', `Cột Đã mất ghi "${data.deceased}" không hiểu được. Ghi Có hoặc để trống.`);
    const birthOrder = parseOrder(data.birthOrder);
    if (birthOrder === 'invalid') fail(row, 'birthOrder', 'Thứ tự con là số từ 1 (con trưởng).');
    const spouseOrders = splitList(data.spouseOrder).map(parseOrder);
    if (spouseOrders.includes('invalid')) fail(row, 'spouseOrder', 'Thứ tự hôn phối là số từ 1 (vợ/chồng cả).');
    const spouseStatuses = splitCells(data.spouseStatus).map((text) => {
      const status = parseStatus(text);
      if (!status) fail(row, 'spouseStatus', `Tình trạng "${text}" không hiểu được. Ghi Còn, Ly hôn hoặc Goá.`);
      return status ?? 'con';
    });
    const marriages = splitCells(data.marriageDate).map((text): Marriage => {
      if (text === '-' || text === '') return { year: null, month: null, day: null };
      const input = parseDateText(text, { calendar: 'duong', leap: false });
      const year = input ? Number(input.year) : NaN;
      const month = input?.month ? Number(input.month) : null;
      const day = input?.day ? Number(input.day) : null;
      if (!input || year < 1 || year > 2200 || (month !== null && (month < 1 || month > 12)) || (day !== null && (day < 1 || day > 31))) {
        fail(row, 'marriageDate', `Ngày cưới "${text}" không đúng cách ghi. Ví dụ: 15/8/1950, 8/1950, 1950 hoặc dấu - nếu chưa biết.`);
        return { year: null, month: null, day: null };
      }
      return { year, month, day };
    });
    const hiddenFlag = parseYes(data.hiddenFromPublic);
    if (hiddenFlag === null) fail(row, 'hiddenFromPublic', `Cột Ẩn khỏi link công khai ghi "${data.hiddenFromPublic}" không hiểu được. Ghi Có hoặc để trống.`);
    const foundsFlag = parseYes(data.foundsBranch);
    if (foundsFlag === null) fail(row, 'foundsBranch', `Cột Lập chi mới ghi "${data.foundsBranch}" không hiểu được. Ghi Có hoặc để trống.`);
    const kindText = normalizeName(data.parentKind ?? '');
    if (!['', 'ruot', 'nuoi'].includes(kindText)) fail(row, 'parentKind', 'Ghi Ruột hoặc Nuôi.');

    const date = (textKey: 'birthDate' | 'deathDate', calendarKey: 'birthCalendar' | 'deathCalendar'): DateInput => {
      const calendar = parseCalendar(data[calendarKey]);
      if (!calendar) {
        fail(row, calendarKey, `Lịch "${data[calendarKey]}" không hiểu được. Ghi Dương, Âm hoặc Âm nhuận.`);
        return EMPTY_DATE_INPUT;
      }
      const text = data[textKey];
      if (!text) return { ...EMPTY_DATE_INPUT, calendar: calendar.calendar };
      const input = parseDateText(text, calendar);
      if (!input) {
        fail(row, textKey, `Ngày "${text}" không đúng cách ghi. Ví dụ: 15/8/1920, 8/1920 hoặc 1920.`);
        return EMPTY_DATE_INPUT;
      }
      return input;
    };
    const birth = date('birthDate', 'birthCalendar');
    const death = date('deathDate', 'deathCalendar');

    let anniversary = { manual: false, day: '', month: '' };
    if (data.anniversary) {
      const match = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(data.anniversary);
      if (match) anniversary = { manual: true, day: match[1]!, month: match[2]! };
      else fail(row, 'anniversary', 'Ngày giỗ ghi dạng ngày/tháng âm lịch, ví dụ 7/8.');
    }

    const values: PersonFormValues = {
      ...EMPTY_PERSON_FORM,
      fullName: data.fullName ?? '',
      gender: gender ?? '',
      birthOrder: typeof birthOrder === 'number' ? String(birthOrder) : '',
      commonName: data.commonName ?? '',
      tabooName: data.tabooName ?? '',
      courtesyName: data.courtesyName ?? '',
      hanName: data.hanName ?? '',
      birth,
      birthPlace: data.birthPlace ?? '',
      hometown: data.hometown ?? '',
      residence: data.residence ?? '',
      occupation: data.occupation ?? '',
      education: data.education ?? '',
      title: data.title ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
      biography: data.biography ?? '',
      roleNote: data.roleNote ?? '',
      isDeceased: deceasedFlag === true || death.year !== '' || anniversary.manual,
      death,
      anniversaryManual: anniversary.manual,
      anniversaryDay: anniversary.day,
      anniversaryMonth: anniversary.month,
      burialPlace: data.burialPlace ?? '',
      burialMapUrl: data.burialMapUrl ?? '',
      worshipPlace: data.worshipPlace ?? '',
      // Người phụ trách cúng giỗ giờ là một Người được chọn trong app, không nhập tên tay qua Excel.
      worshipKeeperId: null,
    };
    const result = parsePersonForm(values);
    if (!result.ok) {
      for (const [key, message] of Object.entries(result.errors)) {
        const column = FORM_ERROR_COLUMN[key as keyof PersonFormValues] ?? null;
        fail(row, column, key === 'fullName' ? 'Thiếu họ tên.' : (message ?? 'Giá trị chưa hợp lệ.'));
      }
    }

    const entry: ParsedRow = {
      row,
      code,
      data,
      fields: result.ok ? result.fields : null,
      gender: gender ?? '',
      spouseOrders: spouseOrders.map((order) => (typeof order === 'number' ? order : null)),
      spouseStatuses,
      marriages,
      parentKind: kindText === 'nuoi' ? 'nuoi' : 'ruot',
      hiddenFromPublic: hiddenFlag === true,
      foundsBranch: foundsFlag === true,
    };
    byCode.set(code, entry);
    parsed.push(entry);
  }

  // ---- Quan hệ ----
  const parentLinks: ImportPayload['parentLinks'] = [];
  const unions: ImportPayload['unions'] = [];
  const unionIndex = new Map<string, number>();
  const unionCount = new Map<string, number>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const addUnion = (
    a: string,
    b: string,
    orderForA: number | null,
    extra: { status: 'con' | 'ly_hon' | 'goa'; marriage: Marriage } = { status: 'con', marriage: { year: null, month: null, day: null } },
  ) => {
    const key = pairKey(a, b);
    if (unionIndex.has(key)) return;
    const orderA = orderForA ?? (unionCount.get(a) ?? 0) + 1;
    const orderB = (unionCount.get(b) ?? 0) + 1;
    unionCount.set(a, (unionCount.get(a) ?? 0) + 1);
    unionCount.set(b, (unionCount.get(b) ?? 0) + 1);
    unionIndex.set(key, unions.length);
    unions.push({
      a,
      b,
      orderA,
      orderB,
      status: extra.status,
      marriageYear: extra.marriage.year,
      marriageMonth: extra.marriage.month,
      marriageDay: extra.marriage.day,
    });
  };

  const reference = (
    entry: ParsedRow,
    column: 'fatherCode' | 'motherCode' | 'spouseCode',
    label: string,
    code = entry.data[column]?.trim(),
  ): string | null => {
    if (!code) return null;
    if (code === entry.code) {
      fail(entry.row, column, `${label} không thể là chính người này.`);
      return null;
    }
    if (!byCode.has(code)) {
      fail(entry.row, column, `${label} "${code}" không có trong file.`);
      return null;
    }
    return code;
  };

  // Hôn phối ghi ở cột "Mã vợ/chồng" được xét trước để giữ đúng Thứ tự hôn phối người dùng ghi.
  for (const entry of parsed) {
    splitList(entry.data.spouseCode).forEach((code, index) => {
      const spouse = reference(entry, 'spouseCode', 'Mã vợ/chồng', code);
      if (spouse) {
        addUnion(spouse, entry.code, entry.spouseOrders[index] ?? null, {
          status: entry.spouseStatuses[index] ?? 'con',
          marriage: entry.marriages[index] ?? { year: null, month: null, day: null },
        });
      }
    });
  }
  for (const entry of parsed) {
    const father = reference(entry, 'fatherCode', 'Mã cha');
    const mother = reference(entry, 'motherCode', 'Mã mẹ');
    if (father && mother && father === mother) {
      fail(entry.row, 'motherCode', 'Mã cha và Mã mẹ giống nhau.');
      continue;
    }
    for (const parent of [father, mother]) {
      if (parent) parentLinks.push({ child: entry.code, parent, kind: entry.parentKind });
    }
    // Cha mẹ ruột của cùng một người con là vợ chồng của nhau.
    if (father && mother && entry.parentKind === 'ruot') addUnion(father, mother, null);
  }

  for (const entry of parsed) {
    const keeper = entry.data.worshipKeeperCode?.trim();
    if (!keeper) continue;
    if (keeper === entry.code) fail(entry.row, 'worshipKeeperCode', 'Người phụ trách cúng giỗ không thể là chính người này.');
    else if (!byCode.has(keeper)) fail(entry.row, 'worshipKeeperCode', `Mã người phụ trách cúng giỗ "${keeper}" không có trong file.`);
  }

  // ---- Vòng lặp tổ tiên ----
  const cycles = findAncestorCycles(parsed.map((entry) => entry.code), parentLinks);
  for (const cycle of cycles) {
    const names = cycle.map((member) => byCode.get(member)?.data.fullName ?? member);
    fail(byCode.get(cycle[cycle.length - 1]!)!.row, 'fatherCode', `Vòng lặp tổ tiên: ${names.join(' → ')}. Một người không thể là tổ tiên của chính mình.`);
  }

  // ---- Thuỷ tổ, Đời ----
  const childrenOf = groupBy(parentLinks, (link) => link.parent, (link) => link.child);
  const parentsOf = groupBy(parentLinks, (link) => link.child, (link) => link.parent);
  const spousesOf = new Map<string, string[]>();
  for (const union of unions) {
    spousesOf.set(union.a, [...(spousesOf.get(union.a) ?? []), union.b]);
    spousesOf.set(union.b, [...(spousesOf.get(union.b) ?? []), union.a]);
  }
  const { progenitorCode, generation } = layoutGenerations({
    codes: parsed.map((entry) => entry.code),
    // Có vòng lặp thì không chọn Thuỷ tổ (lỗi đã báo ở trên).
    skip: cycles.length > 0,
    marriedIn: (code) => Boolean(byCode.get(code)?.data.spouseCode),
    childrenOf,
    parentsOf,
    spousesOf,
  });
  const progenitor = progenitorCode ? (byCode.get(progenitorCode) ?? null) : null;

  const nameOf = (code: string) => byCode.get(code)?.data.fullName ?? code;
  const people: PreviewPerson[] = parsed.map((entry) => {
    const parents = parentsOf.get(entry.code) ?? [];
    const spouses = spousesOf.get(entry.code) ?? [];
    let relation: string;
    if (entry === progenitor) relation = 'Thuỷ tổ';
    else if (!generation.has(entry.code)) relation = 'Chưa nối vào cây';
    else if (parents.length > 0) relation = `${entry.parentKind === 'nuoi' ? 'Con nuôi' : 'Con'} của ${parents.map(nameOf).join(' và ')}`;
    else relation = `${entry.gender === 'nam' ? 'Rể' : entry.gender === 'nu' ? 'Dâu' : 'Vợ/chồng'} của ${spouses.map(nameOf).join(', ')}`;
    return {
      row: entry.row,
      code: entry.code,
      name: entry.data.fullName ?? '',
      generation: generation.get(entry.code) ?? null,
      relation,
    };
  });

  errors.sort((a, b) => a.row - b.row);
  const generations = generation.size === 0 ? 0 : Math.max(...generation.values());
  const ordered = progenitor ? [progenitor, ...parsed.filter((entry) => entry !== progenitor)] : parsed;

  return {
    errors,
    people,
    total: parsed.length,
    generations,
    progenitorName: progenitor?.data.fullName ?? null,
    unconnected: people.filter((person) => person.generation === null).length,
    payload:
      errors.length > 0
        ? null
        : {
            persons: ordered.map((entry) => ({
              key: entry.code,
              fields: entry.fields!,
              hiddenFromPublic: entry.hiddenFromPublic,
              foundsBranch: entry.foundsBranch,
              worshipKeeper: entry.data.worshipKeeperCode?.trim() || null,
            })),
            parentLinks,
            unions,
            progenitor: progenitor?.code ?? null,
          },
  };
};

const emptyPreview = (errors: ImportError[]): ImportPreview => ({
  errors,
  people: [],
  total: 0,
  generations: 0,
  progenitorName: null,
  unconnected: 0,
  payload: null,
});
