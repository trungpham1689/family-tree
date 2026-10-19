import { describe, expect, it } from 'vitest';
import { isJsonSafe, shouldPersistQuery } from './offline-cache';

const query = (queryKey: unknown[], status: 'success' | 'error' | 'pending' = 'success') => ({ queryKey, state: { status, data: [] } });

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

describe('isJsonSafe', () => {
  it('nhận dữ liệu JSON thường; từ chối Map, Set, Date, hàm, undefined (lồng bất kỳ đâu)', () => {
    expect(isJsonSafe({ a: [1, 'x', null, true, { b: 2 }] })).toBe(true);
    expect(isJsonSafe(new Map())).toBe(false);
    expect(isJsonSafe(new Set(['x']))).toBe(false);
    expect(isJsonSafe({ when: new Date() })).toBe(false);
    expect(isJsonSafe([{ f: () => 1 }])).toBe(false);
    expect(isJsonSafe({ a: undefined })).toBe(false);
  });

  it('truy vấn có dữ liệu Map/Set không được giữ offline dù gốc khoá cho phép', () => {
    const q = (data: unknown) => ({ queryKey: ['reminder-prefs'], state: { status: 'success', data } });
    expect(shouldPersistQuery(q([{ treeId: 't', offsetDays: 0 }]))).toBe(true);
    expect(shouldPersistQuery(q(new Map()))).toBe(false);
  });
});
