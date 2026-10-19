-- Hàm quyền "sửa Người này" cho Pages Function /api/photos: cùng một quy tắc với RLS của person_photos
-- (Chủ sở hữu, hoặc Biên tập viên đã tạo Người đó), để Drive và database không bao giờ bất đồng.
create function public.can_edit_person(target_person uuid) returns boolean
language sql stable set search_path = ''
as $$ select private.can_edit_person(target_person) $$;

revoke execute on function public.can_edit_person(uuid) from public, anon;
grant execute on function public.can_edit_person(uuid) to authenticated;
