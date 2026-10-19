-- Ảnh chuyển sang Google Drive (Pages Function /api/photos giữ khoá Drive, kiểm vai trò bằng can_edit_tree/can_view_tree).
-- storage_path / avatar_path nay là "{tree_id}/{id file Drive}"; đường dẫn 3 đoạn cũ "{tree_id}/{person_id}/{file}"
-- vẫn đọc được từ bucket 'avatars' cho tới khi chạy scripts/migrate-photos-to-drive.mjs.
-- Ảnh đại diện của cả gia phả cũng lưu cùng dạng.

alter table public.family_trees add column photo_path text;
