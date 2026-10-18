export type ResendConfig = { apiKey: string; from: string };

export const sendEmail = async (config: ResendConfig, to: string, subject: string, html: string, text: string): Promise<void> => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.from, to, subject, html, text }),
  });
  if (!response.ok) throw new Error(`Resend lỗi ${response.status}: ${await response.text()}`);
};
