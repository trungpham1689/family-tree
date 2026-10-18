-- Ticket 11: Mời vai trò Biên tập viên / Người xem (ADR 0002).
-- Chủ sở hữu và Biên tập viên mời bằng email tài khoản đã có sẵn; chỉ Chủ sở hữu đổi/gỡ vai trò.

create function private.account_id_by_email(target_email text) returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(target_email) limit 1
$$;

create function private.account_email(target_account uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select email from auth.users where id = target_account
$$;

revoke execute on function private.account_id_by_email(text), private.account_email(uuid)
  from public, anon, authenticated;

create function public.invite_to_tree(target_tree uuid, invite_email text, new_role text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  invitee uuid;
begin
  if not public.can_edit_tree(target_tree) then
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

  insert into public.tree_roles (tree_id, account_id, role) values (target_tree, invitee, new_role)
    on conflict (tree_id, account_id) do update set role = excluded.role;
end;
$$;

create function public.update_tree_role(target_tree uuid, target_account uuid, new_role text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if new_role not in ('editor', 'viewer') then
    raise exception 'INVALID_ROLE' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = target_account and role = 'owner') then
    raise exception 'CANNOT_CHANGE_OWNER' using errcode = 'check_violation';
  end if;

  update public.tree_roles set role = new_role where tree_id = target_tree and account_id = target_account;
end;
$$;

create function public.remove_tree_role(target_tree uuid, target_account uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = target_account and role = 'owner') then
    raise exception 'CANNOT_CHANGE_OWNER' using errcode = 'check_violation';
  end if;

  delete from public.tree_roles where tree_id = target_tree and account_id = target_account;
end;
$$;

create function public.list_tree_members(target_tree uuid)
returns table(account_id uuid, role text, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.can_view_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;

  return query
    select r.account_id, r.role, private.account_email(r.account_id), r.created_at
    from public.tree_roles r
    where r.tree_id = target_tree
    order by (r.role = 'owner') desc, r.created_at;
end;
$$;

revoke execute on function public.invite_to_tree(uuid, text, text), public.update_tree_role(uuid, uuid, text),
  public.remove_tree_role(uuid, uuid), public.list_tree_members(uuid) from public, anon;
grant execute on function public.invite_to_tree(uuid, text, text), public.update_tree_role(uuid, uuid, text),
  public.remove_tree_role(uuid, uuid), public.list_tree_members(uuid) to authenticated;
