-- Ảnh tư liệu: tối đa N ảnh/người (app_settings.max_photos_per_person), mỗi ảnh có chú thích,
-- một ảnh được chọn làm đại diện. Dùng chung bucket Storage 'avatars' đã tạo (đổi tên đường dẫn
-- thành {tree_id}/{person_id}/{tên file} để chứa nhiều ảnh một người).
-- persons.avatar_path giữ lại làm bản sao nhanh của ảnh đang là đại diện (Cây, Phả đồ đọc thẳng,
-- không phải join person_photos mỗi lần vẽ) — đồng bộ tự động bằng trigger dưới đây.

create table public.person_photos (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete cascade,
  storage_path text not null,
  caption text,
  is_avatar boolean not null default false,
  created_at timestamptz not null default now()
);

create index person_photos_person_idx on public.person_photos (person_id);
create index person_photos_tree_idx on public.person_photos (tree_id);
-- Mỗi người tối đa một ảnh đại diện.
create unique index person_photos_one_avatar on public.person_photos (person_id) where is_avatar;

create function private.check_person_photo() returns trigger
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

  select count(*) into current_count from public.person_photos where person_id = new.person_id;
  if current_count >= max_photos then
    raise exception 'PHOTO_LIMIT_REACHED'
      using detail = format('Mỗi người tối đa %s ảnh.', max_photos), errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger person_photos_check before insert on public.person_photos
  for each row execute function private.check_person_photo();

-- persons.avatar_path luôn khớp ảnh đang is_avatar của người đó (null nếu chưa chọn).
create function private.sync_avatar_path() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  affected uuid := coalesce(new.person_id, old.person_id);
begin
  update public.persons
  set avatar_path = (select storage_path from public.person_photos where person_id = affected and is_avatar limit 1)
  where id = affected;
  return null;
end;
$$;

create trigger person_photos_sync_avatar after insert or update or delete on public.person_photos
  for each row execute function private.sync_avatar_path();

alter table public.person_photos enable row level security;
create policy "xem ảnh tư liệu trong gia phả mình có vai trò" on public.person_photos
  for select to authenticated using (public.can_view_tree(tree_id));
create policy "biên tập viên thêm ảnh tư liệu" on public.person_photos
  for insert to authenticated with check (public.can_edit_tree(tree_id));
create policy "biên tập viên sửa ảnh tư liệu" on public.person_photos
  for update to authenticated using (public.can_edit_tree(tree_id)) with check (public.can_edit_tree(tree_id));
create policy "biên tập viên xoá ảnh tư liệu" on public.person_photos
  for delete to authenticated using (public.can_edit_tree(tree_id));

revoke insert, update, delete on public.person_photos from anon;

-- Chọn một ảnh làm đại diện: bỏ cờ ảnh cũ rồi đặt ảnh mới, trong một transaction
-- (tránh đụng unique index person_photos_one_avatar nếu làm hai câu update rời).
create function public.set_avatar_photo(photo_id uuid) returns void
language plpgsql set search_path = ''
as $$
declare
  target_person uuid;
begin
  select person_id into target_person from public.person_photos where id = set_avatar_photo.photo_id;
  if target_person is null then
    raise exception 'PHOTO_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  update public.person_photos set is_avatar = false where person_id = target_person and is_avatar;
  update public.person_photos set is_avatar = true where id = set_avatar_photo.photo_id;
end;
$$;

revoke execute on function private.check_person_photo(), private.sync_avatar_path() from public, anon, authenticated;
revoke execute on function public.set_avatar_photo(uuid) from public, anon;
grant execute on function public.set_avatar_photo(uuid) to authenticated;
