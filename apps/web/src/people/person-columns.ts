import { PERSON_FIELD_KEYS } from './person-form';

/**
 * Phân loại mọi cột của bảng `persons`. Danh sách trường hồ sơ có đúng một nơi định nghĩa (PERSON_FIELD_KEYS);
 * file này nói thêm: cột nào do hệ thống giữ, và trường hồ sơ nào hiện trên link công khai. tests/db/person-fields.test.ts
 * đối chiếu với database nên thêm một cột mà chưa phân loại ở đây, hoặc quên cập nhật insert_person / public_tree, sẽ làm test hỏng.
 */

/** Cột không phải trường hồ sơ: do hệ thống, trigger hoặc thao tác riêng ghi. */
export const PERSON_SYSTEM_COLUMNS = [
  'id',
  'tree_id',
  'created_at',
  'updated_at',
  'created_by',
  'version',
  'is_progenitor',
  'founds_branch',
  'hidden_from_public',
  'pending_delete_by',
  'pending_delete_at',
  'avatar_path',
  // Cột chữ cũ, không còn ghi (thay bằng worship_keeper_id).
  'worship_keeper',
] as const;

/** Trường hồ sơ luôn có trong bản công khai (với Người không bị ẩn), kể cả Người còn sống. */
/** `birth_precision` hiện rút gọn thành "năm" cho Người còn sống; chi tiết đầy đủ chỉ khi đã mất. */
export const PUBLIC_BASE_FIELDS = ['full_name', 'gender', 'is_deceased', 'birth_order', 'birth_year', 'birth_precision', 'birth_approx'] as const satisfies readonly (typeof PERSON_FIELD_KEYS)[number][];

/** Trường hồ sơ chỉ hiện trên bản công khai khi Người đã mất. */
export const PUBLIC_WHEN_DECEASED_FIELDS = [
  'birth_calendar',
  'birth_month',
  'birth_day',
  'birth_leap',
  'birth_solar_date',
  'birth_place',
  'common_name',
  'taboo_name',
  'courtesy_name',
  'han_name',
  'hometown',
  'residence',
  'occupation',
  'education',
  'title',
  'biography',
  'role_note',
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
  'worship_place',
] as const satisfies readonly (typeof PERSON_FIELD_KEYS)[number][];

/** Trường hồ sơ không bao giờ hiện trên bản công khai (thông tin riêng tư). */
export const PUBLIC_NEVER_FIELDS = [
  'phone',
  'email',
  'burial_place',
  'burial_map_url',
  'worship_keeper_id',
  'anniversary_manual',
] as const satisfies readonly (typeof PERSON_FIELD_KEYS)[number][];
