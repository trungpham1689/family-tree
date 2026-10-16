import { describe, expect, it } from 'vitest';
import { lifespanText } from './person-display';

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
