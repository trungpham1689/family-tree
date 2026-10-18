-- Ảnh đại diện mỗi Người: Supabase Storage, một ảnh/người, đường dẫn lưu trên persons.
-- RLS của Storage theo đúng vai trò trong gia phả, như mọi dữ liệu khác (ADR 0001).
-- Storage không được giả lập ở seam B (ADR 0005) — shim test chỉ có đủ bảng/hàm để DDL này không lỗi.

alter table public.persons add column avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

alter table storage.objects enable row level security;

-- Đường dẫn file: {tree_id}/{person_id}.{đuôi}; storage.foldername lấy phần thư mục ({tree_id}).
create policy "xem ảnh đại diện trong gia phả mình có vai trò" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.can_view_tree((storage.foldername(name))[1]::uuid));

create policy "biên tập viên tải ảnh đại diện lên" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and public.can_edit_tree((storage.foldername(name))[1]::uuid));

create policy "biên tập viên đổi ảnh đại diện" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and public.can_edit_tree((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'avatars' and public.can_edit_tree((storage.foldername(name))[1]::uuid));

create policy "biên tập viên xoá ảnh đại diện" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public.can_edit_tree((storage.foldername(name))[1]::uuid));
