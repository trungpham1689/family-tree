-- Mời Quản trị viên / Người xem bằng email CHƯA có tài khoản: lời mời được lưu chờ; khi người đó đăng ký bằng đúng email này,
-- vai trò được cấp ngay lúc tạo tài khoản. Tài khoản vẫn phải được duyệt (private.is_approved) mới thấy gia phả, như mọi vai trò khác.
-- Đăng nhập sau khi được duyệt là thấy gia phả được mời, không phải mời lại.

create table public.tree_invitations (
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tree_id, email)
);

-- Chỉ truy cập qua các hàm bên dưới (security definer); không cho đọc/ghi trực tiếp.
alter table public.tree_invitations enable row level security;
revoke all on public.tree_invitations from anon, authenticated;

-- Trả 'added' khi email đã có tài khoản (vai trò cấp ngay), 'pending' khi chưa có (lưu lời mời chờ đăng ký).
drop function public.invite_to_tree(uuid, text, text);
create function public.invite_to_tree(target_tree uuid, invite_email text, new_role text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  address constant text := lower(btrim(coalesce(invite_email, '')));
  invitee uuid;
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if new_role not in ('editor', 'viewer') then
    raise exception 'INVALID_ROLE' using errcode = 'check_violation';
  end if;
  if address !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(address) > 254 then
    raise exception 'INVALID_EMAIL' using errcode = 'check_violation';
  end if;

  invitee := private.account_id_by_email(address);
  if invitee is null then
    if not exists (select 1 from public.tree_invitations where tree_id = target_tree and email = address)
       and (select count(*) from public.tree_invitations where tree_id = target_tree) >= 50 then
      raise exception 'TOO_MANY_INVITATIONS' using errcode = 'check_violation';
    end if;
    insert into public.tree_invitations (tree_id, email, role, invited_by) values (target_tree, address, new_role, auth.uid())
      on conflict (tree_id, email) do update set role = excluded.role;
    return 'pending';
  end if;

  if exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = invitee and role = 'owner') then
    raise exception 'ALREADY_OWNER' using errcode = 'check_violation';
  end if;
  insert into public.tree_roles (tree_id, account_id, role, invited_by) values (target_tree, invitee, new_role, auth.uid())
    on conflict (tree_id, account_id) do update set role = excluded.role;
  return 'added';
end;
$$;

create function public.list_tree_invitations(target_tree uuid) returns table (email text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select i.email, i.role, i.created_at from public.tree_invitations i where i.tree_id = target_tree order by i.created_at, i.email;
end;
$$;

create function public.cancel_tree_invitation(target_tree uuid, invite_email text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  delete from public.tree_invitations where tree_id = target_tree and email = lower(btrim(coalesce(invite_email, '')));
end;
$$;

-- Đăng ký xong: nhận mọi lời mời đang chờ của email này (giữ người mời), rồi xoá lời mời.
create or replace function private.new_account_approval() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  is_root constant boolean := lower(coalesce(new.email, '')) = private.root_superadmin_email();
  meta constant jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name_text constant text := btrim(coalesce(meta ->> 'full_name', ''));
  phone_text constant text := btrim(coalesce(meta ->> 'phone', ''));
  birth constant date := private.validate_profile(name_text, btrim(coalesce(meta ->> 'birth_date', '')), phone_text);
begin
  insert into public.account_approvals (account_id, email, approved, is_superadmin, approved_at, full_name, birth_date, phone)
  values (new.id, new.email, is_root, is_root, case when is_root then now() end, name_text, birth, phone_text);

  insert into public.tree_roles (tree_id, account_id, role, invited_by)
  select i.tree_id, new.id, i.role, i.invited_by from public.tree_invitations i where i.email = lower(coalesce(new.email, ''))
  on conflict (tree_id, account_id) do nothing;
  delete from public.tree_invitations where email = lower(coalesce(new.email, ''));
  return new;
end;
$$;

revoke execute on function public.invite_to_tree(uuid, text, text), public.list_tree_invitations(uuid), public.cancel_tree_invitation(uuid, text)
  from public, anon;
grant execute on function public.invite_to_tree(uuid, text, text), public.list_tree_invitations(uuid), public.cancel_tree_invitation(uuid, text)
  to authenticated;
