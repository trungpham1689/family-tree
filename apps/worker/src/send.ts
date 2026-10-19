export type ResendConfig = { apiKey: string; from: string };

/** Lỗi gửi mail kèm mã HTTP, để biết có nên thử lại (429, 5xx) hay không. */
export class SendError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;
  constructor(status: number, message: string, retryAfterMs: number | null = null) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Resend nhận tối đa 50 người nhận mỗi email. */
export const MAX_RECIPIENTS = 50;

export type Sender = (to: readonly string[], subject: string, html: string, text: string, idempotencyKey: string) => Promise<void>;

/** Gửi một email tới tối đa 50 người qua Resend. `idempotencyKey` giúp gửi lại sau lỗi mạng không bị gửi đôi. */
export const resendSender =
  (config: ResendConfig, doFetch: typeof fetch = fetch): Sender =>
  async (to, subject, html, text, idempotencyKey) => {
    const response = await doFetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from: config.from, to, subject, html, text }),
    });
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('retry-after'));
      throw new SendError(response.status, `Resend lỗi ${response.status}: ${await response.text()}`, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null);
    }
  };
