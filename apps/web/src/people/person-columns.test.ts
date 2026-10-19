import { describe, expect, it } from 'vitest';
import { diffPersonFields } from './person-conflict';
import { PUBLIC_BASE_FIELDS, PUBLIC_NEVER_FIELDS, PUBLIC_WHEN_DECEASED_FIELDS } from './person-columns';
import { PERSON_FIELD_KEYS, type PersonFields } from './person-form';
import { BLANK_PERSON } from '../data/blank-person';

describe('phân loại trường hồ sơ', () => {
  it('mỗi trường hồ sơ thuộc đúng một nhóm riêng tư (luôn hiện / khi đã mất / không bao giờ)', () => {
    const groups = [PUBLIC_BASE_FIELDS, PUBLIC_WHEN_DECEASED_FIELDS, PUBLIC_NEVER_FIELDS] as readonly (readonly string[])[];
    const all = groups.flat();
    expect(new Set(all).size).toBe(all.length); // không trường nào ở hai nhóm
    expect([...all].sort()).toEqual([...PERSON_FIELD_KEYS].sort()); // không trường nào chưa được phân loại
  });
});

describe('so sánh xung đột', () => {
  it('mọi trường hồ sơ đều được so sánh (trừ ngày dương tự tính)', () => {
    const current = BLANK_PERSON;
    const base = Object.fromEntries(PERSON_FIELD_KEYS.map((key) => [key, current[key]])) as PersonFields;
    for (const key of PERSON_FIELD_KEYS) {
      if (key === 'birth_solar_date' || key === 'death_solar_date') continue;
      const mine = { ...base, [key]: typeof current[key] === 'boolean' ? !current[key] : 'khác' } as PersonFields;
      expect(diffPersonFields(mine, current).length, key).toBeGreaterThan(0);
    }
  });
});
