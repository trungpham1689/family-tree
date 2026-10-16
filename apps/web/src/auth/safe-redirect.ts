const DEFAULT_PATH = '/gia-pha';

/**
 * Chỉ chấp nhận đường dẫn nội bộ cho tham số `tiep` sau khi đăng nhập,
 * để link đăng nhập không bị lợi dụng chuyển người dùng sang trang khác.
 */
export const safeRedirectPath = (raw: string | null | undefined): string => {
  if (!raw) return DEFAULT_PATH;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_PATH;
  if (raw.startsWith('/dang-nhap')) return DEFAULT_PATH;
  return raw;
};
