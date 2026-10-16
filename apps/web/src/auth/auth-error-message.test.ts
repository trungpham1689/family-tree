import { describe, expect, it } from 'vitest';
import { authErrorMessage } from './auth-error-message';

describe('authErrorMessage', () => {
  it('dịch lỗi theo mã của Supabase', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'Email hoặc mật khẩu không đúng.',
    );
  });

  it('dịch theo nội dung khi không có mã', () => {
    expect(authErrorMessage({ message: 'User already registered' })).toBe(
      'Email này đã có tài khoản. Hãy chọn "Đăng nhập".',
    );
  });

  it('báo lỗi mạng dễ hiểu', () => {
    expect(authErrorMessage({ message: 'TypeError: Failed to fetch' })).toMatch(/kết nối/);
  });

  it('có câu mặc định cho lỗi lạ', () => {
    expect(authErrorMessage({ code: 'something_new', message: 'Boom' })).toBe(
      'Có lỗi xảy ra. Hãy thử lại sau ít phút.',
    );
  });
});
