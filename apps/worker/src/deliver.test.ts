import { describe, expect, it } from 'vitest';
import { deliverDigests, withRetry } from './deliver.ts';
import { MAX_RECIPIENTS, SendError, type Sender } from './send.ts';

const digest = (treeId: string, count: number) => ({ treeId, treeName: treeId, emails: Array.from({ length: count }, (_, i) => `u${i}@example.com`), occurrences: [] });
const render = () => ({ subject: 's', html: 'h', text: 't' });
const noSleep = async () => undefined;

describe('deliverDigests', () => {
  it('gửi chung một email cho cả gia phả, chia nhóm 50 người, khoá idempotency theo gia phả/ngày/nhóm', async () => {
    const calls: { to: number; key: string }[] = [];
    const send: Sender = async (to, _s, _h, _t, key) => void calls.push({ to: to.length, key });
    const report = await deliverDigests([digest('t1', MAX_RECIPIENTS + 5)], { send, render, dateKey: '2026-10-20', sleep: noSleep });
    expect(report).toEqual({ sent: 1, failed: [] });
    expect(calls).toEqual([{ to: 50, key: 'digest-t1-2026-10-20-0' }, { to: 5, key: 'digest-t1-2026-10-20-1' }]);
  });

  it('429 / 5xx được thử lại (theo Retry-After); chỉ nhóm lỗi được gửi lại, không gửi đôi nhóm đã xong', async () => {
    const attempts = new Map<string, number>();
    const waits: number[] = [];
    const send: Sender = async (_to, _s, _h, _t, key) => {
      const n = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, n);
      if (key.endsWith('-1') && n === 1) throw new SendError(429, 'limit', 3000);
    };
    const report = await deliverDigests([digest('t1', MAX_RECIPIENTS + 1)], { send, render, dateKey: 'd', sleep: async (ms) => void waits.push(ms) });
    expect(report.sent).toBe(1);
    expect(attempts.get('digest-t1-d-0')).toBe(1);
    expect(attempts.get('digest-t1-d-1')).toBe(2);
    expect(waits).toEqual([3000]);
  });

  it('lỗi 4xx khác không thử lại; một gia phả hỏng không chặn gia phả khác', async () => {
    let tries = 0;
    const send: Sender = async (_to, _s, _h, key) => {
      void key;
      tries += 1;
      if (tries === 1) throw new SendError(422, 'bad address');
    };
    const report = await deliverDigests([digest('bad', 1), digest('ok', 1)], { send, render, dateKey: 'd', sleep: noSleep });
    expect(report.sent).toBe(1);
    expect(report.failed).toEqual([{ treeId: 'bad', error: 'bad address' }]);
    expect(tries).toBe(2); // 422 không bị thử lại
  });

  it('hết số lần thử thì báo lỗi, không ném', async () => {
    const send: Sender = async () => {
      throw new SendError(500, 'down');
    };
    const report = await deliverDigests([digest('t1', 1)], { send, render, dateKey: 'd', sleep: noSleep, maxAttempts: 3 });
    expect(report.failed).toHaveLength(1);
  });
});

describe('withRetry', () => {
  it('thử lại lỗi mạng chung (không phải SendError) và chờ tăng dần', async () => {
    const waits: number[] = [];
    let calls = 0;
    const result = await withRetry(async () => { calls += 1; if (calls < 3) throw new Error('network'); return 'ok'; }, async (ms) => void waits.push(ms), 4);
    expect(result).toBe('ok');
    expect(waits).toEqual([1000, 2000]);
  });
});
