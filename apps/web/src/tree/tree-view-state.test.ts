import { describe, expect, it } from 'vitest';
import { describeReveal, readOrientation, saveOrientation } from './tree-view-state';

describe('describeReveal', () => {
  it('Người chưa nối vào cây: chỉ báo, không đổi gì', () => {
    expect(describeReveal(null, 'Phạm A', 1)).toEqual({ notice: 'Phạm A chưa nối vào cây nên không hiện trên Cây.', collapsed: null, outsideOverride: null, focus: false });
    expect(describeReveal(null, undefined, 1).notice).toContain('Người này');
  });

  it('cần hiện thêm đời Cháu ngoại thì báo và ghi đè tạm; đủ rồi thì im lặng và không ghi đè', () => {
    const collapsed = new Set(['x']);
    expect(describeReveal({ collapsed, outsideGenerations: 3 }, 'A', 1)).toEqual({
      notice: 'Đã chuyển sang hiện cháu ngoại 3 đời để hiện người này.',
      collapsed,
      outsideOverride: 3,
      focus: true,
    });
    expect(describeReveal({ collapsed, outsideGenerations: 1 }, 'A', 1)).toMatchObject({ notice: null, outsideOverride: null, focus: true });
  });
});

describe('hướng Cây được nhớ', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  };

  it('nhớ trái → phải; mặc định trên → dưới; kho hỏng thì không ném', () => {
    const storage = memory();
    expect(readOrientation(storage)).toBe('top-down');
    saveOrientation('left-right', storage);
    expect(readOrientation(storage)).toBe('left-right');
    const broken = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(readOrientation(broken)).toBe('top-down');
    expect(() => saveOrientation('top-down', broken)).not.toThrow();
  });
});
