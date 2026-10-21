/** `from`: "Tên <email@...>" hoặc chỉ "email@..."; địa chỉ phải đã xác minh trong Brevo (Senders). */
export type BrevoConfig = { apiKey: string; from: string };

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

/** Giữ 50 người nhận mỗi email (Brevo cho tối đa 99). */
export const MAX_RECIPIENTS = 50;

export type Sender = (to: readonly string[], subject: string, html: string, text: string, idempotencyKey: string) => Promise<void>;

/** Tách "Tên <email>" thành {name, email} cho Brevo. */
export const parseFrom = (from: string): { name?: string; email: string } => {
  const match = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(from);
  return match ? { ...(match[1] ? { name: match[1] } : {}), email: match[2]!.trim() } : { email: from.trim() };
};

/** Gửi một email tới tối đa 50 người qua Brevo. Brevo không có khoá idempotency, nên gửi lại sau lỗi mạng có thể gửi đôi. */
export const brevoSender =
  (config: BrevoConfig, doFetch: typeof fetch = fetch): Sender =>
  async (to, subject, html, text) => {
    const response = await doFetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': config.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(config.from), to: to.map((email) => ({ email })), subject, htmlContent: html, textContent: text }),
    });
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('retry-after') ?? response.headers.get('x-sib-ratelimit-reset'));
      throw new SendError(response.status, `Brevo lỗi ${response.status}: ${await response.text()}`, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : null);
    }
  };
