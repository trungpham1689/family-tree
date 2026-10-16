/**
 * Cloudflare Pages Function cho /p/<token> và /p/<token>/nguoi/<id>: trả về ứng dụng như bình thường,
 * nhưng chèn sẵn thẻ Open Graph (tên gia phả, ảnh xem trước) để Zalo/Facebook hiện đẹp khi dán link.
 *
 * Cần đặt biến môi trường VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY cho cả Functions
 * (Cloudflare Pages → Settings → Environment variables), giống lúc build.
 */
import { injectOpenGraph, type PublicCard } from '../../src/share/og-meta';

type Env = {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

type Context = { request: Request; env: Env; params: { path?: string[] } };

const fetchCard = async (env: Env, token: string): Promise<PublicCard | null> => {
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY || !/^[0-9a-f]{32}$/.test(token)) return null;
  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/public_tree_card`, {
      method: 'POST',
      headers: {
        apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicCard | null;
  } catch {
    return null;
  }
};

export const onRequestGet = async ({ request, env, params }: Context): Promise<Response> => {
  const url = new URL(request.url);
  // Mọi đường dẫn của ứng dụng đều trả về index.html (xem public/_redirects).
  const page = await env.ASSETS.fetch(new Request(new URL('/index.html', url.origin), request));
  if (!page.ok) return page;

  const token = params.path?.[0] ?? '';
  const card = await fetchCard(env, token);
  const html = injectOpenGraph(await page.text(), card, url.toString(), url.origin);
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Tiêu đề có thể đổi khi chủ gia phả đổi tên; không cache lâu.
      'cache-control': 'public, max-age=300',
    },
  });
};
