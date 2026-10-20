-- Hồ sơ tài khoản và người mời, cho trang quản trị.
-- 1. Đăng ký bắt buộc họ và tên, ngày sinh, số điện thoại (app gửi qua user metadata của Supabase Auth); trigger kiểm và lưu
--    vào account_approvals. Tài khoản đăng ký trước đây chưa có thì để trống, trang quản trị hiện "—".
-- 2. tree_roles.invited_by ghi người đã mời vào gia phả (null: chủ sở hữu, hoặc mời từ trước khi có cột này).
-- 3. admin_list_accounts phân trang, lọc theo trạng thái và tìm kiếm ngay ở database; đếm số tài khoản nằm riêng ở
--    admin_account_counts để các tab vẫn hiện đúng số khi danh sách chia trang.

alter table public.account_approvals
  add column full_name text check (full_name is null or char_length(full_name) between 1 and 120),
  add column birth_date date,
  add column phone text;

alter table public.tree_roles add column invited_by uuid references auth.users (id) on delete set null;

create or replace function private.new_account_approval() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  is_root constant boolean := lower(coalesce(new.email, '')) = private.root_superadmin_email();
  meta constant jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name_text constant text := btrim(coalesce(meta ->> 'full_name', ''));
  phone_text constant text := btrim(coalesce(meta ->> 'phone', ''));
  birth_text constant text := btrim(coalesce(meta ->> 'birth_date', ''));
  birth date;
begin
  if name_text = '' or phone_text = '' or birth_text = '' then
    raise exception 'PROFILE_REQUIRED'
      using detail = 'Cần nhập họ và tên, ngày sinh và số điện thoại.', errcode = 'check_violation';
  end if;
  begin
    birth := birth_text::date;
  exception when others then
    raise exception 'PROFILE_INVALID' using detail = 'Ngày sinh không hợp lệ.', errcode = 'check_violation';
  end;
  if birth < date '1900-01-01' or birth > current_date then
    raise exception 'PROFILE_INVALID' using detail = 'Ngày sinh không hợp lệ.', errcode = 'check_violation';
  end if;
  if char_length(name_text) > 120 then
    raise exception 'PROFILE_INVALID' using detail = 'Họ và tên tối đa 120 ký tự.', errcode = 'check_violation';
  end if;
  if phone_text !~ '^[0-9+(). -]{8,20}$' or char_length(regexp_replace(phone_text, '[^0-9]', '', 'g')) < 8 then
    raise exception 'PROFILE_INVALID' using detail = 'Số điện thoại không hợp lệ.', errcode = 'check_violation';
  end if;

  insert into public.account_approvals (account_id, email, approved, is_superadmin, approved_at, full_name, birth_date, phone)
  values (new.id, new.email, is_root, is_root, case when is_root then now() end, name_text, birth, phone_text);
  return new;
end;
$$;

-- Ghi lại ai mời: chỉ khi thêm vai trò mới; đổi vai trò người đã có thì giữ người mời ban đầu.
create or replace function public.invite_to_tree(target_tree uuid, invite_email text, new_role text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  invitee uuid;
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if new_role not in ('editor', 'viewer') then
    raise exception 'INVALID_ROLE' using errcode = 'check_violation';
  end if;

  invitee := private.account_id_by_email(invite_email);
  if invitee is null then
    raise exception 'ACCOUNT_NOT_FOUND'
      using detail = 'Chưa có tài khoản dùng email này. Mời họ tạo tài khoản trước.', errcode = 'no_data_found';
  end if;
  if exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = invitee and role = 'owner') then
    raise exception 'ALREADY_OWNER' using errcode = 'check_violation';
  end if;

  insert into public.tree_roles (tree_id, account_id, role, invited_by) values (target_tree, invitee, new_role, auth.uid())
    on conflict (tree_id, account_id) do update set role = excluded.role;
end;
$$;

drop function public.admin_list_accounts();

-- status_filter: 'all' | 'pending' | 'approved'. search: khớp một phần email, họ tên hoặc số điện thoại (không phân biệt hoa thường).
-- total_count: số tài khoản khớp bộ lọc (trước khi cắt trang). invited_by: những người đã mời tài khoản này vào gia phả.
create function public.admin_list_accounts(
  status_filter text default 'all', search text default '', page_size integer default 20, page_offset integer default 0
)
returns table (
  account_id uuid, email text, full_name text, birth_date date, phone text, approved boolean, is_superadmin boolean, is_root boolean,
  created_at timestamptz, approved_at timestamptz, last_sign_in_at timestamptz, tree_count integer, is_banned boolean,
  invited_by jsonb, total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  needle constant text := lower(btrim(coalesce(search, '')));
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select a.account_id, a.email, a.full_name, a.birth_date, a.phone, a.approved, a.is_superadmin,
           lower(coalesce(a.email, '')) = private.root_superadmin_email(),
           a.created_at, a.approved_at, u.last_sign_in_at,
           (select count(*)::integer from public.family_trees t where t.owner_id = a.account_id),
           coalesce(u.banned_until > now(), false),
           (select coalesce(jsonb_agg(x.who order by x.first_at), '[]'::jsonb)
              from (select jsonb_build_object('account_id', r.invited_by, 'email', ia.email, 'full_name', ia.full_name) as who,
                           min(r.created_at) as first_at
                      from public.tree_roles r
                      join public.account_approvals ia on ia.account_id = r.invited_by
                     where r.account_id = a.account_id and r.invited_by is not null
                     group by r.invited_by, ia.email, ia.full_name) x),
           count(*) over ()
    from public.account_approvals a
    left join auth.users u on u.id = a.account_id
    where (status_filter = 'all' or (status_filter = 'pending' and not a.approved) or (status_filter = 'approved' and a.approved))
      and (needle = ''
           or position(needle in lower(coalesce(a.email, ''))) > 0
           or position(needle in lower(coalesce(a.full_name, ''))) > 0
           or position(needle in coalesce(a.phone, '')) > 0)
    order by a.approved, a.created_at desc, a.account_id
    limit least(greatest(coalesce(page_size, 20), 1), 100)
    offset greatest(coalesce(page_offset, 0), 0);
end;
$$;

create function public.admin_account_counts()
returns table (total_count integer, pending_count integer, i_am_root boolean)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select count(*)::integer, (count(*) filter (where not a.approved))::integer, private.is_root_superadmin()
    from public.account_approvals a;
end;
$$;

revoke execute on function public.admin_list_accounts(text, text, integer, integer), public.admin_account_counts() from public, anon;
grant execute on function public.admin_list_accounts(text, text, integer, integer), public.admin_account_counts() to authenticated;
