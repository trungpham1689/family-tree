export type ResendConfig = { apiKey: string; from: string };

/** Resend nhận tối đa 50 người nhận mỗi email. */
const MAX_RECIPIENTS = 50;

/** Một email gửi chung cho `to` (chia nhóm 50 nếu nhiều hơn). */
export const sendEmail = async (config: ResendConfig, to: readonly string[], subject: string, html: string, text: string): Promise<void> => {
  for (let start = 0; start < to.length; start += MAX_RECIPIENTS) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: to.slice(start, start + MAX_RECIPIENTS), subject, html, text }),
    });
    if (!response.ok) throw new Error(`Resend lỗi ${response.status}: ${await response.text()}`);
  }
};
