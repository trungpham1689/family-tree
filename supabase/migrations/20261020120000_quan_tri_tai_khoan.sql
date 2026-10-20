-- Siêu quản trị: trang /quan-tri cho phép duyệt / thu hồi tài khoản mà không cần mở Supabase Dashboard.
-- Siêu quản trị gốc (email cố định bên dưới) luôn được duyệt, không thể bị thu hồi hay gỡ quyền, và là người duy nhất
-- cấp/gỡ quyền siêu quản trị cho người khác. Siêu quản trị khác duyệt/thu hồi được mọi tài khoản trừ siêu quản trị.
-- Siêu quản trị cũng chặn (ban) / bỏ chặn và xoá tài khoản; gửi email đặt lại mật khẩu thì app gọi thẳng Supabase Auth.
-- Cờ is_superadmin chỉ đổi được qua các hàm dưới đây (bảng đã thu quyền ghi của API, xem migration duyệt tài khoản).

alter table public.account_approvals add column is_superadmin boolean not null default false;

create function private.root_superadmin_email() returns text
language sql immutable set search_path = ''
as $$ select 'trungpham168@gmail.com'::text $$;

-- Tài khoản mới: email gốc được duyệt và là siêu quản trị ngay; còn lại chờ duyệt như cũ.
create or replace function private.new_account_approval() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  is_root constant boolean := lower(coalesce(new.email, '')) = private.root_superadmin_email();
begin
  insert into public.account_approvals (account_id, email, approved, is_superadmin, approved_at)
  values (new.id, new.email, is_root, is_root, case when is_root then now() end);
  return new;
end;
$$;

-- Tài khoản gốc đã đăng ký từ trước: nâng quyền ngay.
update public.account_approvals set approved = true, is_superadmin = true
  where lower(coalesce(email, '')) = private.root_superadmin_email();

create function private.is_superadmin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select is_superadmin and approved from public.account_approvals where account_id = auth.uid()), false)
$$;

create function private.is_root_superadmin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_superadmin()
    and coalesce((select lower(email) = private.root_superadmin_email() from public.account_approvals where account_id = auth.uid()), false)
$$;

create function public.admin_list_accounts()
returns table (
  account_id uuid, email text, approved boolean, is_superadmin boolean, is_root boolean,
  created_at timestamptz, approved_at timestamptz, last_sign_in_at timestamptz, tree_count integer, is_banned boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select a.account_id, a.email, a.approved, a.is_superadmin,
           lower(coalesce(a.email, '')) = private.root_superadmin_email(),
           a.created_at, a.approved_at, u.last_sign_in_at,
           (select count(*)::integer from public.family_trees t where t.owner_id = a.account_id),
           coalesce(u.banned_until > now(), false)
    from public.account_approvals a
    left join auth.users u on u.id = a.account_id
    order by a.approved, a.created_at desc;
end;
$$;

-- Duyệt hoặc thu hồi một tài khoản. Siêu quản trị phải được gỡ quyền siêu quản trị trước khi thu hồi.
create function public.admin_set_approval(target_account uuid, new_approved boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target public.account_approvals;
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.account_approvals where account_id = target_account;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if target.is_superadmin and not new_approved then
    raise exception 'SUPERADMIN_PROTECTED' using errcode = 'check_violation';
  end if;
  if new_approved and exists (select 1 from auth.users where id = target_account and banned_until > now()) then
    raise exception 'ACCOUNT_BANNED' using errcode = 'check_violation';
  end if;
  update public.account_approvals set approved = new_approved where account_id = target_account;
end;
$$;

-- Cấp / gỡ quyền siêu quản trị: chỉ siêu quản trị gốc; không gỡ được chính gốc. Cấp quyền thì tự duyệt luôn.
create function public.admin_set_superadmin(target_account uuid, make_superadmin boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target public.account_approvals;
begin
  if not private.is_root_superadmin() then
    raise exception 'ROOT_ONLY' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.account_approvals where account_id = target_account;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if not make_superadmin and lower(coalesce(target.email, '')) = private.root_superadmin_email() then
    raise exception 'SUPERADMIN_PROTECTED' using errcode = 'check_violation';
  end if;
  update public.account_approvals
    set is_superadmin = make_superadmin, approved = approved or make_superadmin
    where account_id = target_account;
end;
$$;

-- Chặn: không đăng nhập hay làm mới phiên được nữa (GoTrue kiểm banned_until) và mất quyền dữ liệu ngay (bỏ duyệt) dù token cũ
-- còn hạn. Bỏ chặn chỉ mở lại đăng nhập; tài khoản về trạng thái chờ duyệt để siêu quản trị duyệt lại.
create function public.admin_set_banned(target_account uuid, new_banned boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target public.account_approvals;
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.account_approvals where account_id = target_account;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if target.is_superadmin then
    raise exception 'SUPERADMIN_PROTECTED' using errcode = 'check_violation';
  end if;
  update auth.users set banned_until = case when new_banned then 'infinity'::timestamptz end where id = target_account;
  if new_banned then
    update public.account_approvals set approved = false where account_id = target_account;
  end if;
end;
$$;

-- Xoá hẳn tài khoản (đăng nhập, duyệt, vai trò trong gia phả người khác, nhắc nhở). Không xoá được siêu quản trị hay người đang
-- sở hữu gia phả: xoá chủ sẽ kéo theo cả gia phả và để lại ảnh mồ côi trên Drive, nên chỉ chặn (ban) họ.
create function public.admin_delete_account(target_account uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target public.account_approvals;
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.account_approvals where account_id = target_account;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if target.is_superadmin then
    raise exception 'SUPERADMIN_PROTECTED' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.family_trees where owner_id = target_account) then
    raise exception 'ACCOUNT_OWNS_TREES' using errcode = 'check_violation';
  end if;
  delete from auth.users where id = target_account;
end;
$$;

revoke execute on function private.root_superadmin_email(), private.is_superadmin(), private.is_root_superadmin() from public, anon, authenticated;
revoke execute on function public.admin_list_accounts(), public.admin_set_approval(uuid, boolean), public.admin_set_superadmin(uuid, boolean),
  public.admin_set_banned(uuid, boolean), public.admin_delete_account(uuid) from public, anon;
grant execute on function public.admin_list_accounts(), public.admin_set_approval(uuid, boolean), public.admin_set_superadmin(uuid, boolean),
  public.admin_set_banned(uuid, boolean), public.admin_delete_account(uuid) to authenticated;
