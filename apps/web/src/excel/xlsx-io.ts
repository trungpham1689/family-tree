import { normalizeName } from '../tree/tree-search';
import type { ExportData } from './export';
import type { CellValue } from './import-preview';
import { DATA_SHEET, templateSheets } from './template';

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

const fileSlug = (name: string) =>
  normalizeName(name)
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '') || 'gia-pha';

/** Xuất cả Gia phả ra file Excel cùng định dạng file mẫu, tên file kèm ngày xuất. */
export const downloadFamily = async (treeName: string, data: ExportData, today: string): Promise<void> => {
  const [{ default: writeXlsxFile }, { exportSheets, familyToRows }] = await Promise.all([
    import('write-excel-file/browser'),
    import('./export'),
  ]);
  await writeXlsxFile(exportSheets(familyToRows(data))).toFile(`${fileSlug(treeName)}-${today}.xlsx`);
};
