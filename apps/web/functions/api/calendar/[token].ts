/**
 * GET /api/calendar/{token}.ics — lịch đăng ký (Google/Apple Calendar) của một tài khoản.
 * App lịch không đăng nhập được, nên quyền nằm ở token bí mật trong URL (tạo lại được, xem migration lich_dang_ky);
 * database chỉ trả tên + ngày của các gia phả mà tài khoản đó có vai trò.
 */
import type { CalendarSource } from '@gia-pha/reminders';
import { feedToIcs } from '../../../src/calendar/feed';
import { todayInVietnam } from '../../../src/calendar/month-grid';

type Env = { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string };
type Context = { env: Env; params: { token?: string } };

const NOT_FOUND = new Response('Không tìm thấy lịch.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export const onRequestGet = async ({ env, params }: Context): Promise<Response> => {
  const token = (params.token ?? '').replace(/\.ics$/, '');
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY || !/^[0-9a-f]{32}$/.test(token)) return NOT_FOUND.clone();
  const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/calendar_feed`, {
    method: 'POST',
    headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) return new Response('Không đọc được lịch lúc này.', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const source = (await response.json()) as CalendarSource | null;
  if (!source) return NOT_FOUND.clone();
  return new Response(feedToIcs(source, todayInVietnam()), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'private, max-age=3600',
      'x-robots-tag': 'noindex, nofollow',
      'x-content-type-options': 'nosniff',
    },
  });
};
