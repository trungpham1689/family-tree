-- Sửa: gộp một Người có con (đủ cha và mẹ ruột) luôn lỗi TOO_MANY_PARENTS.
-- Khi merge_persons đổi parent_id của dòng (con, người bị gộp) sang người giữ, trigger đếm cả chính dòng cũ đang bị
-- sửa như một "cha/mẹ khác" nên đứa con có hai cha mẹ bị tính thành ba. Khi UPDATE, bỏ dòng cũ khỏi phép đếm.
create or replace function private.check_parent_link() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  child_tree uuid;
  parent_tree uuid;
begin
  select tree_id into child_tree from public.persons where id = new.child_id;
  select tree_id into parent_tree from public.persons where id = new.parent_id;
  if child_tree is null or parent_tree is null or child_tree <> parent_tree then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;
  new.tree_id := child_tree;

  -- Cha/mẹ không được là hậu duệ của chính người con.
  if exists (
    with recursive descendants(id) as (
      select new.child_id
      union
      select l.child_id from public.parent_links l join descendants d on l.parent_id = d.id
    )
    select 1 from descendants where id = new.parent_id
  ) then
    raise exception 'ANCESTOR_CYCLE' using errcode = 'check_violation';
  end if;

  if new.kind = 'ruot' and (
    select count(*) from public.parent_links
    where child_id = new.child_id and kind = 'ruot' and parent_id <> new.parent_id
      and (tg_op = 'INSERT' or (child_id, parent_id) <> (old.child_id, old.parent_id))
  ) >= 2 then
    raise exception 'TOO_MANY_PARENTS'
      using detail = 'Một người có tối đa hai cha mẹ ruột.', errcode = 'check_violation';
  end if;
  return new;
end;
$$;
