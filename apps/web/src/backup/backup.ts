import { strToU8, zipSync, type Zippable } from 'fflate';

/**
 * Bản sao lưu đầy đủ một Gia phả: một file .zip gồm dữ liệu thô (JSON), file Excel nhập lại được,
 * và toàn bộ ảnh. Phần lắp ráp zip nằm ở đây (thuần, test được); tải dữ liệu/ảnh nằm ở download-backup.ts.
 */

export type BackupImage = { path: string; bytes: Uint8Array };

export type BackupInput = {
  treeName: string;
  exportedAt: string;
  /** Dữ liệu thô, ghi nguyên vào du-lieu.json. */
  data: Record<string, unknown>;
  /** File Excel (cùng định dạng "Nhập từ Excel"); null nếu không tạo được. */
  xlsx: Uint8Array | null;
  images: readonly BackupImage[];
  /** Ảnh không tải được, ghi vào HUONG-DAN.txt để người dùng biết. */
  failedImages: readonly string[];
};

/** Tên file an toàn trên Windows/macOS, giữ dấu tiếng Việt. */
export const safeFileName = (name: string): string =>
  [...name.normalize('NFC')]
    .map((char) => (char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? ' ' : char))
    .join('')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'khong-ten';

const guide = (input: BackupInput): string =>
  [
    `BẢN SAO LƯU GIA PHẢ "${input.treeName}"`,
    `Xuất lúc: ${input.exportedAt}`,
    '',
    'Trong file này có:',
    '- du-lieu.json : toàn bộ dữ liệu (Người, quan hệ, hôn phối, sự kiện, cấu hình Phả đồ, danh sách ảnh). Dành cho người rành kỹ thuật hoặc để chuyển sang hệ thống khác.',
    '- gia-pha.xlsx : danh sách Người theo định dạng của phần mềm; vào mục "Nhập từ Excel" để khôi phục Người và quan hệ (không gồm ảnh, sự kiện).',
    '- anh/         : ảnh gia phả và ảnh từng Người. Tên file gắn với tên Người; mỗi ảnh trong du-lieu.json có trường "file" trỏ tới đây.',
    '',
    'Bản sao lưu chứa thông tin cá nhân (điện thoại, email, mộ phần…). Hãy cất giữ cẩn thận, không chia sẻ công khai.',
    ...(input.failedImages.length > 0
      ? ['', `Không tải được ${input.failedImages.length} ảnh (có thể đã bị xoá trên kho ảnh):`, ...input.failedImages.map((path) => `- ${path}`)]
      : []),
    '',
  ].join('\n');

/** Lắp zip. Ảnh JPEG đã nén sẵn nên lưu nguyên (level 0); chữ và Excel cũng đã gọn. */
export const buildBackupZip = (input: BackupInput): Uint8Array => {
  const files: Zippable = {
    'HUONG-DAN.txt': [strToU8(guide(input)), { level: 6 }],
    'du-lieu.json': [strToU8(JSON.stringify(input.data, null, 2)), { level: 6 }],
  };
  if (input.xlsx) files['gia-pha.xlsx'] = [input.xlsx, { level: 0 }];
  for (const image of input.images) files[image.path] = [image.bytes, { level: 0 }];
  return zipSync(files);
};
