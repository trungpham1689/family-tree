import { describe, expect, it } from 'vitest';
import { singleFlight } from './single-flight';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('singleFlight', () => {
  it('gọi lại khi lần trước chưa xong thì bị bỏ qua; xong rồi gọi được lần nữa', async () => {
    let calls = 0;
    const gate = deferred();
    const run = singleFlight(async () => {
      calls += 1;
      await gate.promise;
    });
    const first = run();
    const second = run();
    const third = run();
    await Promise.resolve();
    expect(calls).toBe(1);
    gate.resolve();
    await Promise.all([first, second, third]);
    await run();
    expect(calls).toBe(2);
  });

  it('lần trước lỗi thì vẫn mở khoá cho lần sau, lỗi được báo cho đúng lần gọi đó', async () => {
    let calls = 0;
    const run = singleFlight(async (fail: boolean) => {
      calls += 1;
      if (fail) throw new Error('hỏng');
    });
    await expect(run(true)).rejects.toThrow('hỏng');
    await run(false);
    expect(calls).toBe(2);
  });

  it('khoá đặt ngay khi gọi (không chờ vẽ lại): hai lần gọi liền nhau trong cùng lượt chỉ chạy một lần', async () => {
    let calls = 0;
    const run = singleFlight(async () => {
      calls += 1;
    });
    void run();
    void run();
    expect(calls).toBe(1);
  });
});
