/**
 * Các cột của file Excel nhập/xuất Gia phả. Tiêu đề cột là thứ người dùng thấy; khi đọc file,
 * tiêu đề được so khớp không phân biệt dấu, hoa thường, nên cột có thể xếp theo thứ tự bất kỳ.
 */
export const COLUMNS = [
  { key: 'code', header: 'Mã', guide: 'Bắt buộc. Mã tự đặt cho từng người, không trùng nhau (ví dụ T1, A2, B15).' },
  { key: 'fullName', header: 'Họ và tên', guide: 'Bắt buộc.' },
  { key: 'gender', header: 'Giới tính', guide: 'Nam hoặc Nữ. Để trống nếu chưa rõ.' },
  { key: 'fatherCode', header: 'Mã cha', guide: 'Mã của người cha trong file (nếu có).' },
  { key: 'motherCode', header: 'Mã mẹ', guide: 'Mã của người mẹ trong file (nếu có).' },
  { key: 'parentKind', header: 'Con ruột/nuôi', guide: 'Ruột hoặc Nuôi. Để trống là Ruột.' },
  { key: 'birthOrder', header: 'Thứ tự con', guide: 'Số: 1 là con trưởng, 2 là con thứ hai…' },
  {
    key: 'spouseCode',
    header: 'Mã vợ/chồng',
    guide: 'Dùng cho Dâu/Rể (người ngoài họ): ghi mã của chồng/vợ là người trong họ.',
  },
  { key: 'spouseOrder', header: 'Thứ tự hôn phối', guide: 'Người này là vợ/chồng thứ mấy (1 = vợ cả). Để trống là 1.' },
  { key: 'commonName', header: 'Tên thường gọi', guide: '' },
  { key: 'tabooName', header: 'Tên huý', guide: '' },
  { key: 'courtesyName', header: 'Tên tự/hiệu', guide: '' },
  { key: 'hanName', header: 'Tên chữ Hán', guide: '' },
  {
    key: 'birthDate',
    header: 'Ngày sinh',
    guide: 'ngày/tháng/năm (15/8/1920), tháng/năm (8/1920) hoặc chỉ năm (1920). Thêm "khoảng" nếu không chắc: khoảng 1890.',
  },
  { key: 'birthCalendar', header: 'Lịch ngày sinh', guide: 'Dương, Âm, hoặc Âm nhuận (tháng nhuận). Để trống là Dương.' },
  { key: 'birthPlace', header: 'Nơi sinh', guide: '' },
  { key: 'hometown', header: 'Quê quán', guide: '' },
  { key: 'residence', header: 'Nơi ở', guide: '' },
  { key: 'occupation', header: 'Nghề nghiệp', guide: '' },
  { key: 'education', header: 'Học vấn', guide: '' },
  { key: 'title', header: 'Chức vụ/danh hiệu', guide: '' },
  { key: 'phone', header: 'Điện thoại', guide: '' },
  { key: 'email', header: 'Email', guide: '' },
  { key: 'biography', header: 'Tiểu sử', guide: '' },
  { key: 'roleNote', header: 'Ghi chú vai vế', guide: '' },
  { key: 'deceased', header: 'Đã mất', guide: 'Có hoặc để trống. Có ghi Ngày mất thì tự hiểu là đã mất.' },
  { key: 'deathDate', header: 'Ngày mất', guide: 'Cách ghi giống Ngày sinh.' },
  { key: 'deathCalendar', header: 'Lịch ngày mất', guide: 'Dương, Âm, hoặc Âm nhuận. Để trống là Dương.' },
  {
    key: 'anniversary',
    header: 'Ngày giỗ (âm)',
    guide: 'ngày/tháng âm lịch, ví dụ 7/8. Để trống thì tự tính từ ngày mất.',
  },
  { key: 'burialPlace', header: 'Mộ phần', guide: 'Mô tả nơi đặt mộ.' },
  { key: 'burialMapUrl', header: 'Link vị trí mộ', guide: 'Link Google Maps, bắt đầu bằng https://' },
  { key: 'worshipPlace', header: 'Nơi thờ', guide: '' },
  { key: 'worshipKeeper', header: 'Người phụ trách cúng giỗ', guide: '' },
] as const;

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
