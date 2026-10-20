import type { Person } from '../data/trees';
import { describeDate } from './person-display';
import { storedBirth, storedDeath, type PersonFields } from './person-form';
import { fieldLabel, fieldsOf, type ProfileTextField } from './profile-fields';

type FieldKey = keyof PersonFields;

type FieldGroup = { label: string; keys: readonly FieldKey[]; format: (person: Person) => string };

const text = (key: FieldKey) => (person: Person) => {
  const value = person[key];
  return value === null || value === undefined || value === '' ? '' : String(value);
};

const GENDER_TEXT: Record<string, string> = { nam: 'Nam', nu: 'Nữ' };

/** Nhóm của một trường chữ tự do (xem `profile-fields.ts`). */
const textGroup = (field: ProfileTextField): FieldGroup => ({
  label: fieldLabel(field.key, 'conflict'),
  keys: [field.column as FieldKey],
  format: text(field.column as FieldKey),
});

/** Các nhóm trường hiển thị khi so sánh hai bản; ngày được gộp thành một dòng dễ đọc. Các trường chữ lấy từ `profile-fields.ts`. */
const FIELD_GROUPS: readonly FieldGroup[] = [
  { label: 'Họ và tên', keys: ['full_name'], format: text('full_name') },
  { label: 'Giới tính', keys: ['gender'], format: (p) => GENDER_TEXT[p.gender ?? ''] ?? '' },
  { label: 'Thứ tự con', keys: ['birth_order'], format: text('birth_order') },
  ...fieldsOf('names').map(textGroup),
  {
    label: 'Ngày sinh',
    keys: ['birth_calendar', 'birth_precision', 'birth_year', 'birth_month', 'birth_day', 'birth_leap', 'birth_approx'],
    format: (p) => describeDate(storedBirth(p)) ?? '',
  },
  ...fieldsOf('life').map(textGroup),
  { label: 'Còn sống / đã mất', keys: ['is_deceased'], format: (p) => (p.is_deceased ? 'Đã mất' : 'Còn sống') },
  {
    label: 'Ngày mất',
    keys: ['death_calendar', 'death_precision', 'death_year', 'death_month', 'death_day', 'death_leap', 'death_approx'],
    format: (p) => describeDate(storedDeath(p)) ?? '',
  },
  {
    label: 'Ngày giỗ',
    keys: ['anniversary_day', 'anniversary_month', 'anniversary_manual'],
    format: (p) =>
      p.anniversary_day === null || p.anniversary_month === null
        ? ''
        : `${p.anniversary_day}/${p.anniversary_month} âm lịch${p.anniversary_manual ? ' (ghi tay)' : ''}`,
  },
  ...fieldsOf('death').map(textGroup),
  { label: 'Người phụ trách cúng giỗ', keys: ['worship_keeper_id'], format: text('worship_keeper_id') },
];

export type FieldDifference = { label: string; mine: string; theirs: string };

/**
 * So sánh bản người dùng định lưu với bản mới nhất trong database, theo từng trường dễ hiểu.
 * Chỉ trả về những trường hai bản khác nhau.
 */
export const diffPersonFields = (mine: PersonFields, current: Person): FieldDifference[] => {
  const minePerson: Person = { ...current, ...mine };
  return FIELD_GROUPS.flatMap((group) => {
    if (group.keys.every((key) => (mine[key] ?? null) === (current[key] ?? null))) return [];
    return [{ label: group.label, mine: group.format(minePerson) || '(trống)', theirs: group.format(current) || '(trống)' }];
  });
};
