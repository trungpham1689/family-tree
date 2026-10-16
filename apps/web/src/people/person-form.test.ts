import { describe, expect, it } from 'vitest';
import { EMPTY_PERSON_FORM, parsePersonForm, personToFormValues } from './person-form';

describe('parsePersonForm', () => {
  it('chuẩn hoá họ tên và đổi năm sang số', () => {
    const result = parsePersonForm({
      ...EMPTY_PERSON_FORM,
      fullName: '  Phạm   Văn  Tổ ',
      gender: 'nam',
      birthYear: '1850',
      deathYear: '1920',
    });

    expect(result).toEqual({
      ok: true,
      fields: { full_name: 'Phạm Văn Tổ', gender: 'nam', birth_year: 1850, death_year: 1920, is_deceased: true },
    });
  });

  it('cho phép bỏ trống giới tính và năm', () => {
    const result = parsePersonForm({ ...EMPTY_PERSON_FORM, fullName: 'Bà Cả' });

    expect(result).toEqual({
      ok: true,
      fields: { full_name: 'Bà Cả', gender: null, birth_year: null, death_year: null, is_deceased: false },
    });
  });

  it('giữ trạng thái đã mất khi không biết năm mất', () => {
    const result = parsePersonForm({ ...EMPTY_PERSON_FORM, fullName: 'Cụ Tổ', isDeceased: true });

    expect(result.ok && result.fields.is_deceased).toBe(true);
  });

  it('báo lỗi khi thiếu họ tên', () => {
    expect(parsePersonForm({ ...EMPTY_PERSON_FORM, fullName: '   ' })).toEqual({
      ok: false,
      errors: { fullName: 'Hãy nhập họ tên.' },
    });
  });

  it.each([
    ['abc', 'Năm phải là số, ví dụ 1925.'],
    ['19.5', 'Năm phải là số, ví dụ 1925.'],
    ['0', 'Năm phải trong khoảng 1–2200.'],
    ['3000', 'Năm phải trong khoảng 1–2200.'],
  ])('báo lỗi năm sinh "%s"', (birthYear, message) => {
    expect(parsePersonForm({ ...EMPTY_PERSON_FORM, fullName: 'A', birthYear })).toEqual({
      ok: false,
      errors: { birthYear: message },
    });
  });

  it('báo lỗi khi năm mất trước năm sinh', () => {
    expect(parsePersonForm({ ...EMPTY_PERSON_FORM, fullName: 'A', birthYear: '1900', deathYear: '1890' })).toEqual({
      ok: false,
      errors: { deathYear: 'Năm mất không thể trước năm sinh.' },
    });
  });
});

describe('personToFormValues', () => {
  it('đổ ngược dữ liệu đã lưu vào form', () => {
    expect(
      personToFormValues({ full_name: 'Phạm Văn Tổ', gender: 'nam', birth_year: 1850, death_year: null, is_deceased: true }),
    ).toEqual({ fullName: 'Phạm Văn Tổ', gender: 'nam', birthYear: '1850', deathYear: '', isDeceased: true });
  });
});
