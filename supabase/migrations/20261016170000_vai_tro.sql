-- Mời và quản lý Vai trò (ticket 11).
-- Mọi thay đổi vai trò đi qua hàm (không ghi thẳng bảng tree_roles), để luật
-- "không ai đổi/gỡ được Chủ sở hữu" và "Người xem không mời được" nằm một chỗ.

-- ---------------------------------------------------------------------------
-- Liên kết tài khoản ↔ Người là chính mình trong Gia phả
-- ---------------------------------------------------------------------------
alter table public.tree_roles add column person_id uuid references public.persons (id) on delete set null;
create unique index tree_roles_one_account_per_person on public.tree_roles (tree_id, person_id) where person_id is not null;

-- ---------------------------------------------------------------------------
-- Lời mời chờ cho email chưa có tài khoản
-- ---------------------------------------------------------------------------
create table public.tree_invitations (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  role text not null check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tree_id, email)
);

create index tree_invitations_email_idx on public.tree_invitations (email);

alter table public.tree_invitations enable row level security;
create policy "biên tập viên xem lời mời" on public.tree_invitations
  for select to authenticated using (public.can_edit_tree(tree_id));
create policy "biên tập viên huỷ lời mời" on public.tree_invitations
  for delete to authenticated using (public.can_edit_tree(tree_id));
revoke insert, update on public.tree_invitations from anon, authenticated;
revoke delete on public.tree_invitations from anon;

-- ---------------------------------------------------------------------------
-- Thao tác (security definer trong private; bản public chỉ chuyển lời gọi)
-- ---------------------------------------------------------------------------

-- Mời một email: có tài khoản thì cấp vai trò ngay, chưa có thì để lời mời chờ.
create function private.invite_member(target_tree uuid, invitee_email text, new_role text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  normalized text := lower(btrim(invitee_email));
  invitee uuid;
begin
  if not public.can_edit_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if new_role not in ('editor', 'viewer') then
    raise exception 'INVALID_ROLE' using errcode = 'check_violation';
  end if;
  if normalized !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'check_violation';
  end if;

  select id into invitee from auth.users where lower(email) = normalized limit 1;
  if invitee is not null then
    if exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = invitee) then
      raise exception 'ALREADY_MEMBER' using errcode = 'unique_violation';
    end if;
    insert into public.tree_roles (tree_id, account_id, role) values (target_tree, invitee, new_role);
    return 'added';
  end if;

  insert into public.tree_invitations (tree_id, email, role, invited_by)
  values (target_tree, normalized, new_role, auth.uid())
  on conflict (tree_id, email) do update set role = excluded.role, invited_by = excluded.invited_by;
  return 'invited';
end;
$$;

create function private.set_member_role(target_tree uuid, member uuid, new_role text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can_edit_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if new_role not in ('editor', 'viewer') then
    raise exception 'INVALID_ROLE' using errcode = 'check_violation';
  end if;
  update public.tree_roles set role = new_role
  where tree_id = target_tree and account_id = member and role <> 'owner';
  if not found then
    raise exception 'OWNER_PROTECTED' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Gỡ một tài khoản; ai cũng tự rời được (trừ Chủ sở hữu).
create function private.remove_member(target_tree uuid, member uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if member is distinct from auth.uid() and not public.can_edit_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  delete from public.tree_roles where tree_id = target_tree and account_id = member and role <> 'owner';
  if not found then
    raise exception 'OWNER_PROTECTED' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Liên kết một tài khoản với Người là chính họ. Tự liên kết mình: mọi vai trò;
-- liên kết người khác: Chủ sở hữu, Biên tập viên. person_id null = huỷ liên kết.
create function private.set_member_person(target_tree uuid, member uuid, target_person uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if member is distinct from auth.uid() and not public.can_edit_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if not public.can_view_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if target_person is not null
     and not exists (select 1 from public.persons where id = target_person and tree_id = target_tree) then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;
  if target_person is not null and exists (
    select 1 from public.tree_roles where tree_id = target_tree and person_id = target_person and account_id <> member
  ) then
    raise exception 'PERSON_ALREADY_LINKED' using errcode = 'unique_violation';
  end if;
  update public.tree_roles set person_id = target_person where tree_id = target_tree and account_id = member;
  if not found then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Danh sách tài khoản có vai trò. Người xem chỉ thấy email đã che bớt.
create function private.tree_members(target_tree uuid)
returns table (account_id uuid, email text, role text, person_id uuid, joined_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  can_edit boolean := public.can_edit_tree(target_tree);
begin
  if not public.can_view_tree(target_tree) then
    return;
  end if;
  return query
    select r.account_id,
           case
             when can_edit or r.account_id = auth.uid() then u.email::text
             else left(u.email::text, 1) || '***@' || split_part(u.email::text, '@', 2)
           end,
           r.role, r.person_id, r.created_at, r.account_id = auth.uid()
    from public.tree_roles r
    join auth.users u on u.id = r.account_id
    where r.tree_id = target_tree
    order by case r.role when 'owner' then 0 when 'editor' then 1 else 2 end, r.created_at;
end;
$$;

-- Nhận các lời mời đang chờ cho email của chính mình. Giao diện gọi khi tải "Gia phả của tôi",
-- nên người được mời trước khi có tài khoản sẽ thấy gia phả ngay lần đăng nhập đầu tiên.
-- (Cố ý không gắn trigger vào auth.users.) Email lấy từ auth.users theo auth.uid(), không tin dữ liệu gửi lên.
create function private.accept_my_invitations() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  my_email text;
  accepted integer;
begin
  select lower(email::text) into my_email from auth.users where id = auth.uid();
  if my_email is null then
    return 0;
  end if;
  insert into public.tree_roles (tree_id, account_id, role)
  select i.tree_id, auth.uid(), i.role from public.tree_invitations i
  where i.email = my_email
  on conflict (tree_id, account_id) do nothing;
  get diagnostics accepted = row_count;
  delete from public.tree_invitations where email = my_email;
  return accepted;
end;
$$;

-- Bản public (security invoker) để giao diện gọi qua /rest/v1/rpc.
create function public.invite_member(target_tree uuid, invitee_email text, new_role text) returns text
language sql set search_path = '' as $$ select private.invite_member(target_tree, invitee_email, new_role) $$;
create function public.set_member_role(target_tree uuid, member uuid, new_role text) returns void
language sql set search_path = '' as $$ select private.set_member_role(target_tree, member, new_role) $$;
create function public.remove_member(target_tree uuid, member uuid) returns void
language sql set search_path = '' as $$ select private.remove_member(target_tree, member) $$;
create function public.set_member_person(target_tree uuid, member uuid, target_person uuid) returns void
language sql set search_path = '' as $$ select private.set_member_person(target_tree, member, target_person) $$;
create function public.accept_my_invitations() returns integer
language sql set search_path = '' as $$ select private.accept_my_invitations() $$;
create function public.tree_members(target_tree uuid)
returns table (account_id uuid, email text, role text, person_id uuid, joined_at timestamptz, is_me boolean)
language sql stable set search_path = '' as $$ select * from private.tree_members(target_tree) $$;

revoke execute on function private.invite_member(uuid, text, text), private.set_member_role(uuid, uuid, text),
  private.remove_member(uuid, uuid), private.set_member_person(uuid, uuid, uuid), private.tree_members(uuid),
  private.accept_my_invitations()
  from public, anon;
grant execute on function private.invite_member(uuid, text, text), private.set_member_role(uuid, uuid, text),
  private.remove_member(uuid, uuid), private.set_member_person(uuid, uuid, uuid), private.tree_members(uuid),
  private.accept_my_invitations()
  to authenticated;
revoke execute on function public.invite_member(uuid, text, text), public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.set_member_person(uuid, uuid, uuid), public.tree_members(uuid),
  public.accept_my_invitations()
  from public, anon;
grant execute on function public.invite_member(uuid, text, text), public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.set_member_person(uuid, uuid, uuid), public.tree_members(uuid),
  public.accept_my_invitations()
  to authenticated;

