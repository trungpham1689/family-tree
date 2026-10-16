import { describe, expect, it } from 'vitest';
import type { Person } from '../data/trees';
import { diffPersonFields } from './person-conflict';
import { EMPTY_PERSON_FORM, parsePersonForm, type PersonFields } from './person-form';

const fieldsOf = (overrides: Partial<typeof EMPTY_PERSON_FORM>): PersonFields => {
  const result = parsePersonForm({ ...EMPTY_PERSON_FORM, fullName: 'Phạm Văn An', ...overrides });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.fields;
};

const saved = (fields: PersonFields): Person =>
  ({ id: 'p1', tree_id: 't1', version: 2, is_progenitor: false, created_at: '', updated_at: '', ...fields }) as Person;

describe('diffPersonFields', () => {
  it('không khác gì thì không có dòng nào', () => {
    const fields = fieldsOf({ occupation: 'Thầy đồ' });
    expect(diffPersonFields(fields, saved(fields))).toEqual([]);
  });

  it('liệt kê từng trường khác nhau với nhãn dễ hiểu', () => {
    const mine = fieldsOf({ occupation: 'Thầy đồ', hometown: 'Nam Định' });
    const theirs = saved(fieldsOf({ occupation: 'Lý trưởng', hometown: 'Nam Định', phone: '0912345678' }));
    expect(diffPersonFields(mine, theirs)).toEqual([
      { label: 'Nghề nghiệp', mine: 'Thầy đồ', theirs: 'Lý trưởng' },
      { label: 'Số điện thoại', mine: '(trống)', theirs: '0912345678' },
    ]);
  });

  it('gộp các cột ngày thành một dòng', () => {
    const mine = fieldsOf({ birth: { ...EMPTY_PERSON_FORM.birth, year: '1890' } });
    const theirs = saved(fieldsOf({ birth: { ...EMPTY_PERSON_FORM.birth, year: '1891' } }));
    const rows = diffPersonFields(mine, theirs);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: 'Ngày sinh' });
    expect(rows[0]!.mine).toContain('1890');
    expect(rows[0]!.theirs).toContain('1891');
  });
});
