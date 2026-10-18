import { describe, expect, it } from 'vitest';
import { dbErrorMessage } from './db-error-message';

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
    expect(dbErrorMessage({ code: '23514', message: 'ACCOUNT_NOT_FOUND' })).toMatch(/Chưa có tài khoản/);
  });

  it('báo đã là Chủ sở hữu khi mời nhầm chính mình', () => {
    expect(dbErrorMessage({ code: '23514', message: 'ALREADY_OWNER' })).toMatch(/đã là Chủ sở hữu/);
  });

  it('báo không đổi/gỡ được vai trò Chủ sở hữu', () => {
    expect(dbErrorMessage({ code: '23514', message: 'CANNOT_CHANGE_OWNER' })).toMatch(/Chủ sở hữu/);
  });

  it('có câu mặc định', () => {
    expect(dbErrorMessage({ message: 'lạ' })).toBe('Có lỗi xảy ra. Hãy thử lại sau ít phút.');
  });
});
