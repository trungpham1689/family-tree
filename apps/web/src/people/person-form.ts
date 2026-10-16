import type { Insert } from '../data/database.types';

export type Gender = 'nam' | 'nu';

/** Giá trị thô người dùng gõ vào form Người (mọi ô đều là chuỗi). */
export type PersonFormValues = {
  fullName: string;
  gender: '' | Gender;
  birthYear: string;
  deathYear: string;
  isDeceased: boolean;
};

export type PersonFields = Pick<Insert<'persons'>, 'full_name' | 'gender' | 'birth_year' | 'death_year' | 'is_deceased'>;

export type PersonFormErrors = Partial<Record<keyof PersonFormValues, string>>;

export type PersonFormResult = { ok: true; fields: PersonFields } | { ok: false; errors: PersonFormErrors };

export const EMPTY_PERSON_FORM: PersonFormValues = {
  fullName: '',
  gender: '',
  birthYear: '',
  deathYear: '',
  isDeceased: false,
};

const MIN_YEAR = 1;
const MAX_YEAR = 2200;

const parseYear = (raw: string): { value: number | null } | { error: string } => {
  const text = raw.trim();
  if (text === '') return { value: null };
  if (!/^\d{1,4}$/.test(text)) return { error: 'Năm phải là số, ví dụ 1925.' };
  const year = Number(text);
  if (year < MIN_YEAR || year > MAX_YEAR) return { error: `Năm phải trong khoảng ${MIN_YEAR}–${MAX_YEAR}.` };
  return { value: year };
};

/** Kiểm tra và chuyển giá trị form thành các trường lưu xuống database. */
export const parsePersonForm = (values: PersonFormValues): PersonFormResult => {
  const errors: PersonFormErrors = {};

  const fullName = values.fullName.trim().replace(/\s+/g, ' ');
  if (!fullName) errors.fullName = 'Hãy nhập họ tên.';

  const birth = parseYear(values.birthYear);
  if ('error' in birth) errors.birthYear = birth.error;
  const death = parseYear(values.deathYear);
  if ('error' in death) errors.deathYear = death.error;

  const birthYear = 'value' in birth ? birth.value : null;
  const deathYear = 'value' in death ? death.value : null;
  if (birthYear !== null && deathYear !== null && deathYear < birthYear) {
    errors.deathYear = 'Năm mất không thể trước năm sinh.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    fields: {
      full_name: fullName,
      gender: values.gender === '' ? null : values.gender,
      birth_year: birthYear,
      death_year: deathYear,
      // Có năm mất nghĩa là đã mất, kể cả khi người dùng quên tích ô.
      is_deceased: values.isDeceased || deathYear !== null,
    },
  };
};

/** Đổ dữ liệu một Người đã lưu vào form để sửa. */
export const personToFormValues = (person: PersonFields): PersonFormValues => ({
  fullName: person.full_name,
  gender: person.gender === 'nam' || person.gender === 'nu' ? person.gender : '',
  birthYear: person.birth_year?.toString() ?? '',
  deathYear: person.death_year?.toString() ?? '',
  isDeceased: person.is_deceased ?? false,
});
