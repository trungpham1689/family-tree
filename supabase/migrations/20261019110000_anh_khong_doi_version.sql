-- Lỗi: tải ảnh lên làm trigger đồng bộ ảnh đại diện ghi persons.avatar_path, và trigger kiểm version tăng
-- persons.version theo — nên form "Sửa thông tin" đang mở (giữ version cũ) bị báo xung đột dù người dùng chưa đổi gì.
-- Sửa: chỉ đổi avatar_path (do ảnh) thì không coi là "sửa hồ sơ" — không tăng version.
create or replace function private.bump_person_version() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.version is distinct from old.version then
    raise exception 'STALE_VERSION'
      using detail = 'Người này đã được sửa sau khi bạn mở.', errcode = 'serialization_failure';
  end if;
  if to_jsonb(new) - 'avatar_path' - 'updated_at' = to_jsonb(old) - 'avatar_path' - 'updated_at' then
    return new;
  end if;
  new.version := old.version + 1;
  return new;
end;
$$;

-- Mỗi Người tối đa 3 ảnh.
update public.app_settings set value = 3 where key = 'max_photos_per_person';
