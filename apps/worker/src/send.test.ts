import { describe, expect, it } from 'vitest';
import { brevoSender, parseFrom, SendError } from './send.ts';

describe('parseFrom', () => {
  it('tách tên và email; chỉ có email thì không có tên', () => {
    expect(parseFrom('Gia Phả <a@b.co>')).toEqual({ name: 'Gia Phả', email: 'a@b.co' });
    expect(parseFrom('a@b.co')).toEqual({ email: 'a@b.co' });
  });
});

describe('brevoSender', () => {
  it('gọi API giao dịch của Brevo với api-key và danh sách người nhận', async () => {
    let seen: { url: string; key: string | null; body: unknown } | null = null;
    const doFetch: typeof fetch = async (url, init) => {
      seen = { url: String(url), key: new Headers(init?.headers).get('api-key'), body: JSON.parse(String(init?.body)) };
      return Response.json({ messageId: 'x' });
    };
    await brevoSender({ apiKey: 'k', from: 'Gia Phả <a@b.co>' }, doFetch)(['x@y.co', 'z@y.co'], 's', '<p>h</p>', 't', 'ignored');
    expect(seen).toEqual({
      url: 'https://api.brevo.com/v3/smtp/email',
      key: 'k',
      body: { sender: { name: 'Gia Phả', email: 'a@b.co' }, to: [{ email: 'x@y.co' }, { email: 'z@y.co' }], subject: 's', htmlContent: '<p>h</p>', textContent: 't' },
    });
  });

  it('lỗi HTTP thành SendError kèm mã và thời gian chờ', async () => {
    const doFetch: typeof fetch = async () => new Response('limit', { status: 429, headers: { 'retry-after': '3' } });
    const error = await brevoSender({ apiKey: 'k', from: 'a@b.co' }, doFetch)(['x@y.co'], 's', 'h', 't', 'k').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SendError);
    expect(error).toMatchObject({ status: 429, retryAfterMs: 3000 });
  });
});
