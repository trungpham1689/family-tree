-- Rà soát an toàn / logic:
--   * Người không chuyển được sang gia phả khác; Người phụ trách cúng giỗ phải cùng gia phả.
--   * Ảnh tư liệu: không đổi được người/gia phả của ảnh, đường dẫn phải thuộc đúng gia phả, và
--     Biên tập viên chỉ thêm/sửa/xoá ảnh của Người do chính mình tạo (giống quyền sửa Người).
--   * Chỉ Chủ sở hữu xoá trực tiếp quan hệ cha mẹ / hôn phối (giao diện không có thao tác xoá lẻ;
--     xoá Người thì quan hệ tự mất theo qua khoá ngoại).
--   * link_account_to_person không còn "mồi" reminder_watch: từ khi nhắc giỗ là mặc định BẬT, bảng đó
--     là danh sách đã TẮT, nên mồi bằng tổ tiên sẽ vô tình tắt nhắc giỗ của chính các cụ.
--   * Chỉ mục cho các khoá ngoại còn thiếu (xoá Người/Gia phả không phải quét cả bảng).

-- ---------------------------------------------------------------------------
-- Người: bất biến gia phả, tham chiếu cùng gia phả
-- ---------------------------------------------------------------------------
create function private.check_person_refs() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.tree_id is distinct from old.tree_id then
    raise exception 'TREE_IMMUTABLE' using errcode = 'check_violation';
  end if;
  if new.worship_keeper_id is not null and not exists (
    select 1 from public.persons p where p.id = new.worship_keeper_id and p.tree_id = new.tree_id
  ) then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger persons_check_refs before insert or update on public.persons
  for each row execute function private.check_person_refs();

-- ---------------------------------------------------------------------------
-- Ảnh tư liệu
-- ---------------------------------------------------------------------------
create or replace function private.check_person_photo() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  target_tree uuid;
  current_count integer;
  max_photos integer := private.app_setting('max_photos_per_person');
begin
  select tree_id into target_tree from public.persons where id = new.person_id;
  if target_tree is null then
    raise exception 'PERSON_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  new.tree_id := target_tree;

  -- Đường dẫn là "{tree_id}/…": không cho trỏ ảnh sang kho của gia phả khác.
  if split_part(new.storage_path, '/', 1) <> target_tree::text then
    raise exception 'PHOTO_PATH_INVALID' using errcode = 'check_violation';
  end if;

  select count(*) into current_count from public.person_photos where person_id = new.person_id;
  if current_count >= max_photos then
    raise exception 'PHOTO_LIMIT_REACHED'
      using detail = format('Mỗi người tối đa %s ảnh.', max_photos), errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create function private.lock_person_photo() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.person_id <> old.person_id or new.tree_id <> old.tree_id then
    raise exception 'PHOTO_IMMUTABLE' using errcode = 'check_violation';
  end if;
  if split_part(new.storage_path, '/', 1) <> new.tree_id::text then
    raise exception 'PHOTO_PATH_INVALID' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger person_photos_lock before update on public.person_photos
  for each row execute function private.lock_person_photo();

-- Chủ sở hữu, hoặc Biên tập viên đã tạo Người đó (cùng luật với policy sửa Người).
create function private.can_edit_person(target_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.persons p
    where p.id = target_person
      and (private.tree_role(p.tree_id) = 'owner'
           or (private.tree_role(p.tree_id) = 'editor' and p.created_by = auth.uid()))
  )
$$;

drop policy "biên tập viên thêm ảnh tư liệu" on public.person_photos;
drop policy "biên tập viên sửa ảnh tư liệu" on public.person_photos;
drop policy "biên tập viên xoá ảnh tư liệu" on public.person_photos;

create policy "chủ Người thêm ảnh tư liệu" on public.person_photos
  for insert to authenticated with check (private.can_edit_person(person_id));
create policy "chủ Người sửa ảnh tư liệu" on public.person_photos
  for update to authenticated using (private.can_edit_person(person_id)) with check (private.can_edit_person(person_id));
create policy "chủ Người xoá ảnh tư liệu" on public.person_photos
  for delete to authenticated using (private.can_edit_person(person_id));

-- ---------------------------------------------------------------------------
-- Xoá quan hệ: chỉ Chủ sở hữu
-- ---------------------------------------------------------------------------
drop policy "biên tập viên xoá quan hệ cha mẹ" on public.parent_links;
create policy "chủ sở hữu xoá quan hệ cha mẹ" on public.parent_links
  for delete to authenticated using (public.is_tree_owner(tree_id));

drop policy "biên tập viên xoá hôn phối" on public.unions;
create policy "chủ sở hữu xoá hôn phối" on public.unions
  for delete to authenticated using (public.is_tree_owner(tree_id));

-- ---------------------------------------------------------------------------
-- Liên kết tài khoản – Người: chỉ ghi liên kết, không đụng tới nhắc giỗ
-- ---------------------------------------------------------------------------
create or replace function public.link_account_to_person(target_tree uuid, person_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if private.tree_role(target_tree) is null then
    raise exception 'NOT_TREE_MEMBER' using errcode = 'check_violation';
  end if;
  update public.tree_roles set linked_person_id = link_account_to_person.person_id
  where tree_id = target_tree and account_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Quyền gọi hàm
-- ---------------------------------------------------------------------------
revoke execute on function private.check_person_refs(), private.lock_person_photo() from public, anon, authenticated;
revoke execute on function private.can_edit_person(uuid) from public, anon;
grant execute on function private.can_edit_person(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Chỉ mục cho khoá ngoại
-- ---------------------------------------------------------------------------
create index persons_worship_keeper_idx on public.persons (worship_keeper_id) where worship_keeper_id is not null;
create index tree_roles_linked_person_idx on public.tree_roles (linked_person_id) where linked_person_id is not null;
create index reminder_watch_person_idx on public.reminder_watch (person_id);
create index reminder_watch_tree_idx on public.reminder_watch (tree_id);
create index reminder_prefs_tree_idx on public.reminder_prefs (tree_id);
