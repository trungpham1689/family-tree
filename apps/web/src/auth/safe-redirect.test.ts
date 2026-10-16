import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('giữ đường dẫn nội bộ', () => {
    expect(safeRedirectPath('/gia-pha/abc?xem=cay')).toBe('/gia-pha/abc?xem=cay');
  });

  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'gia-pha'])(
    'từ chối %s và về trang mặc định',
    (raw) => {
      expect(safeRedirectPath(raw)).toBe('/gia-pha');
    },
  );

  it('không quay lại chính trang đăng nhập', () => {
    expect(safeRedirectPath('/dang-nhap?tiep=/x')).toBe('/gia-pha');
  });
});
