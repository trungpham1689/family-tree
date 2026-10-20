-- Biên tập viên sửa được MỌI Người trong gia phả (trước đây chỉ Người do chính mình tạo). Thêm Người mới vẫn như cũ.
-- Xoá không đổi: chỉ Chủ sở hữu xoá ngay; Biên tập viên gửi yêu cầu (nay cho mọi Người), Chủ sở hữu duyệt hoặc từ chối.
-- Ảnh tư liệu của Người đi theo quyền sửa Người (private.can_edit_person) nên Biên tập viên cũng thêm/sửa/xoá được ảnh của mọi Người.
-- Sự kiện giữ nguyên: Biên tập viên chỉ sửa Sự kiện do mình tạo.

drop policy "chủ sở hữu hoặc người tạo sửa Người" on public.persons;
create policy "chủ sở hữu và biên tập viên sửa Người" on public.persons
  for update to authenticated
  using (public.can_edit_tree(tree_id))
  with check (public.can_edit_tree(tree_id));

create or replace function private.can_edit_person(target_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.persons p
    where p.id = target_person and private.tree_role(p.tree_id) in ('owner', 'editor')
  )
$$;

create or replace function public.request_delete_person(target_person uuid) returns void
language plpgsql set search_path = ''
as $$
declare
  target_tree uuid := private.tree_of(request_delete_person.target_person);
begin
  if public.is_tree_owner(target_tree) then
    delete from public.persons where id = request_delete_person.target_person;
    return;
  end if;
  if not public.can_edit_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.persons
  set pending_delete_by = auth.uid(), pending_delete_at = now()
  where id = request_delete_person.target_person and pending_delete_by is null;
end;
$$;

-- Người tạo là thông tin ghi nhận, không đổi được sau khi tạo (Biên tập viên sửa được mọi Người nên không để ai ghi đè).
create function private.keep_person_creator() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

create trigger persons_keep_creator before update on public.persons
  for each row execute function private.keep_person_creator();

revoke execute on function private.keep_person_creator() from public, anon;
