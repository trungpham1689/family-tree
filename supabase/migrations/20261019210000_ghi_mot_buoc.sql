-- Các thao tác nhiều bước chuyển từ vòng lặp ở trình duyệt vào một hàm (một transaction, một ý định):
--   * merge_persons_group: gộp nhiều người trùng vào một — lỗi ở giữa thì không gộp gì (trước đây dừng giữa chừng,
--     để lại bản gộp dở không hoàn tác được);
--   * reorder_unions: đổi Thứ tự hôn phối một lần thay cho N lệnh update song song;
--   * update_union: đổi thứ tự / trạng thái / ngày cưới một lần, không còn "đọc partner_a rồi mới ghi".
-- Hai hàm sau chạy với quyền người gọi nên RLS vẫn áp dụng.

create function public.merge_persons_group(keep_person uuid, drop_persons uuid[]) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  dropped uuid;
begin
  foreach dropped in array coalesce(drop_persons, '{}') loop
    perform public.merge_persons(merge_persons_group.keep_person, dropped);
  end loop;
end;
$$;

create function public.reorder_unions(viewer_id uuid, ordered_union_ids uuid[]) returns void
language plpgsql set search_path = ''
as $$
declare
  updated integer;
begin
  update public.unions u set
    order_for_a = case when u.partner_a = reorder_unions.viewer_id then o.position else u.order_for_a end,
    order_for_b = case when u.partner_b = reorder_unions.viewer_id then o.position else u.order_for_b end
  from unnest(reorder_unions.ordered_union_ids) with ordinality as o(id, position)
  where u.id = o.id and reorder_unions.viewer_id in (u.partner_a, u.partner_b);
  get diagnostics updated = row_count;
  if updated <> coalesce(array_length(ordered_union_ids, 1), 0) then
    raise exception 'UNION_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$$;

create function public.update_union(
  target_union uuid,
  viewer uuid,
  new_order integer default null,
  new_status text default null,
  set_marriage boolean default false,
  new_marriage_year smallint default null,
  new_marriage_month smallint default null,
  new_marriage_day smallint default null
) returns void
language plpgsql set search_path = ''
as $$
begin
  update public.unions u set
    order_for_a = case when update_union.new_order is not null and u.partner_a = update_union.viewer then update_union.new_order else u.order_for_a end,
    order_for_b = case when update_union.new_order is not null and u.partner_b = update_union.viewer then update_union.new_order else u.order_for_b end,
    status = coalesce(update_union.new_status, u.status),
    marriage_year = case when update_union.set_marriage then update_union.new_marriage_year else u.marriage_year end,
    marriage_month = case when update_union.set_marriage then update_union.new_marriage_month else u.marriage_month end,
    marriage_day = case when update_union.set_marriage then update_union.new_marriage_day else u.marriage_day end
  where u.id = update_union.target_union;
  if not found then
    raise exception 'UNION_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.merge_persons_group(uuid, uuid[]), public.reorder_unions(uuid, uuid[]),
  public.update_union(uuid, uuid, integer, text, boolean, smallint, smallint, smallint) from public, anon;
grant execute on function public.merge_persons_group(uuid, uuid[]), public.reorder_unions(uuid, uuid[]),
  public.update_union(uuid, uuid, integer, text, boolean, smallint, smallint, smallint) to authenticated;
