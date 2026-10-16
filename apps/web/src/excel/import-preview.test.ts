import { describe, expect, it } from 'vitest';
import readXlsxFile from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { COLUMNS, EXAMPLE_ROWS, type ColumnKey, type RawRow } from './columns';
import { buildImportPreview, parseDateText, type CellValue } from './import-preview';
import { DATA_SHEET, GUIDE_SHEET, templateSheets } from './template';

const HEADERS = COLUMNS.map((column) => column.header);
const table = (rows: RawRow[]): CellValue[][] => [HEADERS, ...rows.map((row) => COLUMNS.map((column) => row[column.key] ?? null))];
const preview = (rows: RawRow[]) => buildImportPreview(table(rows));
const errorAt = (rows: RawRow[], row: number, column: ColumnKey) => {
  const header = COLUMNS.find((c) => c.key === column)!.header;
  return preview(rows).errors.find((error) => error.row === row && error.column === header);
};

const base: RawRow[] = [
  { code: 'T', fullName: 'Phạm Văn Tổ', gender: 'Nam' },
  { code: 'C', fullName: 'Phạm Văn Con', gender: 'Nam', fatherCode: 'T' },
];

describe('mô-đun Excel: file mẫu', () => {
  it('file mẫu có sheet dữ liệu và sheet hướng dẫn; đọc lại ra đúng gia phả ví dụ', async () => {
    const buffer = await writeXlsxFile(templateSheets()).toBuffer();
    const sheets = await readXlsxFile(buffer);
    expect(sheets.map((sheet) => sheet.sheet)).toEqual([DATA_SHEET, GUIDE_SHEET]);

    const result = buildImportPreview(sheets[0]!.data as CellValue[][]);
    expect(result.errors).toEqual([]);
    expect(result.total).toBe(EXAMPLE_ROWS.length);
    expect(result.generations).toBe(4);
    expect(result.progenitorName).toBe('Phạm Văn Tổ');
    expect(result.unconnected).toBe(0);

    const relation = (code: string) => result.people.find((person) => person.code === code)!;
    expect(relation('T1')).toMatchObject({ generation: 1, relation: 'Thuỷ tổ' });
    expect(relation('T1V')).toMatchObject({ generation: 1, relation: 'Dâu của Phạm Văn Tổ' });
    expect(relation('A2C')).toMatchObject({ generation: 2, relation: 'Rể của Phạm Thị Thứ' });
    expect(relation('B2')).toMatchObject({ generation: 3, relation: 'Con của Lê Văn Rể và Phạm Thị Thứ' });
    expect(relation('C1')).toMatchObject({ generation: 4 });

    const payload = result.payload!;
    expect(payload.persons[0]!.key).toBe('T1');
    expect(payload.parentLinks).toHaveLength(9);
    // Hôn phối: 3 cặp ghi bằng Mã vợ/chồng; cha mẹ của các con trùng các cặp đó nên không thêm.
    expect(payload.unions).toHaveLength(3);
  });

  it('đọc đúng ngày âm, ngày giỗ ghi tay và "khoảng"', () => {
    const payload = buildImportPreview(table(EXAMPLE_ROWS)).payload!;
    const fields = (key: string) => payload.persons.find((person) => person.key === key)!.fields;
    expect(fields('T1')).toMatchObject({ birth_year: 1850, birth_approx: true, death_calendar: 'am', death_day: 12, death_month: 3 });
    expect(fields('T1')).toMatchObject({ anniversary_day: 12, anniversary_month: 3, anniversary_manual: false });
    expect(fields('T1V')).toMatchObject({ is_deceased: true, anniversary_day: 9, anniversary_month: 10, anniversary_manual: true });
    expect(fields('B1')).toMatchObject({ birth_calendar: 'am', birth_precision: 'ngay', birth_solar_date: expect.any(String) });
  });

  it('cột xếp theo thứ tự khác, tiêu đề không dấu vẫn đọc được', () => {
    const result = buildImportPreview([
      ['Ho va ten', 'MA', 'ma cha'],
      ['Tổ', 'T', null],
      ['Con', 'C', 'T'],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.generations).toBe(2);
  });

  it('đọc ô kiểu ngày của Excel', () => {
    const result = buildImportPreview([
      ['Mã', 'Họ và tên', 'Ngày sinh'],
      ['T', 'Tổ', new Date(Date.UTC(1920, 7, 15))],
    ]);
    expect(result.payload!.persons[0]!.fields).toMatchObject({ birth_day: 15, birth_month: 8, birth_year: 1920 });
  });
});

describe('mô-đun Excel: báo lỗi đúng dòng, đúng cột', () => {
  it('thiếu cột bắt buộc', () => {
    expect(buildImportPreview([['Tên'], ['A']]).errors[0]!.message).toMatch(/Không thấy cột "Mã", "Họ và tên"/);
  });

  it('thiếu mã', () => {
    expect(errorAt([...base, { fullName: 'Không mã' }], 4, 'code')?.message).toMatch(/Thiếu mã/);
  });

  it('mã trùng', () => {
    expect(errorAt([...base, { code: 'C', fullName: 'Trùng' }], 4, 'code')?.message).toBe('Mã "C" trùng với dòng 3.');
  });

  it('mã cha không tồn tại', () => {
    expect(errorAt([...base, { code: 'X', fullName: 'Lạc', fatherCode: 'Z9' }], 4, 'fatherCode')?.message).toBe(
      'Mã cha "Z9" không có trong file.',
    );
  });

  it('mã vợ/chồng không tồn tại', () => {
    expect(errorAt([...base, { code: 'V', fullName: 'Vợ', spouseCode: 'Q' }], 4, 'spouseCode')).toBeDefined();
  });

  it('ngày sai cú pháp và ngày không có thật', () => {
    expect(errorAt([{ code: 'T', fullName: 'Tổ', birthDate: 'mười tám' }], 2, 'birthDate')?.message).toMatch(/không đúng cách ghi/);
    expect(errorAt([{ code: 'T', fullName: 'Tổ', birthDate: '31/2/1920' }], 2, 'birthDate')).toBeDefined();
    expect(errorAt([{ code: 'T', fullName: 'Tổ', birthDate: '1920', birthCalendar: 'Âm xx' }], 2, 'birthCalendar')).toBeDefined();
  });

  it('vòng lặp tổ tiên', () => {
    const result = preview([
      { code: 'A', fullName: 'Ông A', fatherCode: 'C' },
      { code: 'B', fullName: 'Ông B', fatherCode: 'A' },
      { code: 'C', fullName: 'Ông C', fatherCode: 'B' },
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toMatch(/Vòng lặp tổ tiên: .*Ông A.*Ông B.*Ông C/);
    expect(result.payload).toBeNull();
  });

  it('thiếu họ tên, giới tính lạ, thứ tự con không phải số', () => {
    const rows: RawRow[] = [{ code: 'T', gender: 'Không biết', birthOrder: 'cả' }];
    expect(errorAt(rows, 2, 'fullName')?.message).toBe('Thiếu họ tên.');
    expect(errorAt(rows, 2, 'gender')).toBeDefined();
    expect(errorAt(rows, 2, 'birthOrder')).toBeDefined();
  });

  it('còn lỗi thì không có dữ liệu để lưu', () => {
    expect(preview([{ code: 'T' }]).payload).toBeNull();
  });

  it('quá 2.000 người', () => {
    const rows = Array.from({ length: 2001 }, (_, index) => ({ code: `P${index}`, fullName: `Người ${index}` }));
    expect(preview(rows).errors[0]!.message).toMatch(/tối đa 2000 người/);
  });
});

describe('parseDateText', () => {
  const duong = { calendar: 'duong' as const, leap: false };
  it.each([
    ['1920', { precision: 'nam', year: '1920', approximate: false }],
    ['8/1920', { precision: 'thang', month: '8', year: '1920' }],
    ['15-8-1920', { precision: 'ngay', day: '15', month: '8', year: '1920' }],
    ['khoảng 1890', { precision: 'nam', year: '1890', approximate: true }],
    ['~1890', { approximate: true }],
    ['1890?', { approximate: true }],
  ])('%s', (text, expected) => {
    expect(parseDateText(text, duong)).toMatchObject(expected);
  });

  it('tháng nhuận chỉ áp cho âm lịch', () => {
    expect(parseDateText('4/1900', { calendar: 'am', leap: true })).toMatchObject({ calendar: 'am', leap: true });
  });
});

describe('hiệu năng', () => {
  it('800 người, 8 đời xem trước nhanh', () => {
    const rows: RawRow[] = [{ code: 'P0', fullName: 'Tổ', gender: 'Nam' }];
    for (let index = 1; index < 800; index += 1) {
      rows.push({ code: `P${index}`, fullName: `Người ${index}`, gender: index % 2 ? 'Nam' : 'Nữ', fatherCode: `P${Math.floor((index - 1) / 2.6)}` });
    }
    const started = Date.now();
    const result = preview(rows);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.errors).toEqual([]);
    expect(result.generations).toBeGreaterThanOrEqual(7);
  });
});
