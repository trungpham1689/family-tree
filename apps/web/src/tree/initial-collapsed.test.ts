import { describe, expect, it } from 'vitest';
import { initialCollapsed } from './initial-collapsed';

const chain = (length: number) =>
  Array.from({ length: length - 1 }, (_, index) => ({ parent_id: `g${index + 1}`, child_id: `g${index + 2}` }));

describe('initialCollapsed', () => {
  it('thu gọn người ở đời thứ 4 còn có con', () => {
    expect([...initialCollapsed('g1', chain(6))]).toEqual(['g4']);
  });

  it('không thu gọn gì khi cây chưa tới 4 đời', () => {
    expect(initialCollapsed('g1', chain(3)).size).toBe(0);
  });

  it('không thu gọn người ở đời 4 mà không có con', () => {
    expect(initialCollapsed('g1', chain(4)).size).toBe(0);
  });

  it('dùng được số đời khác', () => {
    expect([...initialCollapsed('g1', chain(6), 2)]).toEqual(['g2']);
  });
});
