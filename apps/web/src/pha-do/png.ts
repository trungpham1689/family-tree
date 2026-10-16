/**
 * Xuất PNG cho Phả đồ: chọn độ phân giải vừa giới hạn canvas của trình duyệt,
 * và ghi dpi vào file (khối pHYs) để máy in, Photoshop hiểu đúng kích thước in.
 */

export type CanvasLimits = { maxSide: number; maxArea: number };

/** Trình duyệt máy tính (Chrome, Safari, Firefox) vẽ an toàn trong giới hạn này. */
export const DESKTOP_LIMITS: CanvasLimits = { maxSide: 16_384, maxArea: 120_000_000 };
/** Safari trên iPhone/iPad giới hạn canvas khoảng 16,7 triệu điểm ảnh. */
export const IOS_LIMITS: CanvasLimits = { maxSide: 4_096, maxArea: 16_777_216 };

export type PngPlan = { dpi: number; width: number; height: number; reduced: boolean };

const MM_PER_INCH = 25.4;

/** Độ phân giải sẽ xuất: mặc định 300 dpi; khổ quá lớn thì hạ dpi (làm tròn xuống) cho vừa giới hạn. */
export const planPng = (pageMm: { width: number; height: number }, limits: CanvasLimits, requestedDpi = 300): PngPlan => {
  const inchW = pageMm.width / MM_PER_INCH;
  const inchH = pageMm.height / MM_PER_INCH;
  const bySide = limits.maxSide / Math.max(inchW, inchH);
  const byArea = Math.sqrt(limits.maxArea / (inchW * inchH));
  const dpi = Math.min(requestedDpi, Math.floor(Math.min(bySide, byArea)));
  return { dpi, width: Math.round(inchW * dpi), height: Math.round(inchH * dpi), reduced: dpi < requestedDpi };
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const readUint32 = (bytes: Uint8Array, offset: number) =>
  ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Ghi (hoặc thay) khối pHYs với số điểm ảnh mỗi mét tương ứng `dpi`, đặt ngay sau IHDR. */
export const setPngDpi = (png: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> => {
  if (!PNG_SIGNATURE.every((byte, index) => png[index] === byte)) throw new Error('Không phải file PNG');
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  chunk[16] = 1; // đơn vị: mét
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  const parts: Uint8Array[] = [png.subarray(0, 8)];
  let offset = 8;
  while (offset < png.length) {
    const length = readUint32(png, offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (type !== 'pHYs') parts.push(png.subarray(offset, end));
    if (type === 'IHDR') parts.push(chunk);
    offset = end;
  }
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    result.set(part, cursor);
    cursor += part.length;
  }
  return result;
};

/** Đọc dpi đã ghi trong file PNG (null nếu không có). */
export const readPngDpi = (png: Uint8Array): number | null => {
  let offset = 8;
  while (offset < png.length) {
    const length = readUint32(png, offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    if (type === 'pHYs') return Math.round(readUint32(png, offset + 8) * 0.0254);
    offset += 12 + length;
  }
  return null;
};

/** iPhone/iPad (kể cả iPad báo mình là Mac) có giới hạn canvas nhỏ hơn. */
export const isAppleMobile = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
