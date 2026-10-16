-- Giả lập phần tối thiểu của Supabase mà các migration và RLS của dự án dựa vào.
-- Chỉ dùng trong test (PGlite). Trên Supabase thật, những thứ này đã có sẵn.
-- Định nghĩa auth.uid() / auth.role() / auth.jwt() khớp với Supabase:
-- đọc từ setting `request.jwt.claims` mà PostgREST đặt cho mỗi request.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create function auth.role() returns text
language sql stable
as $$
  select auth.jwt() ->> 'role'
$$;

-- Supabase mặc định cấp quyền trên các bảng mới trong public cho các role API;
-- RLS là lớp chặn thực sự.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
