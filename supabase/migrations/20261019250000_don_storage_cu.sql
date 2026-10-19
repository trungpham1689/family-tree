-- Gỡ các policy của Supabase Storage cũ (bucket 'avatars') khi KHÔNG còn ảnh nào trỏ tới đó. Ảnh nay nằm trên Google Drive
-- (đường dẫn "{tree_id}/{id file}", 2 đoạn); chỉ ảnh chưa chuyển mới còn đường dẫn 3 đoạn "{tree_id}/{person_id}/{file}".
-- Hàm tự kiểm: còn ảnh cũ (trong database hoặc trong bucket) thì KHÔNG gỡ gì và báo lý do. Chạy lại bất cứ lúc nào:
--   select private.drop_legacy_photo_storage();
-- (Supabase không cho xoá dòng trong storage.buckets bằng SQL: bucket rỗng còn lại thì xoá trong Dashboard → Storage.)
create function private.drop_legacy_photo_storage() returns text
language plpgsql security definer set search_path = ''
as $$
declare
  legacy_count integer;
begin
  select
    (select count(*) from public.person_photos where array_length(string_to_array(storage_path, '/'), 1) <> 2)
    + (select count(*) from public.persons where avatar_path is not null and array_length(string_to_array(avatar_path, '/'), 1) <> 2)
    + (select count(*) from public.family_trees where photo_path is not null and array_length(string_to_array(photo_path, '/'), 1) <> 2)
    + (select count(*) from storage.objects where bucket_id = 'avatars')
  into legacy_count;

  if legacy_count > 0 then
    return format('Chưa gỡ: còn %s ảnh/đường dẫn cũ trên Supabase Storage. Chạy scripts/migrate-photos-to-drive.mjs trước.', legacy_count);
  end if;

  drop policy if exists "xem ảnh đại diện trong gia phả mình có vai trò" on storage.objects;
  drop policy if exists "biên tập viên tải ảnh đại diện lên" on storage.objects;
  drop policy if exists "biên tập viên đổi ảnh đại diện" on storage.objects;
  drop policy if exists "biên tập viên xoá ảnh đại diện" on storage.objects;
  return 'Đã gỡ policy Storage cũ. Xoá bucket "avatars" (đang rỗng) trong Dashboard → Storage nếu muốn.';
end;
$$;

revoke execute on function private.drop_legacy_photo_storage() from public, anon, authenticated;
-- Chạy ngay một lần: nếu đã chuyển hết ảnh thì gỡ luôn.
select private.drop_legacy_photo_storage();
