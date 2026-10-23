-- Siêu quản trị đổi Chủ sở hữu của một gia phả (ví dụ Chủ sở hữu đã mất hoặc mất tài khoản).
-- Phần đổi vai trò dùng chung với transfer_tree_ownership qua private.move_tree_owner.

-- Đổi Chủ sở hữu: người nhận phải đã duyệt và chưa sở hữu đủ số gia phả; Chủ sở hữu cũ lùi về Biên tập viên.
-- Người nhận chưa có vai trò trong gia phả thì được thêm vào. Người gọi tự kiểm quyền và khoá dòng gia phả trước.
create function private.move_tree_owner(target_tree uuid, target_account uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  max_trees integer := private.app_setting('max_trees_per_account');
begin
  if exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = target_account and role = 'owner') then
    raise exception 'ALREADY_OWNER' using errcode = 'check_violation';
  end if;
  -- Tài khoản chưa duyệt hoặc bị chặn (chặn cũng bỏ duyệt) không vào được app: trao cho họ là gia phả mất Chủ sở hữu.
  if not coalesce((select approved from public.account_approvals where account_id = target_account), false) then
    raise exception 'NEW_OWNER_NOT_APPROVED' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.family_trees where owner_id = target_account) >= max_trees then
    raise exception 'NEW_OWNER_TREE_LIMIT'
      using detail = format('Mỗi tài khoản sở hữu tối đa %s gia phả.', max_trees), errcode = 'check_violation';
  end if;

  -- Hạ Chủ sở hữu cũ trước: mỗi gia phả chỉ có một dòng 'owner' (tree_roles_one_owner).
  update public.tree_roles set role = 'editor' where tree_id = target_tree and role = 'owner';
  insert into public.tree_roles (tree_id, account_id, role) values (target_tree, target_account, 'owner')
    on conflict (tree_id, account_id) do update set role = 'owner';
  update public.family_trees set owner_id = target_account where id = target_tree;
end;
$$;

revoke execute on function private.move_tree_owner(uuid, uuid) from public, anon, authenticated;

create or replace function public.transfer_tree_ownership(target_tree uuid, target_account uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- Khoá dòng gia phả để hai lần chuyển cùng lúc không chen nhau.
  perform 1 from public.family_trees where id = target_tree for update;

  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  -- Chủ sở hữu chỉ trao cho Biên tập viên (người đã được tin để sửa cây).
  if not exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = target_account and role = 'editor') then
    raise exception 'NEW_OWNER_NOT_EDITOR' using errcode = 'check_violation';
  end if;
  perform private.move_tree_owner(target_tree, target_account);
end;
$$;

-- Gia phả một tài khoản đang sở hữu, cho trang quản trị.
create function public.admin_list_owned_trees(target_account uuid)
returns table(tree_id uuid, name text, person_count integer, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select t.id, t.name, (select count(*)::integer from public.persons p where p.tree_id = t.id), t.created_at
    from public.family_trees t
    where t.owner_id = target_account
    order by t.created_at;
end;
$$;

-- Siêu quản trị trao gia phả cho tài khoản có email này (không cần đã có vai trò trong gia phả).
create function public.admin_transfer_tree_ownership(target_tree uuid, new_owner_email text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  new_owner uuid;
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from public.family_trees where id = target_tree for update;
  if not found then
    raise exception 'TREE_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  new_owner := private.account_id_by_email(trim(new_owner_email));
  if new_owner is null then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  perform private.move_tree_owner(target_tree, new_owner);
end;
$$;

revoke execute on function public.admin_list_owned_trees(uuid), public.admin_transfer_tree_ownership(uuid, text) from public, anon;
grant execute on function public.admin_list_owned_trees(uuid), public.admin_transfer_tree_ownership(uuid, text) to authenticated;
