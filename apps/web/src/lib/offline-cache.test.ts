import { describe, expect, it } from 'vitest';
import { shouldPersistQuery } from './offline-cache';

const query = (queryKey: unknown[], status: 'success' | 'error' | 'pending' = 'success') => ({ queryKey, state: { status } });

describe('shouldPersistQuery', () => {
  it('lưu dữ liệu gia phả và nhắc nhở đã tải xong', () => {
    expect(shouldPersistQuery(query(['trees', 'abc', 'family']))).toBe(true);
    expect(shouldPersistQuery(query(['reminder-watch']))).toBe(true);
    expect(shouldPersistQuery(query(['approval', 'u1']))).toBe(true);
  });

  it('không lưu truy vấn lỗi/đang tải, link lịch, ảnh, trang công khai', () => {
    expect(shouldPersistQuery(query(['trees', 'abc'], 'error'))).toBe(false);
    expect(shouldPersistQuery(query(['trees', 'abc'], 'pending'))).toBe(false);
    for (const key of ['calendar-feed', 'avatar', 'avatars', 'public', 'public-card']) {
      expect(shouldPersistQuery(query([key, 'x']))).toBe(false);
    }
  });
});
