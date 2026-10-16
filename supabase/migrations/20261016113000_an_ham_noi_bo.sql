-- Theo Supabase Advisor: không để hàm security definer nội bộ lộ ra API (/rest/v1/rpc),
-- và cố định search_path cho mọi hàm.
-- Schema `private` không nằm trong danh sách schema PostgREST phục vụ.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter function public.app_setting(text) set schema private;
alter function public.tree_role(uuid) set schema private;
alter function public.enforce_tree_limit() set schema private;
alter function public.grant_owner_role() set schema private;

revoke execute on function private.app_setting(text) from public, anon;
revoke execute on function private.tree_role(uuid) from public, anon;
revoke execute on function private.enforce_tree_limit() from public, anon, authenticated;
revoke execute on function private.grant_owner_role() from public, anon, authenticated;
grant execute on function private.app_setting(text) to authenticated;
grant execute on function private.tree_role(uuid) to authenticated;

-- Các hàm kiểm quyền vẫn ở public (security invoker): giao diện dùng để biết người
-- đang xem có được sửa hay không; chúng chỉ trả lời cho chính người gọi.
create or replace function public.can_view_tree(target_tree uuid) returns boolean
language sql stable set search_path = ''
as $$ select private.tree_role(target_tree) is not null $$;

create or replace function public.can_edit_tree(target_tree uuid) returns boolean
language sql stable set search_path = ''
as $$ select coalesce(private.tree_role(target_tree) in ('owner', 'editor'), false) $$;

create or replace function public.is_tree_owner(target_tree uuid) returns boolean
language sql stable set search_path = ''
as $$ select coalesce(private.tree_role(target_tree) = 'owner', false) $$;

revoke execute on function public.can_view_tree(uuid), public.can_edit_tree(uuid), public.is_tree_owner(uuid)
  from public, anon;
grant execute on function public.can_view_tree(uuid), public.can_edit_tree(uuid), public.is_tree_owner(uuid)
  to authenticated;

alter function public.touch_updated_at() set search_path = '';

-- Hàm security definer phải tự ghi rõ schema (search_path đã cố định là public trước đây).
create or replace function private.enforce_tree_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  owned integer;
  max_trees integer := private.app_setting('max_trees_per_account');
begin
  select count(*) into owned from public.family_trees where owner_id = new.owner_id;
  if owned >= max_trees then
    raise exception 'TREE_LIMIT_REACHED'
      using detail = format('Mỗi tài khoản tạo tối đa %s gia phả.', max_trees),
            errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function private.grant_owner_role() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.tree_roles (tree_id, account_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create or replace function private.app_setting(setting_key text) returns integer
language sql stable security definer set search_path = ''
as $$ select value from public.app_settings where key = setting_key $$;

create or replace function private.tree_role(target_tree uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select role from public.tree_roles
  where tree_id = target_tree and account_id = auth.uid()
$$;
