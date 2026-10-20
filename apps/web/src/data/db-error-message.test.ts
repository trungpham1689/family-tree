import { describe, expect, it } from 'vitest';
import { dbErrorMessage, hasDbCode } from './db-error-message';

describe('dbErrorMessage', () => {
  it('giải thích giới hạn số gia phả kèm chi tiết từ database', () => {
    const text = dbErrorMessage({
      code: '23514',
      message: 'TREE_LIMIT_REACHED',
      details: 'Mỗi tài khoản tạo tối đa 3 gia phả.',
    });
    expect(text).toContain('Mỗi tài khoản tạo tối đa 3 gia phả.');
    expect(text).toContain('xoá bớt');
  });

  it('báo không có quyền khi vướng RLS', () => {
    expect(dbErrorMessage({ code: '42501', message: 'new row violates row-level security policy' })).toBe(
      'Bạn không có quyền làm việc này trong gia phả.',
    );
  });

  it('báo dữ liệu chưa hợp lệ khi vi phạm ràng buộc', () => {
    expect(dbErrorMessage({ code: '23514', message: 'violates check constraint "persons_check"' })).toMatch(/chưa hợp lệ/);
  });

  it('giải thích lỗi vòng lặp tổ tiên', () => {
    expect(dbErrorMessage({ code: '23514', message: 'ANCESTOR_CYCLE' })).toMatch(/tổ tiên của chính mình/);
  });

  it('báo chưa có tài khoản khi mời email lạ', () => {
    expect(dbErrorMessage({ code: '23514', message: 'ACCOUNT_NOT_FOUND' })).toMatch(/Không tìm thấy tài khoản/);
  });

  it('báo đã là Chủ sở hữu khi mời nhầm chính mình', () => {
    expect(dbErrorMessage({ code: '23514', message: 'ALREADY_OWNER' })).toMatch(/đã là Chủ sở hữu/);
  });

  it('báo không đổi/gỡ được vai trò Chủ sở hữu', () => {
    expect(dbErrorMessage({ code: '23514', message: 'CANNOT_CHANGE_OWNER' })).toMatch(/Chủ sở hữu/);
  });

  it('giải thích giới hạn số ảnh/người', () => {
    expect(dbErrorMessage({ code: '23514', message: 'PHOTO_LIMIT_REACHED', details: 'Mỗi người tối đa 5 ảnh.' })).toContain(
      'Mỗi người tối đa 5 ảnh.',
    );
  });

  it('có câu mặc định', () => {
    expect(dbErrorMessage({ message: 'lạ' })).toBe('Có lỗi xảy ra. Hãy thử lại sau ít phút.');
  });

  it('mọi mã nghiệp vụ mà migration raise đều có câu tiếng Việt riêng (không rơi vào câu chung)', () => {
    for (const code of ['NOT_ALLOWED', 'NOT_TREE_MEMBER', 'INVALID_ROLE', 'LINK_NOT_ENABLED', 'PASSWORD_TOO_SHORT', 'SAME_PERSON', 'UNION_NOT_FOUND', 'PHOTO_NOT_FOUND', 'PHOTO_PATH_INVALID', 'PHOTO_IMMUTABLE', 'TREE_IMMUTABLE']) {
      expect(dbErrorMessage({ message: code }), code).not.toBe('Có lỗi xảy ra. Hãy thử lại sau ít phút.');
    }
  });

  it('hasDbCode nhận ra mã trong message', () => {
    expect(hasDbCode({ message: 'STALE_VERSION' }, 'STALE_VERSION')).toBe(true);
    expect(hasDbCode(null, 'STALE_VERSION')).toBe(false);
  });
});
