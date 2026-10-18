import type { Drawing } from './drawing';
import type { PdfFonts } from './pdf';
import { setPngDpi, type PngPlan } from './png';
import { drawingToSvg } from './svg';

/** Vẽ Phả đồ ra PNG theo kế hoạch dpi (chạy trong trình duyệt), trả về file đã ghi dpi. */
export const renderPng = async (drawing: Drawing, fonts: PdfFonts, plan: PngPlan): Promise<Blob> => {
  const svg = drawingToSvg(drawing, { regularBase64: btoa(fonts.regular), boldBase64: btoa(fonts.bold) });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không cấp được vùng vẽ.');
    context.drawImage(image, 0, 0, plan.width, plan.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    // Giải phóng bộ nhớ ngay, canvas lớn chiếm hàng trăm MB.
    canvas.width = 0;
    canvas.height = 0;
    if (!blob) throw new Error('Ảnh quá lớn so với trình duyệt.');
    const bytes = setPngDpi(new Uint8Array(await blob.arrayBuffer()), plan.dpi);
    return new Blob([bytes], { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
};
