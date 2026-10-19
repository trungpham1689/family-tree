import { describe, expect, it } from 'vitest';
import { fetchAll, PAGE_SIZE } from './index';

const fakeTable = (total: number) => {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => from + i), error: null };
  };
  return { page, calls };
};

describe('fetchAll', () => {
  it('đọc hết mọi trang, kể cả khi đúng bội số trang', async () => {
    for (const total of [0, 1, PAGE_SIZE - 1, PAGE_SIZE, PAGE_SIZE + 1, 2 * PAGE_SIZE, 2500]) {
      const { page } = fakeTable(total);
      const { data, error } = await fetchAll(page);
      expect(error).toBeNull();
      expect(data).toHaveLength(total);
      expect(new Set(data).size).toBe(total);
    }
  });

  it('dừng ở lỗi đầu tiên và không trả dữ liệu dở', async () => {
    let call = 0;
    const result = await fetchAll(async () => (call++ === 0 ? { data: Array(PAGE_SIZE).fill(1), error: null } : { data: null, error: { message: 'x' } }));
    expect(result).toEqual({ data: null, error: { message: 'x' } });
  });
});
