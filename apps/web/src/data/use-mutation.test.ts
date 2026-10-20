import { describe, expect, it } from 'vitest';
import { guardOnce } from './use-mutation';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('guardOnce (mỗi thao tác API chỉ chạy một lần tại một thời điểm)', () => {
  it('bấm liên tiếp khi chưa xong: chỉ gọi một lần, mọi lần gọi nhận cùng kết quả', async () => {
    const slot = { current: null as Promise<string> | null };
    const gate = deferred<string>();
    let calls = 0;
    const run = guardOnce(slot, (_id: string) => {
      calls += 1;
      return gate.promise;
    });
    const results = [run('a'), run('a'), run('b')];
    expect(calls).toBe(1);
    gate.resolve('xong');
    await expect(Promise.all(results)).resolves.toEqual(['xong', 'xong', 'xong']);
  });

  it('xong rồi thì gọi được lần nữa; lỗi cũng mở khoá', async () => {
    const slot = { current: null as Promise<number> | null };
    let calls = 0;
    const run = guardOnce(slot, async (fail: boolean) => {
      calls += 1;
      if (fail) throw new Error('hỏng');
      return calls;
    });
    await expect(run(true)).rejects.toThrow('hỏng');
    await expect(run(false)).resolves.toBe(2);
    await expect(run(false)).resolves.toBe(3);
    expect(slot.current).toBeNull();
  });

  it('khoá đặt ngay khi gọi, trước cả microtask kế tiếp (đúng tình huống bấm đúp)', () => {
    const slot = { current: null as Promise<void> | null };
    let calls = 0;
    const run = guardOnce(slot, async () => {
      calls += 1;
    });
    void run();
    void run();
    expect(calls).toBe(1);
  });
});
