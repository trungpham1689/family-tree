import { describe, expect, it } from 'vitest';
import { exportFileName } from './download';

describe('exportFileName', () => {
  it('tiền tố-tên gia phả-ngày.đuôi; khoảng trắng thành gạch nối, giữ dấu tiếng Việt', () => {
    expect(exportFileName('Pha-do', '  Họ  Phạm làng Đông ', '2026-10-20', 'pdf')).toBe('Pha-do-Họ-Phạm-làng-Đông-2026-10-20.pdf');
    expect(exportFileName('Sao-luu', 'Họ Lê', '2026-10-20-300dpi', 'png')).toBe('Sao-luu-Họ-Lê-2026-10-20-300dpi.png');
  });
});
