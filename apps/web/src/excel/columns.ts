import { excelColumn, TEXT_FIELDS, type TextFieldKey } from '../people/profile-fields';

/**
 * Các cột của file Excel nhập/xuất Gia phả. Tiêu đề cột là thứ người dùng thấy; khi đọc file,
 * tiêu đề được so khớp không phân biệt dấu, hoa thường, nên cột có thể xếp theo thứ tự bất kỳ.
 * Cột chữ tự do (tên khác, nơi sinh, nguyên quán…) lấy tiêu đề và hướng dẫn từ `people/profile-fields.ts`.
 */
export const COLUMNS = [
  { key: 'code', header: 'Mã', guide: 'Bắt buộc. Mã tự đặt cho từng người, không trùng nhau (ví dụ T1, A2, B15). Mã chỉ dùng để nối quan hệ trong file này, không được lưu vào hệ thống: sau khi nhập, mỗi người có id riêng do hệ thống tạo.' },
  { key: 'fullName', header: 'Họ và tên', guide: 'Bắt buộc.' },
  { key: 'gender', header: 'Giới tính', guide: 'Nam hoặc Nữ. Để trống nếu chưa rõ.' },
  { key: 'fatherCode', header: 'Mã cha', guide: 'Mã của người cha trong file (nếu có). Chỉ ghi cha mà cha có đúng một vợ thì người vợ đó tự là mẹ.' },
  { key: 'motherCode', header: 'Mã mẹ', guide: 'Mã của người mẹ trong file (nếu có). Chỉ ghi mẹ mà mẹ có đúng một chồng thì người chồng đó tự là cha.' },
  { key: 'parentKind', header: 'Con ruột/nuôi', guide: 'Ruột hoặc Nuôi. Để trống là Ruột.' },
  { key: 'birthOrder', header: 'Thứ tự con', guide: 'Số: 1 là con trưởng, 2 là con thứ hai…' },
  {
    key: 'spouseCode',
    header: 'Mã vợ/chồng',
    guide:
      'Dùng cho Dâu/Rể (người ngoài họ): ghi mã của chồng/vợ là người trong họ. Nhiều người thì cách nhau dấu phẩy: A1, A3.',
  },
  {
    key: 'spouseOrder',
    header: 'Thứ tự hôn phối',
    guide: 'Người này là vợ/chồng thứ mấy của người ở cột Mã vợ/chồng (1 = vợ cả). Nhiều người thì ghi theo thứ tự: 1, 2.',
  },
  {
    key: 'spouseStatus',
    header: 'Tình trạng hôn phối',
    guide: 'Còn, Ly hôn hoặc Goá — mỗi người ở cột Mã vợ/chồng một giá trị, cách nhau dấu phẩy. Để trống là Còn.',
  },
  {
    key: 'marriageDate',
    header: 'Ngày cưới',
    guide: 'Dương lịch, ghi như Ngày sinh (15/8/1950, 8/1950 hoặc 1950); mỗi người ở cột Mã vợ/chồng một giá trị, cách nhau dấu phẩy, chưa biết thì ghi dấu -.',
  },
  excelColumn('commonName'),
  excelColumn('tabooName'),
  excelColumn('courtesyName'),
  excelColumn('hanName'),
  {
    key: 'birthDate',
    header: 'Ngày sinh',
    guide: 'ngày/tháng/năm (15/8/1920), tháng/năm (8/1920) hoặc chỉ năm (1920). Thêm "khoảng" nếu không chắc: khoảng 1890.',
  },
  { key: 'birthCalendar', header: 'Lịch ngày sinh', guide: 'Dương, Âm, hoặc Âm nhuận (tháng nhuận). Để trống là Dương.' },
  excelColumn('birthPlace'),
  excelColumn('hometown'),
  excelColumn('residence'),
  excelColumn('occupation'),
  excelColumn('education'),
  excelColumn('title'),
  excelColumn('phone'),
  excelColumn('email'),
  excelColumn('biography'),
  excelColumn('roleNote'),
  { key: 'deceased', header: 'Đã mất', guide: 'Có hoặc để trống. Có ghi Ngày mất thì tự hiểu là đã mất.' },
  { key: 'deathDate', header: 'Ngày mất', guide: 'Cách ghi giống Ngày sinh.' },
  { key: 'deathCalendar', header: 'Lịch ngày mất', guide: 'Dương, Âm, hoặc Âm nhuận. Để trống là Dương.' },
  {
    key: 'anniversary',
    header: 'Ngày giỗ (âm)',
    guide: 'ngày/tháng âm lịch, ví dụ 7/8. Để trống thì tự tính từ ngày mất.',
  },
  excelColumn('burialPlace'),
  excelColumn('burialMapUrl'),
  excelColumn('worshipPlace'),
  { key: 'worshipKeeperCode', header: 'Mã người phụ trách cúng giỗ', guide: 'Mã của người trong file phụ trách cúng giỗ người này.' },
  { key: 'hiddenFromPublic', header: 'Ẩn khỏi link công khai', guide: 'Có hoặc để trống. Người này không hiện trên link chia sẻ công khai.' },
  { key: 'foundsBranch', header: 'Lập chi mới', guide: 'Có hoặc để trống. Đánh dấu người này là tổ của một chi.' },
] as const;

/** Tiêu đề cũ vẫn đọc được khi nhập file Excel đã tải từ trước (khai báo ở `profile-fields.ts`). */
export const HEADER_ALIASES: readonly (readonly [string, TextFieldKey])[] = TEXT_FIELDS.flatMap((field) =>
  ('excelAliases' in field ? field.excelAliases : []).map((alias): readonly [string, TextFieldKey] => [alias, field.key]),
);

export type ColumnKey = (typeof COLUMNS)[number]['key'];

export const HEADER_OF: Record<ColumnKey, string> = Object.fromEntries(
  COLUMNS.map((column) => [column.key, column.header]),
) as Record<ColumnKey, string>;

export type RawRow = Partial<Record<ColumnKey, string>>;

/**
 * Gia phả ví dụ trong file mẫu: 4 đời, có dâu, con gái, rể, cháu ngoại, ngày âm lịch,
 * người chỉ biết năm và người mất có ngày giỗ ghi tay.
 */
export const EXAMPLE_ROWS: RawRow[] = [
  { code: 'T1', fullName: 'Phạm Văn Tổ', gender: 'Nam', birthDate: 'khoảng 1850', deceased: 'Có', deathDate: '12/3/1920', deathCalendar: 'Âm', hometown: 'Nam Định' },
  { code: 'T1V', fullName: 'Nguyễn Thị Hiền', gender: 'Nữ', spouseCode: 'T1', spouseOrder: '1', deceased: 'Có', deathDate: '1925', anniversary: '9/10' },
  { code: 'A1', fullName: 'Phạm Văn Trưởng', gender: 'Nam', fatherCode: 'T1', motherCode: 'T1V', birthOrder: '1', birthDate: '1880', deceased: 'Có', deathDate: '5/6/1950' },
  { code: 'A1V', fullName: 'Trần Thị Lan', gender: 'Nữ', spouseCode: 'A1', birthDate: '1885' },
  { code: 'A2', fullName: 'Phạm Thị Thứ', gender: 'Nữ', fatherCode: 'T1', motherCode: 'T1V', birthOrder: '2', birthDate: '1884' },
  { code: 'A2C', fullName: 'Lê Văn Rể', gender: 'Nam', spouseCode: 'A2' },
  { code: 'B1', fullName: 'Phạm Văn An', gender: 'Nam', fatherCode: 'A1', motherCode: 'A1V', birthOrder: '1', birthDate: '20/1/1910', birthCalendar: 'Âm', occupation: 'Thầy giáo' },
  { code: 'B2', fullName: 'Lê Văn Ngoại', gender: 'Nam', fatherCode: 'A2C', motherCode: 'A2', birthOrder: '1', birthDate: '3/1912' },
  { code: 'C1', fullName: 'Phạm Văn Bình', gender: 'Nam', fatherCode: 'B1', birthOrder: '1', birthDate: '2/9/1945', phone: '0912345678' },
];
