-- Quy tắc ghi của Biên tập viên theo từng bảng (xem bảng "Quy tắc ghi" trong CONTEXT.md, tests/db/write-rules.test.ts):
--   Người, ảnh tư liệu, Sự kiện: Biên tập viên chỉ thêm / sửa / xoá những gì do chính mình tạo; Chủ sở hữu mọi thứ.
--   Quan hệ cha mẹ, hôn phối: Biên tập viên thêm và sửa; chỉ Chủ sở hữu xoá.
--   Cấu hình Phả đồ: Biên tập viên nào cũng lưu được (một dòng chung của gia phả, không có "người tạo").
-- Migration này đưa Sự kiện về cùng luật với Người (trước đây Biên tập viên sửa/xoá được mọi Sự kiện).

-- Sự kiện cũ chưa có người tạo: coi là do Chủ sở hữu tạo.
update public.tree_events e set created_by = t.owner_id
from public.family_trees t
where e.tree_id = t.id and e.created_by is null;

drop policy "biên tập viên thêm sự kiện" on public.tree_events;
create policy "biên tập viên thêm sự kiện của mình" on public.tree_events
  for insert to authenticated with check (public.can_edit_tree(tree_id) and created_by = auth.uid());

drop policy "biên tập viên sửa sự kiện" on public.tree_events;
create policy "chủ sở hữu hoặc người tạo sửa sự kiện" on public.tree_events
  for update to authenticated
  using (public.is_tree_owner(tree_id) or (public.can_edit_tree(tree_id) and created_by = auth.uid()))
  with check (public.is_tree_owner(tree_id) or (public.can_edit_tree(tree_id) and created_by = auth.uid()));

drop policy "biên tập viên xoá sự kiện" on public.tree_events;
create policy "chủ sở hữu hoặc người tạo xoá sự kiện" on public.tree_events
  for delete to authenticated
  using (public.is_tree_owner(tree_id) or (public.can_edit_tree(tree_id) and created_by = auth.uid()));
