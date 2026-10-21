/**
 * Cloudflare Pages Function cho /p/<token> và /p/<token>/nguoi/<id>: trả về ứng dụng như bình thường,
 * nhưng chèn sẵn thẻ Open Graph (tên gia phả, ảnh xem trước) để Zalo/Facebook hiện đẹp khi dán link.
 *
 * Cần đặt biến môi trường VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY cho cả Functions
 * (Cloudflare Pages → Settings → Environment variables), giống lúc build.
 */
import { supabaseRest, type EdgeEnv } from '../../src/edge/supabase-rest';
import { injectOpenGraph, type PublicCard } from '../../src/share/og-meta';

type Env = EdgeEnv & { ASSETS: { fetch: (request: Request) => Promise<Response> } };

type Context = { request: Request; env: Env; params: { path?: string[] } };

const isCard = (value: unknown): value is PublicCard =>
  typeof value === 'object' && value !== null && typeof (value as PublicCard).name === 'string' && typeof (value as PublicCard).persons === 'number';

/** Thẻ xem trước; lỗi hoặc dữ liệu sai hình dạng thì null (trang vẫn mở được, chỉ thiếu thẻ đẹp) và ghi log. */
const fetchCard = async (env: Env, token: string): Promise<PublicCard | null> => {
  const rest = supabaseRest(env);
  if (!rest || !/^[0-9a-f]{32}$/.test(token)) return null;
  try {
    const { data } = await rest.rpc<unknown>('public_tree_card', { token });
    if (data !== null && !isCard(data)) console.error('public_tree_card trả dữ liệu sai hình dạng');
    return isCard(data) ? data : null;
  } catch (error) {
    console.error('Không đọc được thẻ xem trước', error);
    return null;
  }
};

export const onRequestGet = async ({ request, env, params }: Context): Promise<Response> => {
  const url = new URL(request.url);
  // Lấy '/' chứ không phải '/index.html': Cloudflare Pages chuyển /index.html về / bằng 308, rồi trình duyệt bị đưa về trang chủ.
  const page = await env.ASSETS.fetch(new Request(new URL('/', url.origin), request));
  if (!page.ok) return page;

  const token = params.path?.[0] ?? '';
  const card = await fetchCard(env, token);
  const html = injectOpenGraph(await page.text(), card, url.toString(), url.origin);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Tiêu đề có thể đổi khi chủ gia phả đổi tên; không cache lâu.
      'cache-control': 'public, max-age=300',
      'x-robots-tag': 'noindex, nofollow, noarchive, nosnippet',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  });
};
