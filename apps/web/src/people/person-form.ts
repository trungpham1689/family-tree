import { anniversaryFromDeath, type Calendar } from '@gia-pha/lunar';
import type { Insert, Row } from '../data/database.types';
import {
  dateInputFromStored,
  EMPTY_DATE_INPUT,
  NO_DATE,
  parseDateInput,
  toStoredDate,
  type DateInput,
  type Precision,
  type StoredDate,
} from './partial-date-input';

export type Gender = 'nam' | 'nu';

/** Giá trị thô của form hồ sơ Người (mọi ô là chuỗi hoặc cờ). */
export type PersonFormValues = {
  fullName: string;
  gender: '' | Gender;
  birthOrder: string;
  commonName: string;
  tabooName: string;
  courtesyName: string;
  hanName: string;
  birth: DateInput;
  birthPlace: string;
  hometown: string;
  residence: string;
  occupation: string;
  education: string;
  title: string;
  phone: string;
  email: string;
  biography: string;
  roleNote: string;
  isDeceased: boolean;
  death: DateInput;
  anniversaryManual: boolean;
  anniversaryDay: string;
  anniversaryMonth: string;
  burialPlace: string;
  burialMapUrl: string;
  worshipPlace: string;
  worshipKeeper: string;
};

/** Các cột hồ sơ được ghi xuống database. */
export const PERSON_FIELD_KEYS = [
  'full_name',
  'gender',
  'birth_order',
  'common_name',
  'taboo_name',
  'courtesy_name',
  'han_name',
  'birth_calendar',
  'birth_precision',
  'birth_year',
  'birth_month',
  'birth_day',
  'birth_leap',
  'birth_approx',
  'birth_solar_date',
  'birth_place',
  'hometown',
  'residence',
  'occupation',
  'education',
  'title',
  'phone',
  'email',
  'biography',
  'role_note',
  'is_deceased',
  'death_calendar',
  'death_precision',
  'death_year',
  'death_month',
  'death_day',
  'death_leap',
  'death_approx',
  'death_solar_date',
  'anniversary_day',
  'anniversary_month',
  'anniversary_manual',
  'burial_place',
  'burial_map_url',
  'worship_place',
  'worship_keeper',
] as const satisfies readonly (keyof Insert<'persons'>)[];

export type PersonFields = Required<Pick<Insert<'persons'>, (typeof PERSON_FIELD_KEYS)[number]>>;

export type PersonFormErrors = Partial<Record<keyof PersonFormValues, string>>;

export type PersonFormResult = { ok: true; fields: PersonFields } | { ok: false; errors: PersonFormErrors };

export const EMPTY_PERSON_FORM: PersonFormValues = {
  fullName: '',
  gender: '',
  birthOrder: '',
  commonName: '',
  tabooName: '',
  courtesyName: '',
  hanName: '',
  birth: { ...EMPTY_DATE_INPUT, precision: 'ngay' },
  birthPlace: '',
  hometown: '',
  residence: '',
  occupation: '',
  education: '',
  title: '',
  phone: '',
  email: '',
  biography: '',
  roleNote: '',
  isDeceased: false,
  death: EMPTY_DATE_INPUT,
  anniversaryManual: false,
  anniversaryDay: '',
  anniversaryMonth: '',
  burialPlace: '',
  burialMapUrl: '',
  worshipPlace: '',
  worshipKeeper: '',
};

const text = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const storedColumns = (prefix: 'birth' | 'death', stored: StoredDate) => ({
  [`${prefix}_calendar`]: stored.calendar,
  [`${prefix}_precision`]: stored.precision,
  [`${prefix}_year`]: stored.year,
  [`${prefix}_month`]: stored.month,
  [`${prefix}_day`]: stored.day,
  [`${prefix}_leap`]: stored.leap,
  [`${prefix}_approx`]: stored.approximate,
  [`${prefix}_solar_date`]: stored.solarDate,
});

/** Ngày giỗ tự suy được từ ngày mất đang nhập (để hiển thị gợi ý trong form). */
export const suggestedAnniversary = (death: DateInput) => {
  const parsed = parseDateInput(death);
  return parsed && typeof parsed !== 'string' ? anniversaryFromDeath(parsed) : null;
};

/** Kiểm tra form và chuyển thành các cột lưu xuống database, kèm các giá trị suy ra. */
export const parsePersonForm = (values: PersonFormValues): PersonFormResult => {
  const errors: PersonFormErrors = {};

  const fullName = values.fullName.trim().replace(/\s+/g, ' ');
  if (!fullName) errors.fullName = 'Hãy nhập họ tên.';

  const orderText = values.birthOrder.trim();
  const birthOrder = orderText === '' ? null : Number(orderText);
  if (birthOrder !== null && !(Number.isInteger(birthOrder) && birthOrder >= 1 && birthOrder <= 99)) {
    errors.birthOrder = 'Thứ tự con là số từ 1 đến 99 (1 là con trưởng).';
  }

  const birth = parseDateInput(values.birth);
  if (typeof birth === 'string') errors.birth = birth;

  const deceased = values.isDeceased;
  const death = deceased ? parseDateInput(values.death) : null;
  if (typeof death === 'string') errors.death = death;

  const birthYear = birth && typeof birth !== 'string' ? birth.year : null;
  const deathYear = death && typeof death !== 'string' ? death.year : null;
  if (birthYear !== null && deathYear !== null && deathYear < birthYear) {
    errors.death = 'Năm mất không thể trước năm sinh.';
  }

  let anniversary: { day: number; month: number } | null = null;
  if (deceased && values.anniversaryManual) {
    const day = Number(values.anniversaryDay.trim());
    const month = Number(values.anniversaryMonth.trim());
    if (!(Number.isInteger(day) && day >= 1 && day <= 30 && Number.isInteger(month) && month >= 1 && month <= 12)) {
      errors.anniversaryDay = 'Ngày giỗ gồm ngày (1–30) và tháng (1–12) âm lịch.';
    } else {
      anniversary = { day, month };
    }
  } else if (deceased && death && typeof death !== 'string') {
    anniversary = anniversaryFromDeath(death);
  }

  const mapUrl = text(values.burialMapUrl);
  if (deceased && mapUrl && !/^https:\/\/\S+$/.test(mapUrl)) {
    errors.burialMapUrl = 'Hãy dán đường link bắt đầu bằng https:// (lấy từ nút "Chia sẻ" của Google Maps).';
  }

  const email = text(values.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Email chưa đúng dạng.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const birthStored = toStoredDate(birth && typeof birth !== 'string' ? birth : null);
  const deathStored = toStoredDate(death && typeof death !== 'string' ? death : null);

  const fields = {
    full_name: fullName,
    gender: values.gender === '' ? null : values.gender,
    birth_order: birthOrder,
    common_name: text(values.commonName),
    taboo_name: text(values.tabooName),
    courtesy_name: text(values.courtesyName),
    han_name: text(values.hanName),
    ...storedColumns('birth', birthStored),
    birth_place: text(values.birthPlace),
    hometown: text(values.hometown),
    residence: text(values.residence),
    occupation: text(values.occupation),
    education: text(values.education),
    title: text(values.title),
    phone: text(values.phone),
    email,
    biography: text(values.biography),
    role_note: text(values.roleNote),
    is_deceased: deceased,
    ...storedColumns('death', deathStored),
    anniversary_day: anniversary?.day ?? null,
    anniversary_month: anniversary?.month ?? null,
    anniversary_manual: deceased && values.anniversaryManual,
    burial_place: deceased ? text(values.burialPlace) : null,
    burial_map_url: deceased ? mapUrl : null,
    worship_place: deceased ? text(values.worshipPlace) : null,
    worship_keeper: deceased ? text(values.worshipKeeper) : null,
  } as PersonFields;

  return { ok: true, fields };
};

const asCalendar = (value: string): Calendar => (value === 'am' ? 'am' : 'duong');
const asPrecision = (value: string | null): Precision | null =>
  value === 'nam' || value === 'thang' || value === 'ngay' ? value : null;

export const storedBirth = (person: Row<'persons'>): StoredDate =>
  person.birth_year === null
    ? NO_DATE
    : {
        calendar: asCalendar(person.birth_calendar),
        precision: asPrecision(person.birth_precision) ?? 'nam',
        year: person.birth_year,
        month: person.birth_month,
        day: person.birth_day,
        leap: person.birth_leap,
        approximate: person.birth_approx,
        solarDate: person.birth_solar_date,
      };

export const storedDeath = (person: Row<'persons'>): StoredDate =>
  person.death_year === null
    ? NO_DATE
    : {
        calendar: asCalendar(person.death_calendar),
        precision: asPrecision(person.death_precision) ?? 'nam',
        year: person.death_year,
        month: person.death_month,
        day: person.death_day,
        leap: person.death_leap,
        approximate: person.death_approx,
        solarDate: person.death_solar_date,
      };

/** Đổ dữ liệu một Người đã lưu vào form để sửa. */
export const personToFormValues = (person: Row<'persons'>): PersonFormValues => ({
  fullName: person.full_name,
  gender: person.gender === 'nam' || person.gender === 'nu' ? person.gender : '',
  birthOrder: person.birth_order?.toString() ?? '',
  commonName: person.common_name ?? '',
  tabooName: person.taboo_name ?? '',
  courtesyName: person.courtesy_name ?? '',
  hanName: person.han_name ?? '',
  birth: dateInputFromStored(storedBirth(person)),
  birthPlace: person.birth_place ?? '',
  hometown: person.hometown ?? '',
  residence: person.residence ?? '',
  occupation: person.occupation ?? '',
  education: person.education ?? '',
  title: person.title ?? '',
  phone: person.phone ?? '',
  email: person.email ?? '',
  biography: person.biography ?? '',
  roleNote: person.role_note ?? '',
  isDeceased: person.is_deceased,
  death: dateInputFromStored(storedDeath(person)),
  anniversaryManual: person.anniversary_manual,
  anniversaryDay: person.anniversary_day?.toString() ?? '',
  anniversaryMonth: person.anniversary_month?.toString() ?? '',
  burialPlace: person.burial_place ?? '',
  burialMapUrl: person.burial_map_url ?? '',
  worshipPlace: person.worship_place ?? '',
  worshipKeeper: person.worship_keeper ?? '',
});
