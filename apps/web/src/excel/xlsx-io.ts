import { DATA_SHEET, templateSheets } from './template';
import type { CellValue } from './import-preview';

/** Tải file mẫu về máy. Thư viện chỉ được nạp khi cần để trang đầu nhẹ. */
export const downloadTemplate = async (): Promise<void> => {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(templateSheets()).toFile('mau-gia-pha.xlsx');
};

/** Đọc sheet dữ liệu của file người dùng tải lên: sheet "Gia phả" nếu có, không thì sheet đầu tiên. */
export const readGiaPhaSheet = async (file: File): Promise<CellValue[][]> => {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const sheets = await readXlsxFile(file);
  const sheet = sheets.find((candidate) => candidate.sheet === DATA_SHEET) ?? sheets[0];
  return (sheet?.data ?? []) as CellValue[][];
};
