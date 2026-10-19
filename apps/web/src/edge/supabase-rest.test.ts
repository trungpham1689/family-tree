import { describe, expect, it } from 'vitest';
import { EdgeError, supabaseRest } from './supabase-rest';

const env = { VITE_SUPABASE_URL: 'https://db.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'pk' };
const fake = (handler: (url: string, init?: RequestInit) => Response) => (async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)) as typeof fetch;

describe('supabaseRest', () => {
  it('thiếu biến môi trường thì null', () => {
    expect(supabaseRest({})).toBeNull();
    expect(supabaseRest({ VITE_SUPABASE_URL: 'x' })).toBeNull();
  });

  it('rpc: khách dùng khoá công khai, người dùng thêm Bearer; 401 báo unauthorized; lỗi khác ném EdgeError 502', async () => {
    const seen: Record<string, string>[] = [];
    const rest = supabaseRest(env, fake((url, init) => {
      seen.push(init!.headers as Record<string, string>);
      if (url.endsWith('/bad')) return new Response('x', { status: 500 });
      return url.endsWith('/expired') ? new Response('{}', { status: 401 }) : Response.json(true);
    }))!;
    expect(await rest.rpc('can_view_tree', { target_tree: 't' }, 'jwt')).toEqual({ unauthorized: false, data: true });
    expect(seen[0]).toMatchObject({ apikey: 'pk', authorization: 'Bearer jwt' });
    expect((await rest.rpc('public_tree_card', { token: 'x' })).data).toBe(true);
    expect(seen[1]!.authorization).toBeUndefined();
    expect(await rest.rpc('expired', {}, 'jwt')).toEqual({ unauthorized: true, data: null });
    await expect(rest.rpc('bad', {}, 'jwt')).rejects.toMatchObject({ status: 502 });
  });

  it('rows ném EdgeError khi lỗi (không coi là không có dòng); all đọc hết các trang', async () => {
    const rest = supabaseRest(env, fake((url, init) => {
      if (url.includes('broken')) return new Response('x', { status: 503 });
      const range = (init!.headers as Record<string, string>).range;
      const from = Number(range?.split('-')[0] ?? 0);
      return Response.json(Array.from({ length: from === 0 ? 1000 : 3 }, (_, i) => ({ n: from + i })));
    }))!;
    await expect(rest.rows('broken?select=x', 'jwt')).rejects.toBeInstanceOf(EdgeError);
    expect(await rest.all('t?select=n', 'jwt')).toHaveLength(1003);
  });

  it('remove trả các dòng đã xoá (rỗng khi RLS từ chối)', async () => {
    const rest = supabaseRest(env, fake((_u, init) => (init!.method === 'DELETE' ? Response.json([]) : Response.json([]))))!;
    expect(await rest.remove('family_trees?id=eq.x', 'jwt')).toEqual([]);
  });
});
