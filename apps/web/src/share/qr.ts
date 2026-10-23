import qrcode from 'qrcode-generator';

/** Ma trận ô đen/trắng của mã QR (mức sửa lỗi M: vẫn quét được khi giấy in bị bẩn, mờ một phần). */
export const qrMatrix = (text: string): boolean[][] => {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => qr.isDark(row, col)));
};

/** Một path SVG vẽ mọi ô đen, toạ độ theo ô (viewBox 0 0 size size). */
export const qrSvgPath = (matrix: boolean[][]): string =>
  matrix.flatMap((cells, row) => cells.flatMap((dark, col) => (dark ? [`M${col} ${row}h1v1h-1z`] : []))).join('');

/** Vùng trắng quanh mã, theo chuẩn QR là 4 ô. */
export const QR_QUIET_ZONE = 4;

/** Ảnh PNG để in: mã QR có viền trắng, kèm một dòng chú thích bên dưới. */
export const qrPngBlob = (text: string, caption: string): Promise<Blob> => {
  const matrix = qrMatrix(text);
  const cell = 16;
  const side = (matrix.length + QR_QUIET_ZONE * 2) * cell;
  const captionHeight = caption ? 72 : 0;
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side + captionHeight;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('Trình duyệt không vẽ được ảnh.'));
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000';
  matrix.forEach((cells, row) =>
    cells.forEach((dark, col) => {
      if (dark) context.fillRect((col + QR_QUIET_ZONE) * cell, (row + QR_QUIET_ZONE) * cell, cell, cell);
    }),
  );
  if (caption) {
    context.font = '600 32px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(caption, side / 2, side + 24, side - 2 * QR_QUIET_ZONE * cell);
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh mã QR.'))), 'image/png'),
  );
};
