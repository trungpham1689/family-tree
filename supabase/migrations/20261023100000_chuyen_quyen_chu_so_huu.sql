-- Chuyển quyền Chủ sở hữu: Chủ sở hữu trao gia phả cho một Biên tập viên; mình lùi về Biên tập viên.
-- Chỉ trao cho Biên tập viên (người đã được tin để sửa cây). Người nhận vẫn chịu giới hạn số gia phả sở hữu.

create function public.transfer_tree_ownership(target_tree uuid, target_account uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  max_trees integer := private.app_setting('max_trees_per_account');
begin
  -- Khoá dòng gia phả để hai lần chuyển cùng lúc không chen nhau.
  perform 1 from public.family_trees where id = target_tree for update;

  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = target_account and role = 'editor') then
    raise exception 'NEW_OWNER_NOT_EDITOR' using errcode = 'check_violation';
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
  update public.tree_roles set role = 'owner' where tree_id = target_tree and account_id = target_account;
  update public.family_trees set owner_id = target_account where id = target_tree;
end;
$$;

revoke execute on function public.transfer_tree_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_tree_ownership(uuid, uuid) to authenticated;
