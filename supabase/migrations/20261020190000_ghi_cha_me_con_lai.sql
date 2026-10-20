-- Ghi người cha/mẹ CÒN LẠI cho các con chỉ mới có một cha/mẹ ruột (con "chưa rõ cha/mẹ còn lại"), một lần cho cả nhóm con.
-- Dùng khi thêm vợ/chồng cho người đã có con, hoặc để sửa con nhập thiếu. Chạy dưới quyền người gọi (RLS parent_links áp dụng như add_child).
-- Chỉ ghi cho con ruột của `parent_id` mà chưa có cha/mẹ ruột nào khác; con khác trong danh sách bị bỏ qua (không lỗi). Hai người được nối thành vợ chồng nếu chưa.
-- Trả về số con đã ghi.
create function public.link_co_parent(parent_id uuid, co_parent_id uuid, child_ids uuid[]) returns integer
language plpgsql set search_path = ''
as $$
declare
  linked integer := 0;
  child uuid;
  added integer;
begin
  if link_co_parent.parent_id = link_co_parent.co_parent_id then
    raise exception 'SAME_PERSON' using errcode = 'check_violation';
  end if;
  if private.tree_of(link_co_parent.parent_id) <> private.tree_of(link_co_parent.co_parent_id) then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;

  foreach child in array coalesce(link_co_parent.child_ids, '{}'::uuid[]) loop
    if exists (select 1 from public.parent_links l where l.child_id = child and l.parent_id = link_co_parent.parent_id and l.kind = 'ruot')
       and not exists (select 1 from public.parent_links l where l.child_id = child and l.parent_id <> link_co_parent.parent_id and l.kind = 'ruot') then
      insert into public.parent_links (child_id, parent_id, kind) values (child, link_co_parent.co_parent_id, 'ruot')
        on conflict on constraint parent_links_pkey do nothing;
      get diagnostics added = row_count;
      linked := linked + added;
    end if;
  end loop;

  if linked > 0 then
    perform private.ensure_union(link_co_parent.parent_id, link_co_parent.co_parent_id);
  end if;
  return linked;
end;
$$;

revoke execute on function public.link_co_parent(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.link_co_parent(uuid, uuid, uuid[]) to authenticated;
