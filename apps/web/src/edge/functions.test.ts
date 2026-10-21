import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as calendar } from '../../functions/api/calendar/[token]';
import { onRequestGet as ogPage } from '../../functions/p/[[path]]';

const TOKEN = 'a'.repeat(32);
const env = { VITE_SUPABASE_URL: 'https://db.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'pk' };

const stubFetch = (handler: (url: string) => Response) => vi.stubGlobal('fetch', async (input: RequestInfo | URL) => handler(String(input)));
afterEach(() => vi.unstubAllGlobals());

const call = (token: string) =>
  calendar({ request: new Request(`https://app.test/api/calendar/${token}.ics`), env, params: { token: `${token}.ics` }, waitUntil: () => undefined });

describe('Pages Function lịch đăng ký', () => {
  it('token sai hình dạng hoặc thiếu biến môi trường: 404, không gọi Supabase', async () => {
    stubFetch(() => { throw new Error('không được gọi'); });
    expect((await call('xyz')).status).toBe(404);
    expect((await calendar({ request: new Request('https://a.test/x'), env: {}, params: { token: `${TOKEN}.ics` }, waitUntil: () => undefined })).status).toBe(404);
  });

  it('có dữ liệu: trả lịch .ics; không có (RPC trả null): 404; dữ liệu sai hình dạng hoặc Supabase lỗi: 502', async () => {
    const source = { trees: [{ id: 't', name: 'Họ' }], persons: [], events: [], marriages: [] };
    stubFetch(() => Response.json(source));
    const ok = await call(TOKEN);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('text/calendar');
    expect(await ok.text()).toContain('BEGIN:VCALENDAR');
    expect(ok.headers.get('x-robots-tag')).toContain('noindex');

    stubFetch(() => Response.json(null));
    expect((await call(TOKEN)).status).toBe(404);
    stubFetch(() => Response.json({ trees: 'x' }));
    expect((await call(TOKEN)).status).toBe(502);
    stubFetch(() => new Response('boom', { status: 500 }));
    expect((await call(TOKEN)).status).toBe(502);
  });
});

describe('Pages Function thẻ xem trước link công khai', () => {
  const run = async (rpc: () => Response) => {
    stubFetch(rpc);
    const response = await ogPage({
      request: new Request(`https://app.test/p/${TOKEN}`),
      env: { ...env, ASSETS: { fetch: async () => new Response('<html><head><title>Gia Phả</title></head></html>') } },
      params: { path: [TOKEN] },
    });
    return response.text();
  };

  it('có thẻ hợp lệ thì chèn tên gia phả; dữ liệu sai hình dạng hoặc lỗi thì vẫn mở trang, thẻ "hết hiệu lực"', async () => {
    expect(await run(() => Response.json({ name: 'Họ Phạm', description: null, persons: 3 }))).toContain('Họ Phạm');
    expect(await run(() => Response.json({ nope: 1 }))).toContain('không còn hiệu lực');
    expect(await run(() => new Response('x', { status: 500 }))).toContain('không còn hiệu lực');
  });

  it('lấy trang gốc "/" chứ không phải /index.html (Cloudflare chuyển /index.html về / bằng 308, người xem bị đưa về trang chủ)', async () => {
    stubFetch(() => Response.json({ name: 'Họ Phạm', description: null, persons: 3 }));
    const response = await ogPage({
      request: new Request(`https://app.test/p/${TOKEN}`),
      env: {
        ...env,
        ASSETS: {
          fetch: async (request: Request) =>
            new URL(request.url).pathname === '/index.html'
              ? new Response(null, { status: 308, headers: { location: '/' } })
              : new Response('<html><head><title>Gia Phả</title></head></html>'),
        },
      },
      params: { path: [TOKEN] },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Họ Phạm');
  });
});
