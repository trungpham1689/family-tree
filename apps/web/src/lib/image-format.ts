/** Số byte đầu file đủ để nhận ra mọi định dạng trong `isRasterImage`. */
export const IMAGE_HEADER_BYTES = 12;

const startsWith = (head: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((value, index) => head[offset + index] === value);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/**
 * Đầu file có phải ảnh JPEG, PNG, WEBP hoặc GIF không: các định dạng trình duyệt hiện được và jsPDF nhúng được vào PDF.
 * Dữ liệu khác (trang HTML, JSON lỗi, SVG) mà lọt vào PDF thì jsPDF ném lỗi và hỏng cả file xuất.
 */
export const isRasterImage = (head: Uint8Array): boolean =>
  startsWith(head, [0xff, 0xd8, 0xff]) ||
  startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
  (startsWith(head, ascii('RIFF')) && startsWith(head, ascii('WEBP'), 8)) ||
  startsWith(head, ascii('GIF8'));
