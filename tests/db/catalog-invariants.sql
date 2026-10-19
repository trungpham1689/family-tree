-- Bất biến của catalog Postgres sau khi áp mọi migration: mỗi dòng trả về là một vi phạm (rỗng = đạt).
-- Chạy bởi tests/db/catalog-invariants.test.ts (PGlite) và bởi job `migrations-pg17` trong CI (Postgres 17 thật).

-- 1) Mọi hàm ở schema private / public_share, và mọi hàm security definer ở public, phải cố định search_path.
select 'thiếu search_path: ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as violation
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private', 'public_share') and p.prokind = 'f'
  and (p.prosecdef or n.nspname <> 'public')
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')

union all
-- 2) Chỉ những hàm này khách (anon) được gọi: xem công khai, lịch đăng ký, thẻ xem trước, và trigger cập nhật thời gian.
select 'anon gọi được hàm không nằm trong danh sách cho phép: ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private', 'public_share') and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'execute')
  and (n.nspname || '.' || p.proname) not in ('public.touch_updated_at', 'public.public_tree', 'public.public_tree_card', 'public.calendar_feed',
                                              'public_share.public_tree', 'public_share.public_tree_card', 'public_share.calendar_feed')

union all
-- 3) Hàm nội bộ (schema private) không gọi được từ API bởi anon; hàm chỉ dành cho service_role không gọi được bởi authenticated.
select 'authenticated gọi được hàm chỉ dành cho service_role: public.digest_recipients()'
where has_function_privilege('authenticated', 'public.digest_recipients()', 'execute')

union all
-- 4) Mọi bảng ở public / public_share phải bật RLS (không có chính sách thì không ai đọc được qua API).
select 'bảng chưa bật RLS: ' || n.nspname || '.' || c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'public_share') and c.relkind = 'r' and not c.relrowsecurity

union all
-- 5) Khách không ghi được bảng nào của public (bảng không có chính sách cho anon thì ghi cũng bị RLS chặn, nhưng quyền thừa là dấu hiệu quên revoke).
select 'anon có quyền ghi bảng: public.' || c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'));
