-- Đổi Thứ tự con: trước đây giao diện ghi thẳng persons.birth_order, nên Biên tập viên đổi thứ tự anh chị em
-- gồm cả Người họ không tạo thì RLS khớp 0 dòng và việc đổi chỉ thực hiện một phần mà không báo lỗi.
-- Nay đi qua một hàm: Chủ sở hữu và Biên tập viên đổi được thứ tự của mọi Người trong gia phả (chỉ cột này),
-- và đổi thứ tự không tính là "sửa hồ sơ" nên không tăng version (khỏi báo xung đột giả cho người đang mở form).

create or replace function private.bump_person_version() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.version is distinct from old.version then
    raise exception 'STALE_VERSION'
      using detail = 'Người này đã được sửa sau khi bạn mở.', errcode = 'serialization_failure';
  end if;
  if to_jsonb(new) - 'avatar_path' - 'updated_at' - 'birth_order' = to_jsonb(old) - 'avatar_path' - 'updated_at' - 'birth_order' then
    return new;
  end if;
  new.version := old.version + 1;
  return new;
end;
$$;

create function public.reorder_children(ordered_ids uuid[]) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target_tree uuid;
  found_count integer;
begin
  if coalesce(array_length(ordered_ids, 1), 0) = 0 then
    return;
  end if;
  select tree_id into target_tree from public.persons where id = ordered_ids[1];
  if target_tree is null or not public.can_edit_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  select count(*) into found_count from public.persons where id = any (ordered_ids) and tree_id = target_tree;
  if found_count <> array_length(ordered_ids, 1) then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;

  update public.persons p set birth_order = least(o.position, 99)
  from unnest(ordered_ids) with ordinality as o(id, position)
  where p.id = o.id;
end;
$$;

revoke execute on function public.reorder_children(uuid[]) from public, anon;
grant execute on function public.reorder_children(uuid[]) to authenticated;
