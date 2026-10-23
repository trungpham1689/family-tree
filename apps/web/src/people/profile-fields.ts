import type { Row } from '../data/database.types';

/**
 * Các trường hồ sơ Người là chữ tự do (tên khác, nơi sinh, nguyên quán, nghề nghiệp…): MỘT nơi khai báo cho cả form, hồ sơ, so sánh xung đột,
 * Excel (nhập, xuất, mẫu), Phả ký, dòng thêm trong ô Phả đồ. Thêm một trường, đổi nhãn, đổi cột Excel đều chỉ sửa ở đây.
 * Các trường có cách xử lý riêng (ngày sinh/mất, giới tính, ngày giỗ, người phụ trách…) không nằm ở đây.
 */

type TextColumn = Exclude<
  keyof Row<'persons'>,
  'id' | 'tree_id' | 'version' | 'created_at' | 'updated_at' | 'created_by' | 'pending_delete_by' | 'pending_delete_at' | 'avatar_path'
>;

/** Mỗi trường: `key` là tên ở form và cột Excel (camelCase), `column` là cột database; nhãn mỗi nơi mặc định là `label`. */
type TextFieldDef = {
  key: string;
  column: TextColumn;
  label: string;
  /** Nhãn riêng từng nơi khi khác `label`. */
  labels?: { form?: string; profile?: string; conflict?: string; excel?: string; narrative?: string };
  /** Hướng dẫn ngắn dưới ô nhập, và ghi chú ở trang hướng dẫn của file Excel mẫu. */
  hint?: string;
  excelGuide?: string;
  /** Tiêu đề cột Excel cũ vẫn đọc được khi nhập. */
  excelAliases?: readonly string[];
  /** Nhóm: tên khác / đời sống (phần "Thêm thông tin" của form), hay nhóm "Đã mất". */
  group: 'names' | 'life' | 'death';
  /** Form có ô nhập cho trường này không (mặc định có); tên chữ Hán chỉ nhập qua Excel. */
  inForm?: false;
  multiline?: boolean;
  /** Chỉ lưu khi Người đã mất (tắt "Đã mất" thì xoá). */
  deceasedOnly?: boolean;
  /** Cách hiện ở trang hồ sơ: chữ thường, liên kết gọi điện / gửi thư, hay không hiện. */
  profile?: 'text' | 'tel' | 'mailto' | 'hidden';
};

const defineFields = <const Fields extends readonly TextFieldDef[]>(fields: Fields) => fields;

export const TEXT_FIELDS = defineFields([
  { key: 'commonName', column: 'common_name', label: 'Tên thường gọi', group: 'names' },
  { key: 'tabooName', column: 'taboo_name', label: 'Tên huý', hint: 'Tên kiêng, con cháu tránh đặt trùng.', group: 'names' },
  { key: 'courtesyName', column: 'courtesy_name', label: 'Tên tự / hiệu', labels: { form: 'Tên tự / tên hiệu', excel: 'Tên tự/hiệu' }, group: 'names' },
  { key: 'hanName', column: 'han_name', label: 'Tên chữ Hán', group: 'names', inForm: false, profile: 'hidden' },
  { key: 'birthPlace', column: 'birth_place', label: 'Nơi sinh', group: 'life' },
  { key: 'hometown', column: 'hometown', label: 'Nguyên quán', excelAliases: ['Quê quán'], group: 'life' },
  { key: 'residence', column: 'residence', label: 'Nơi ở', group: 'life' },
  { key: 'occupation', column: 'occupation', label: 'Nghề nghiệp', group: 'life' },
  { key: 'education', column: 'education', label: 'Học vấn', group: 'life' },
  { key: 'title', column: 'title', label: 'Chức vụ / danh hiệu', labels: { excel: 'Chức vụ/danh hiệu' }, group: 'life' },
  {
    key: 'roleNote',
    column: 'role_note',
    label: 'Ghi chú vai vế',
    labels: { profile: 'Vai vế', narrative: 'Vai vế' },
    hint: 'Ví dụ: Trưởng chi 2, Trưởng tộc',
    group: 'life',
  },
  { key: 'phone', column: 'phone', label: 'Số điện thoại', labels: { excel: 'Điện thoại', profile: 'Điện thoại' }, group: 'life', profile: 'tel' },
  { key: 'email', column: 'email', label: 'Email', group: 'life', profile: 'mailto' },
  { key: 'biography', column: 'biography', label: 'Tiểu sử', group: 'life', multiline: true, profile: 'hidden', excelGuide: '' },
  {
    key: 'burialPlace',
    column: 'burial_place',
    label: 'Mộ phần',
    labels: { form: 'Nơi an táng (mộ phần)' },
    excelGuide: 'Mô tả nơi đặt mộ.',
    group: 'death',
    deceasedOnly: true,
  },
  {
    key: 'burialMapUrl',
    column: 'burial_map_url',
    label: 'Link vị trí mộ',
    hint: 'Mở Google Maps tại vị trí mộ → Chia sẻ → Sao chép đường link rồi dán vào đây.',
    excelGuide: 'Link Google Maps, bắt đầu bằng https://',
    group: 'death',
    deceasedOnly: true,
    profile: 'hidden',
  },
  { key: 'worshipPlace', column: 'worship_place', label: 'Nơi thờ', group: 'death', deceasedOnly: true },
] as const);

export type TextFieldKey = (typeof TEXT_FIELDS)[number]['key'];
export type TextFieldColumn = (typeof TEXT_FIELDS)[number]['column'];
type Fields = typeof TEXT_FIELDS;
type FieldOf<Key extends TextFieldKey> = Extract<Fields[number], { key: Key }>;

const BY_KEY = new Map<string, Fields[number]>(TEXT_FIELDS.map((field) => [field.key, field]));
export const textField = <Key extends TextFieldKey>(key: Key): FieldOf<Key> => BY_KEY.get(key) as FieldOf<Key>;

/** Nhãn của một trường ở một nơi: nhãn riêng của nơi đó nếu có, không thì nhãn chung. */
export const fieldLabel = (key: TextFieldKey, place?: 'form' | 'profile' | 'conflict' | 'excel' | 'narrative'): string => {
  const field = textField(key) as TextFieldDef;
  return (place ? field.labels?.[place] : undefined) ?? field.label;
};

/** Trường theo cột database (cho các nơi đọc cột của Người, như Phả ký). */
export const fieldOfColumn = (column: TextFieldColumn): TextFieldDef => TEXT_FIELDS.find((field) => field.column === column) as TextFieldDef;

export type ProfileTextField = Fields[number];
/** Các trường của một nhóm, theo thứ tự khai báo. `inForm`: chỉ những trường có ô nhập ở form. */
export const fieldsOf = (group: 'names' | 'life' | 'death', options: { inForm?: boolean } = {}): readonly ProfileTextField[] =>
  TEXT_FIELDS.filter((field) => field.group === group && (!options.inForm || !('inForm' in field) || field.inForm !== false));
/** Các trường có ô nhập ở một khối của form. */
export const formFields = (group: 'names' | 'life' | 'death'): readonly ProfileTextField[] => fieldsOf(group, { inForm: true });

/** Cột Excel của một trường (tiêu đề + hướng dẫn); dùng khi xếp danh sách cột Excel theo thứ tự muốn hiện. */
export const excelColumn = <Key extends TextFieldKey>(key: Key) => ({
  key,
  header: fieldLabel(key, 'excel'),
  guide: ((textField(key) as TextFieldDef).excelGuide ?? ''),
});

/** Chữ của một trường trên một Người (rỗng khi chưa có). */
export const fieldText = (person: Readonly<Record<string, unknown>>, key: TextFieldKey): string => {
  const value = person[(textField(key) as TextFieldDef).column];
  return typeof value === 'string' ? value : '';
};
