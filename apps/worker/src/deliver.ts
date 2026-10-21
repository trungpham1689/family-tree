import type { TreeDigest } from './digest.ts';
import { MAX_RECIPIENTS, SendError, type Sender } from './send.ts';

export type RenderedDigest = { subject: string; html: string; text: string };
export type DeliveryReport = { sent: number; failed: { treeId: string; error: string }[] };

export type DeliverDeps = {
  send: Sender;
  render: (digest: TreeDigest) => RenderedDigest;
  /** Chờ giữa các lần thử lại; thay bằng hàm giả trong test. */
  sleep?: (ms: number) => Promise<void>;
  /** Ngày gửi (YYYY-MM-DD), đưa vào khoá idempotency để cùng một bản tin không gửi đôi. */
  dateKey: string;
  maxAttempts?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const retriable = (error: unknown) => !(error instanceof SendError) || error.status === 429 || error.status >= 500;

/** Thử lại `work` với chờ tăng dần (và theo `Retry-After` nếu Brevo báo); lỗi không đáng thử lại thì ném ngay. */
export const withRetry = async <T>(work: () => Promise<T>, sleep: (ms: number) => Promise<void>, maxAttempts: number): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= maxAttempts || !retriable(error)) throw error;
      await sleep((error instanceof SendError && error.retryAfterMs) || 1000 * 2 ** (attempt - 1));
    }
  }
};

/**
 * Gửi lần lượt từng bản tin gia phả. Mỗi nhóm tối đa 50 người là một lần gửi riêng, có thử lại riêng (khoá idempotency
 * theo gia phả + ngày + số nhóm nên thử lại không gửi đôi); một gia phả hỏng không chặn gia phả khác. Trả báo cáo, không ném.
 */
export const deliverDigests = async (digests: readonly TreeDigest[], deps: DeliverDeps): Promise<DeliveryReport> => {
  const sleep = deps.sleep ?? defaultSleep;
  const maxAttempts = deps.maxAttempts ?? 4;
  const report: DeliveryReport = { sent: 0, failed: [] };
  for (const digest of digests) {
    const { subject, html, text } = deps.render(digest);
    try {
      for (let start = 0, batch = 0; start < digest.emails.length; start += MAX_RECIPIENTS, batch += 1) {
        const to = digest.emails.slice(start, start + MAX_RECIPIENTS);
        await withRetry(() => deps.send(to, subject, html, text, `digest-${digest.treeId}-${deps.dateKey}-${batch}`), sleep, maxAttempts);
      }
      report.sent += 1;
    } catch (error) {
      report.failed.push({ treeId: digest.treeId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
};
