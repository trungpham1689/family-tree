import type { CalendarEvent, CalendarMarriage, CalendarPerson, CalendarSource } from './occurrences.ts';

/**
 * Hợp đồng của "nguồn lịch" (CalendarSource): cột nào của bảng nào được đọc, dòng nào được giữ, tên cặp vợ chồng
 * ghép ra sao. Có ba bộ nạp (adapter): web (người dùng, supabase-js), Worker (service role) và hàm SQL
 * public_share.calendar_feed (link lịch đăng ký). Hai bộ đầu dùng thẳng các hằng này; bộ SQL được tests/db đối chiếu.
 */

export const CALENDAR_PERSON_COLUMNS =
  'id, tree_id, full_name, is_deceased, anniversary_day, anniversary_month, birth_solar_date, death_solar_date';
export const CALENDAR_EVENT_COLUMNS = 'id, tree_id, title, calendar, repeats_yearly, year, month, day, leap, start_time, location';
export const CALENDAR_MARRIAGE_COLUMNS =
  'id, tree_id, partner_a, marriage_year, marriage_month, marriage_day, status, a:persons!unions_partner_a_fkey(full_name), b:persons!unions_partner_b_fkey(full_name)';

/** Bộ lọc PostgREST tương đương `isCalendarPerson`, để không tải cả gia phả chỉ để lấy vài người có ngày. */
export const CALENDAR_PERSON_FILTER = 'is_deceased.eq.true,birth_solar_date.not.is.null';

/** Chỉ người đã mất (có giỗ, ngày mất) hoặc có ngày sinh dương đầy đủ mới đi vào lịch. */
export const isCalendarPerson = (person: Pick<CalendarPerson, 'is_deceased' | 'birth_solar_date'>): boolean =>
  person.is_deceased || person.birth_solar_date !== null;

/** Một dòng `unions` kèm tên hai người, như `CALENDAR_MARRIAGE_COLUMNS` trả về. */
export type MarriageRow = Omit<CalendarMarriage, 'names'> & {
  status: string;
  a: { full_name: string } | null;
  b: { full_name: string } | null;
};

export const marriageNames = (a: string | undefined, b: string | undefined): string => [a, b].filter(Boolean).join(' & ');

/** Hôn phối đủ ngày cưới và chưa ly hôn → `CalendarMarriage`. */
export const toCalendarMarriages = (rows: readonly MarriageRow[]): CalendarMarriage[] =>
  rows
    .filter((row) => row.marriage_day !== null && row.status !== 'ly_hon')
    .map(({ a, b, status: _status, ...row }) => ({ ...row, names: marriageNames(a?.full_name, b?.full_name) }));

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const hasStrings = (row: unknown, keys: readonly string[]) => isRecord(row) && keys.every((key) => typeof row[key] === 'string');

/** Kiểm hình dạng của JSON nhận từ ngoài (hàm SQL); sai thì trả null thay vì để lịch hỏng âm thầm. */
export const parseCalendarSource = (value: unknown): CalendarSource | null => {
  if (!isRecord(value)) return null;
  const { trees, persons, events, marriages } = value;
  if (!isArray(trees) || !isArray(persons) || !isArray(events) || (marriages !== undefined && !isArray(marriages))) return null;
  if (!trees.every((row) => hasStrings(row, ['id', 'name']))) return null;
  if (!persons.every((row) => hasStrings(row, ['id', 'tree_id', 'full_name']) && typeof (row as CalendarPerson).is_deceased === 'boolean')) return null;
  if (!events.every((row) => hasStrings(row, ['id', 'tree_id', 'title', 'calendar']))) return null;
  if (!(marriages ?? []).every((row) => hasStrings(row, ['id', 'tree_id', 'partner_a', 'names']))) return null;
  return {
    trees: trees as CalendarSource['trees'],
    persons: persons as CalendarPerson[],
    events: events as CalendarEvent[],
    marriages: (marriages ?? []) as CalendarMarriage[],
  };
};
