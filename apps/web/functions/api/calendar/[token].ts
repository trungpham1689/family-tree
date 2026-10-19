/**
 * GET /api/calendar/{token}.ics — lịch đăng ký (Google/Apple Calendar) của một tài khoản.
 * App lịch không đăng nhập được, nên quyền nằm ở token bí mật trong URL (tạo lại được, xem migration lich_dang_ky);
 * database chỉ trả tên + ngày của các gia phả mà tài khoản đó có vai trò.
 */
import { todayInVietnam } from '@gia-pha/lunar';
import { parseCalendarSource } from '@gia-pha/reminders';
import { feedToIcs } from '../../../src/calendar/feed';
import { EdgeError, supabaseRest, type EdgeEnv } from '../../../src/edge/supabase-rest';

type Env = EdgeEnv;
type Context = { request: Request; env: Env; params: { token?: string }; waitUntil: (promise: Promise<unknown>) => void };

// Dựng lịch tốn CPU (đổi âm–dương cho từng người) và app lịch hỏi lại nhiều lần: giữ bản dựng sẵn một lúc.
// Ngắn để tạo lại/tắt link có hiệu lực nhanh.
const CACHE_SECONDS = 600;
const CLIENT_HEADERS = {
  'content-type': 'text/calendar; charset=utf-8',
  'cache-control': 'private, max-age=3600',
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
};

const NOT_FOUND = new Response('Không tìm thấy lịch.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

export const onRequestGet = async ({ request, env, params, waitUntil }: Context): Promise<Response> => {
  const token = (params.token ?? '').replace(/\.ics$/, '');
  const rest = supabaseRest(env);
  if (!rest || !/^[0-9a-f]{32}$/.test(token)) return NOT_FOUND.clone();
  const edgeCache = typeof caches === 'undefined' ? undefined : (caches as unknown as { default?: Cache }).default;
  const hit = await edgeCache?.match(request.url);
  if (hit) return new Response(hit.body, { headers: CLIENT_HEADERS });

  try {
    const { data } = await rest.rpc<unknown>('calendar_feed', { token });
    if (data === null) return NOT_FOUND.clone();
    const source = parseCalendarSource(data);
    if (!source) return new Response('Dữ liệu lịch không đúng định dạng.', { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const body = feedToIcs(source, todayInVietnam());
    if (edgeCache) {
      waitUntil(edgeCache.put(request.url, new Response(body, { headers: { 'content-type': CLIENT_HEADERS['content-type'], 'cache-control': `public, max-age=${CACHE_SECONDS}` } })));
    }
    return new Response(body, { headers: CLIENT_HEADERS });
  } catch (error) {
    if (!(error instanceof EdgeError)) throw error;
    return new Response('Không đọc được lịch lúc này.', { status: error.status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
};
