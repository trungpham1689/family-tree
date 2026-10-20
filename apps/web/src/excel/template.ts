import type { SheetData } from 'write-excel-file/universal';
import { COLUMNS, EXAMPLE_ROWS } from './columns';

export const DATA_SHEET = 'Gia phả';
export const GUIDE_SHEET = 'Hướng dẫn';

const header = (text: string) => ({ value: text, fontWeight: 'bold' as const });

/** Hai sheet của file mẫu: bảng dữ liệu (kèm ví dụ) và hướng dẫn điền. */
export const templateSheets = (): { sheet: string; data: SheetData; columns: { width: number }[] }[] => [
  {
    sheet: DATA_SHEET,
    columns: COLUMNS.map((column) => ({ width: Math.max(12, column.header.length + 4) })),
    data: [
      COLUMNS.map((column) => header(column.header)),
      ...EXAMPLE_ROWS.map((row) => COLUMNS.map((column) => row[column.key] ?? null)),
    ],
  },
  {
    sheet: GUIDE_SHEET,
    columns: [{ width: 28 }, { width: 100 }],
    data: [
      [header('Cách điền file gia phả'), null],
      ['Mỗi dòng', 'Một người trong gia phả, kể cả dâu, rể.'],
      ['Nối quan hệ', 'Dùng mã: ghi "Mã cha", "Mã mẹ" cho con; ghi "Mã vợ/chồng" cho dâu, rể.'],
      ['Mã chỉ để nối', 'Mã chỉ có tác dụng trong file này để các dòng trỏ tới nhau. Hệ thống không lưu mã; mỗi người sau khi nhập có id riêng.'],
      ['Thuỷ tổ', 'Tự nhận ra: người không có cha mẹ trong file và có nhiều con cháu nhất.'],
      ['Ví dụ', 'Sheet "Gia phả" đang có sẵn một gia phả 4 đời làm ví dụ. Xoá các dòng ví dụ rồi điền gia phả của bạn.'],
      ['Kiểm tra', 'Khi tải lên, app hiện bản xem trước và báo lỗi từng dòng. Chưa lưu gì cho tới khi bạn bấm "Xác nhận & lưu".'],
      [null, null],
      [header('Cột'), header('Cách ghi')],
      ...COLUMNS.map((column) => [column.header, column.guide || 'Tuỳ chọn.']),
    ],
  },
];
