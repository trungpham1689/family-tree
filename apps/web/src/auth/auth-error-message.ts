/**
 * Đổi lỗi từ Supabase Auth thành câu tiếng Việt dễ hiểu cho người dùng.
 * Dựa vào `code` (ổn định) trước, rồi mới tới `message` cho các phiên bản cũ.
 */
export type AuthErrorLike = { code?: string | undefined; message?: string | undefined; status?: number | undefined };

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: 'Email hoặc mật khẩu không đúng.',
  email_not_confirmed: 'Email chưa được xác nhận. Hãy mở thư xác nhận trong hộp thư của bạn.',
  user_already_exists: 'Email này đã có tài khoản. Hãy chọn "Đăng nhập".',
  email_exists: 'Email này đã có tài khoản. Hãy chọn "Đăng nhập".',
  weak_password: 'Mật khẩu quá yếu. Hãy dùng ít nhất 8 ký tự, có cả chữ và số.',
  over_request_rate_limit: 'Bạn thao tác quá nhanh. Hãy đợi một chút rồi thử lại.',
  over_email_send_rate_limit: 'Đã gửi quá nhiều email. Hãy đợi vài phút rồi thử lại.',
  validation_failed: 'Email hoặc mật khẩu chưa hợp lệ.',
  signup_disabled: 'Hiện chưa mở đăng ký tài khoản mới.',
  same_password: 'Mật khẩu mới phải khác mật khẩu cũ.',
  user_not_found: 'Không tìm thấy tài khoản với email này.',
};

const MESSAGES_BY_TEXT: Array<[RegExp, string]> = [
  [/invalid login credentials/i, MESSAGES_BY_CODE.invalid_credentials!],
  [/email not confirmed/i, MESSAGES_BY_CODE.email_not_confirmed!],
  [/already registered/i, MESSAGES_BY_CODE.user_already_exists!],
  [/password should be/i, MESSAGES_BY_CODE.weak_password!],
  [/failed to fetch|network/i, 'Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.'],
];

const FALLBACK = 'Có lỗi xảy ra. Hãy thử lại sau ít phút.';

export const authErrorMessage = (error: AuthErrorLike): string => {
  const byCode = error.code ? MESSAGES_BY_CODE[error.code] : undefined;
  if (byCode) return byCode;

  const text = error.message ?? '';
  const byText = MESSAGES_BY_TEXT.find(([pattern]) => pattern.test(text));
  return byText ? byText[1] : FALLBACK;
};
