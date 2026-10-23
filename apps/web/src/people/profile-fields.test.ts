import { describe, expect, it } from 'vitest';
import { COLUMNS, HEADER_ALIASES } from '../excel/columns';
import { familyToRows, type ExportPerson } from '../excel/export';
import { buildImportPreview, type CellValue } from '../excel/import-preview';
import { blankPerson } from '../test-support/person';
import { diffPersonFields } from './person-conflict';
import { EMPTY_PERSON_FORM, parsePersonForm, personToFormValues, PERSON_FIELD_KEYS, type PersonFormValues } from './person-form';
import { fieldLabel, fieldOfColumn, fieldsOf, fieldText, textField, TEXT_FIELDS, type TextFieldKey } from './profile-fields';

describe('trường hồ sơ chữ tự do: một nơi khai báo', () => {
  it('khoá và cột không trùng; mọi cột đều là cột hồ sơ được ghi xuống database', () => {
    expect(new Set(TEXT_FIELDS.map((field) => field.key)).size).toBe(TEXT_FIELDS.length);
    expect(new Set(TEXT_FIELDS.map((field) => field.column)).size).toBe(TEXT_FIELDS.length);
    for (const field of TEXT_FIELDS) expect(PERSON_FIELD_KEYS as readonly string[], field.key).toContain(field.column);
  });

  it('form: mỗi trường có giá trị rỗng sẵn; ô nhập chia đúng khối', () => {
    for (const field of TEXT_FIELDS) expect(EMPTY_PERSON_FORM[field.key], field.key).toBe('');
    expect(fieldsOf('names', { inForm: true }).map((f) => f.key)).toEqual(['commonName', 'tabooName', 'courtesyName']);
    expect(fieldsOf('names').map((f) => f.key)).toEqual(['commonName', 'tabooName', 'courtesyName', 'hanName']);
    expect(fieldsOf('death').map((f) => f.key)).toEqual(['burialPlace', 'burialMapUrl', 'worshipPlace']);
  });

  it('nhãn: nhãn riêng từng nơi, mặc định nhãn chung', () => {
    expect(fieldLabel('hometown')).toBe('Nguyên quán');
    expect(fieldLabel('roleNote')).toBe('Ghi chú vai vế');
    expect(fieldLabel('roleNote', 'profile')).toBe('Vai vế');
    expect(fieldLabel('roleNote', 'narrative')).toBe('Vai vế');
    expect(fieldLabel('burialPlace', 'form')).toBe('Nơi an táng (mộ phần)');
    expect(fieldLabel('burialPlace', 'profile')).toBe('Mộ phần');
    expect(fieldLabel('phone', 'excel')).toBe('Điện thoại');
    expect(fieldOfColumn('hometown').key).toBe('hometown');
    expect(textField('title').column).toBe('title');
  });
});

describe('mỗi trường đi đúng đường: form → cột database → form', () => {
  const valueOf = (key: TextFieldKey) => `  giá trị ${key}  `;
  const filled = (deceased: boolean): PersonFormValues => ({
    ...EMPTY_PERSON_FORM,
    fullName: 'Phạm Tổ',
    isDeceased: deceased,
    ...(Object.fromEntries(TEXT_FIELDS.map((field) => [field.key, field.key === 'email' ? 'a@b.co' : field.key === 'burialMapUrl' ? 'https://maps.example/x' : valueOf(field.key)])) as Record<TextFieldKey, string>),
  });

  it('còn sống: mọi trường chữ lưu (bỏ khoảng trắng), trừ các trường chỉ dành cho Người đã mất', () => {
    const result = parsePersonForm(filled(false));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    for (const field of TEXT_FIELDS) {
      const expected = 'deceasedOnly' in field && field.deceasedOnly ? null : field.key === 'email' ? 'a@b.co' : valueOf(field.key).trim();
      expect(result.fields[field.column as keyof typeof result.fields], field.key).toBe(expected);
    }
  });

  it('đã mất: các trường mộ phần, link bản đồ, nơi thờ cũng lưu', () => {
    const result = parsePersonForm(filled(true));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.fields.burial_place).toBe('giá trị burialPlace');
    expect(result.fields.burial_map_url).toBe('https://maps.example/x');
    expect(result.fields.worship_place).toBe('giá trị worshipPlace');
  });

  it('lưu rồi mở lại form ra đúng giá trị', () => {
    const result = parsePersonForm(filled(true));
    if (!result.ok) throw new Error('form hỏng');
    const row = blankPerson({ id: 'p', ...result.fields } as Parameters<typeof blankPerson>[0]);
    const values = personToFormValues(row);
    for (const field of TEXT_FIELDS) expect(values[field.key], field.key).toBe(fieldText(row, field.key));
  });
});

const expectedAfterRoundTrip = (key: TextFieldKey) => (key === 'email' ? 'a@b.co' : key === 'burialMapUrl' ? 'https://maps.example/x' : `giá trị ${key}`);

describe('Excel: tiêu đề cột và vòng xuất → nhập', () => {
  it('mỗi trường có đúng một cột, tiêu đề theo nhãn Excel', () => {
    for (const field of TEXT_FIELDS) {
      const columns = COLUMNS.filter((column) => column.key === field.key);
      expect(columns, field.key).toHaveLength(1);
      expect(columns[0]!.header).toBe(fieldLabel(field.key, 'excel'));
    }
    expect(HEADER_ALIASES).toContainEqual(['Quê quán', 'hometown']);
  });

  it('xuất rồi nhập lại: từng trường giữ nguyên', () => {
    const person = blankPerson({
      id: 'to',
      full_name: 'Phạm Văn Tổ',
      gender: 'nam',
      is_progenitor: true,
      is_deceased: true,
      ...Object.fromEntries(TEXT_FIELDS.map((field) => [field.column, expectedAfterRoundTrip(field.key)])),
    } as Parameters<typeof blankPerson>[0]) as ExportPerson;
    const rows = familyToRows({ persons: [person], parentLinks: [], unions: [] });
    const table: CellValue[][] = [COLUMNS.map((column) => column.header), COLUMNS.map((column) => rows[0]![column.key] ?? null)];
    const preview = buildImportPreview(table);
    expect(preview.errors).toEqual([]);
    const imported = JSON.stringify(preview);
    for (const field of TEXT_FIELDS) expect(imported, field.key).toContain(expectedAfterRoundTrip(field.key));
  });
});

describe('so sánh xung đột: mỗi trường có dòng riêng theo nhãn', () => {
  it('chỉ trường khác nhau được liệt kê, với nhãn của nơi so sánh', () => {
    const current = blankPerson({ id: 'p', full_name: 'A', hometown: 'Hà Nội', phone: '0901', role_note: 'Trưởng chi' });
    const mine = { ...personToFormValuesFields(current), hometown: 'Huế', role_note: 'Trưởng tộc' };
    const labels = diffPersonFields(mine, current).map((difference) => difference.label);
    expect(labels).toEqual(expect.arrayContaining(['Nguyên quán', 'Ghi chú vai vế']));
    expect(labels).not.toContain('Số điện thoại');
  });
});

/** Các cột hồ sơ của một Người, như form sẽ gửi đi. */
const personToFormValuesFields = (person: ReturnType<typeof blankPerson>) => {
  const result = parsePersonForm(personToFormValues(person));
  if (!result.ok) throw new Error('form hỏng');
  return result.fields;
};
