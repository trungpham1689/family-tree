/** Tải một Blob xuống máy người dùng với tên file cho trước. */
export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** "<Tiền tố>-<tên gia phả>-<ngày YYYY-MM-DD>.<đuôi>", giữ nguyên dấu tiếng Việt trong tên gia phả. */
export const exportFileName = (prefix: string, treeName: string, today: string, ext: string) =>
  `${prefix}-${treeName.trim().replaceAll(/\s+/g, '-')}-${today}.${ext}`;
