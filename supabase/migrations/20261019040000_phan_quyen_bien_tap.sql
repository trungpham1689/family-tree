-- Phân quyền chặt hơn cho Biên tập viên (vai trò được mời, không phải Chủ sở hữu):
--   * Chỉ thêm/sửa/xoá được những Người do chính mình tạo; Chủ sở hữu sửa/xoá được mọi Người.
--   * Xoá Người do mình tạo phải gửi yêu cầu, chờ Chủ sở hữu duyệt (không xoá ngay).
--   * Không còn quyền mời người khác — chỉ Chủ sở hữu mời.

alter table public.persons
  add column created_by uuid references auth.users (id) on delete set null default auth.uid(),
  add column pending_delete_by uuid references auth.users (id) on delete set null,
  add column pending_delete_at timestamptz;

-- Dữ liệu cũ (trước khi có created_by) tính là do Chủ sở hữu gia phả tạo.
update public.persons p set created_by = t.owner_id
from public.family_trees t
where p.tree_id = t.id and p.created_by is null;

-- ---------------------------------------------------------------------------
-- RLS: sửa/xoá chỉ trên Người do mình tạo (trừ Chủ sở hữu được mọi Người)
-- ---------------------------------------------------------------------------
drop policy "biên tập viên thêm Người" on public.persons;
create policy "biên tập viên thêm Người" on public.persons
  for insert to authenticated with check (public.can_edit_tree(tree_id) and created_by = auth.uid());

drop policy "biên tập viên sửa Người" on public.persons;
create policy "chủ sở hữu hoặc người tạo sửa Người" on public.persons
  for update to authenticated
  using (public.is_tree_owner(tree_id) or (public.can_edit_tree(tree_id) and created_by = auth.uid()))
  with check (public.is_tree_owner(tree_id) or (public.can_edit_tree(tree_id) and created_by = auth.uid()));

-- Xoá ngay chỉ dành cho Chủ sở hữu; Biên tập viên xoá qua request_delete_person (chờ duyệt).
drop policy "biên tập viên xoá Người" on public.persons;
create policy "chủ sở hữu xoá Người" on public.persons
  for delete to authenticated using (public.is_tree_owner(tree_id));

-- ---------------------------------------------------------------------------
-- Yêu cầu xoá: Biên tập viên gửi yêu cầu trên Người mình tạo; Chủ sở hữu duyệt/từ chối.
-- Chủ sở hữu gọi hàm này thì xoá ngay, không qua hàng chờ.
-- ---------------------------------------------------------------------------
create function public.request_delete_person(target_person uuid) returns void
language plpgsql set search_path = ''
as $$
declare
  target_tree uuid := private.tree_of(request_delete_person.target_person);
begin
  if public.is_tree_owner(target_tree) then
    delete from public.persons where id = request_delete_person.target_person;
    return;
  end if;
  if not exists (
    select 1 from public.persons
    where id = request_delete_person.target_person and created_by = auth.uid()
  ) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.persons
  set pending_delete_by = auth.uid(), pending_delete_at = now()
  where id = request_delete_person.target_person;
end;
$$;

create function public.approve_delete_person(target_person uuid) returns void
language plpgsql set search_path = ''
as $$
declare
  target_tree uuid := private.tree_of(approve_delete_person.target_person);
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  delete from public.persons where id = approve_delete_person.target_person;
end;
$$;

create function public.reject_delete_person(target_person uuid) returns void
language plpgsql set search_path = ''
as $$
declare
  target_tree uuid := private.tree_of(reject_delete_person.target_person);
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.persons set pending_delete_by = null, pending_delete_at = null
  where id = reject_delete_person.target_person;
end;
$$;

-- Danh sách yêu cầu xoá đang chờ của một Gia phả, cho Chủ sở hữu duyệt.
create function public.list_pending_deletions(target_tree uuid)
returns table(person_id uuid, full_name text, requested_by_email text, requested_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select p.id, p.full_name, private.account_email(p.pending_delete_by), p.pending_delete_at
    from public.persons p
    where p.tree_id = target_tree and p.pending_delete_by is not null
    order by p.pending_delete_at;
end;
$$;

revoke execute on function public.request_delete_person(uuid), public.approve_delete_person(uuid),
  public.reject_delete_person(uuid), public.list_pending_deletions(uuid) from public, anon;
grant execute on function public.request_delete_person(uuid), public.approve_delete_person(uuid),
  public.reject_delete_person(uuid), public.list_pending_deletions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Chỉ Chủ sở hữu mời người khác (trước đây Biên tập viên cũng mời được).
-- ---------------------------------------------------------------------------
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

  insert into public.tree_roles (tree_id, account_id, role) values (target_tree, invitee, new_role)
    on conflict (tree_id, account_id) do update set role = excluded.role;
end;
$$;
