import { describe, expect, it } from 'vitest';
import type { Row } from '../data/database.types';
import { EMPTY_DATE_INPUT } from './partial-date-input';
import { EMPTY_PERSON_FORM, parsePersonForm, personToFormValues, suggestedAnniversary, type PersonFormValues } from './person-form';

const form = (overrides: Partial<PersonFormValues>): PersonFormValues => ({ ...EMPTY_PERSON_FORM, fullName: 'Phạm Văn Tổ', ...overrides });

const parse = (overrides: Partial<PersonFormValues>) => {
  const result = parsePersonForm(form(overrides));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.fields;
};

describe('parsePersonForm', () => {
  it('chuẩn hoá họ tên, bỏ trống các trường không nhập', () => {
    const fields = parse({ fullName: '  Phạm   Văn  Tổ ', hometown: '  Nam Định ' });
    expect(fields).toMatchObject({ full_name: 'Phạm Văn Tổ', hometown: 'Nam Định', occupation: null, birth_year: null });
  });

  it('chỉ biết năm sinh, kèm "khoảng"', () => {
    const fields = parse({ birth: { ...EMPTY_DATE_INPUT, year: '1890', approximate: true } });
    expect(fields).toMatchObject({
      birth_calendar: 'duong',
      birth_precision: 'nam',
      birth_year: 1890,
      birth_month: null,
      birth_day: null,
      birth_approx: true,
      birth_solar_date: null,
    });
  });

  it('biết tháng-năm âm có nhuận', () => {
    const fields = parse({ birth: { ...EMPTY_DATE_INPUT, calendar: 'am', precision: 'thang', year: '2025', month: '6', leap: true } });
    expect(fields).toMatchObject({ birth_calendar: 'am', birth_precision: 'thang', birth_month: 6, birth_leap: true });
  });

  it('ngày sinh âm đầy đủ thì có luôn ngày dương', () => {
    const fields = parse({
      birth: { ...EMPTY_DATE_INPUT, calendar: 'am', precision: 'ngay', year: '2026', month: '1', day: '1' },
    });
    expect(fields).toMatchObject({ birth_calendar: 'am', birth_day: 1, birth_solar_date: '2026-02-17' });
  });

  it('ngày mất dương đầy đủ thì tự điền ngày giỗ âm', () => {
    const fields = parse({
      isDeceased: true,
      death: { ...EMPTY_DATE_INPUT, precision: 'ngay', year: '2025', month: '8', day: '10' },
    });
    expect(fields).toMatchObject({
      is_deceased: true,
      death_solar_date: '2025-08-10',
      anniversary_day: 16,
      anniversary_month: 6,
      anniversary_manual: false,
    });
  });

  it('giữ ngày giỗ sửa tay', () => {
    const fields = parse({
      isDeceased: true,
      death: { ...EMPTY_DATE_INPUT, precision: 'ngay', year: '2025', month: '8', day: '10' },
      anniversaryManual: true,
      anniversaryDay: '16',
      anniversaryMonth: '6',
    });
    expect(fields).toMatchObject({ anniversary_day: 16, anniversary_month: 6, anniversary_manual: true });
  });

  it('chỉ biết ngày giỗ, không biết năm mất', () => {
    const fields = parse({ isDeceased: true, anniversaryManual: true, anniversaryDay: '7', anniversaryMonth: '8' });
    expect(fields).toMatchObject({ death_year: null, anniversary_day: 7, anniversary_month: 8 });
  });

  it('người còn sống thì bỏ mọi thông tin mất & thờ cúng', () => {
    const fields = parse({
      isDeceased: false,
      death: { ...EMPTY_DATE_INPUT, year: '2000' },
      anniversaryManual: true,
      anniversaryDay: '1',
      anniversaryMonth: '1',
      burialPlace: 'Nghĩa trang',
    });
    expect(fields).toMatchObject({ death_year: null, anniversary_day: null, burial_place: null, is_deceased: false });
  });

  it.each([
    [{ fullName: '  ' }, 'fullName'],
    [{ birth: { ...EMPTY_DATE_INPUT, year: 'năm ấy' } }, 'birth'],
    [{ birth: { ...EMPTY_DATE_INPUT, precision: 'ngay' as const, year: '2025', month: '2', day: '29' } }, 'birth'],
    [{ birth: { ...EMPTY_DATE_INPUT, precision: 'thang' as const, year: '2025' } }, 'birth'],
    [
      { birth: { ...EMPTY_DATE_INPUT, year: '1950' }, isDeceased: true, death: { ...EMPTY_DATE_INPUT, year: '1940' } },
      'death',
    ],
    [{ isDeceased: true, anniversaryManual: true, anniversaryDay: '31', anniversaryMonth: '1' }, 'anniversaryDay'],
    [{ isDeceased: true, burialMapUrl: 'maps.google.com/x' }, 'burialMapUrl'],
    [{ email: 'khong-phai-email' }, 'email'],
    [{ birthOrder: '0' }, 'birthOrder'],
  ])('báo lỗi %o ở ô %s', (overrides, field) => {
    const result = parsePersonForm(form(overrides));
    expect(result.ok).toBe(false);
    expect(Object.keys(result.ok ? {} : result.errors)).toEqual([field]);
  });
});

describe('suggestedAnniversary', () => {
  it('gợi ý ngày giỗ khi đủ ngày mất, không gợi ý khi chỉ có năm', () => {
    expect(suggestedAnniversary({ ...EMPTY_DATE_INPUT, precision: 'ngay', year: '2026', month: '2', day: '17' })).toEqual({
      day: 29,
      month: 12,
    });
    expect(suggestedAnniversary({ ...EMPTY_DATE_INPUT, year: '2026' })).toBeNull();
  });
});

describe('personToFormValues', () => {
  it('lưu rồi mở lại form cho ra đúng giá trị đã nhập', () => {
    const values = form({
      gender: 'nam',
      birthOrder: '2',
      birth: { ...EMPTY_DATE_INPUT, calendar: 'am', precision: 'ngay', year: '1925', month: '3', day: '15' },
      isDeceased: true,
      death: { ...EMPTY_DATE_INPUT, precision: 'thang', year: '1990', month: '4' },
      anniversaryManual: true,
      anniversaryDay: '12',
      anniversaryMonth: '3',
      burialMapUrl: 'https://maps.app.goo.gl/x',
      hanName: '范公',
    });
    const result = parsePersonForm(values);
    if (!result.ok) throw new Error('form phải hợp lệ');
    const row = { ...result.fields, id: 'x', tree_id: 't', is_progenitor: false, created_at: '', updated_at: '' } as Row<'persons'>;

    expect(personToFormValues(row)).toEqual(values);
  });
});
