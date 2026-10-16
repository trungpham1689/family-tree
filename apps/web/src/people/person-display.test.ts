import { describe, expect, it } from 'vitest';
import { NO_DATE } from './partial-date-input';
import { ageAtDeath, anniversaryText, describeDate, lifespanText } from './person-display';

describe('lifespanText', () => {
  it.each([
    [{ birth_year: 1850, death_year: 1920, is_deceased: true }, '1850 – 1920'],
    [{ birth_year: 1960, death_year: null, is_deceased: false }, 'Sinh 1960'],
    [{ birth_year: 1850, death_year: null, is_deceased: true }, '1850 – ?'],
    [{ birth_year: null, death_year: 1920, is_deceased: true }, '? – 1920'],
    [{ birth_year: null, death_year: null, is_deceased: true }, 'Đã mất'],
    [{ birth_year: null, death_year: null, is_deceased: false }, ''],
  ])('%o → "%s"', (input, expected) => {
    expect(lifespanText(input)).toBe(expected);
  });
});

describe('ageAtDeath', () => {
  it('tính theo tuổi mụ: năm mất − năm sinh + 1', () => {
    expect(ageAtDeath({ birth_year: 1850, death_year: 1920, is_deceased: true })).toBe(71);
  });

  it('không tính khi thiếu năm hoặc còn sống', () => {
    expect(ageAtDeath({ birth_year: 1850, death_year: null, is_deceased: true })).toBeNull();
    expect(ageAtDeath({ birth_year: 1950, death_year: null, is_deceased: false })).toBeNull();
  });
});

describe('describeDate', () => {
  it('ngày đầy đủ kèm lịch còn lại', () => {
    expect(
      describeDate({ ...NO_DATE, precision: 'ngay', year: 2026, month: 2, day: 17, solarDate: '2026-02-17' }),
    ).toBe('17/02/2026 (âm: 1/1/2026)');
  });

  it('chỉ có năm', () => {
    expect(describeDate({ ...NO_DATE, precision: 'nam', year: 1890, approximate: true })).toBe('khoảng 1890');
  });

  it('không có ngày', () => {
    expect(describeDate(NO_DATE)).toBeNull();
  });
});

describe('anniversaryText', () => {
  it('hiện ngày âm và lần giỗ tới', () => {
    expect(anniversaryText({ day: 1, month: 1 }, { year: 2026, month: 1, day: 1 })).toBe(
      'Ngày 1 tháng 1 âm lịch — lần tới: 17/2/2026',
    );
  });

  it('không có ngày giỗ', () => {
    expect(anniversaryText({ day: null, month: null }, { year: 2026, month: 1, day: 1 })).toBeNull();
  });
});
