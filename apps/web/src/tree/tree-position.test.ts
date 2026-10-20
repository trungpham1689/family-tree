import { describe, expect, it } from 'vitest';
import { readCanvasPosition, readOverviewPosition, rememberCanvasPosition, rememberOverviewPosition } from './tree-position';

const memoryStore = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
};

describe('tree-position', () => {
  it('gộp từng phần ghi nhớ và tách theo gia phả', () => {
    const store = memoryStore();
    rememberOverviewPosition('a', { generation: 3 }, store);
    rememberOverviewPosition('a', { personId: 'p1', view: 'cay' }, store);
    expect(readOverviewPosition('a', store)).toEqual({ generation: 3, personId: 'p1', view: 'cay' });
    expect(readOverviewPosition('b', store)).toEqual({});
  });

  it('nhớ trạng thái Cây theo gốc', () => {
    const store = memoryStore();
    rememberCanvasPosition('root', { collapsed: ['x'], outside: 2 }, store);
    rememberCanvasPosition('root', { personId: 'p9' }, store);
    expect(readCanvasPosition('root', store)).toEqual({ collapsed: ['x'], outside: 2, personId: 'p9' });
  });

  it('dữ liệu hỏng hoặc không có kho lưu thì trả về rỗng, không ném lỗi', () => {
    const broken = { getItem: () => '{không phải json', setItem: () => undefined };
    expect(readOverviewPosition('a', broken)).toEqual({});
    expect(readOverviewPosition('a', null)).toEqual({});
    expect(() => rememberOverviewPosition('a', { generation: 1 }, null)).not.toThrow();
  });
});
