-- Nhập Excel đủ trường để xuất → nhập khôi phục được cả: tình trạng hôn phối (còn / ly hôn / goá), ngày cưới,
-- người phụ trách cúng giỗ (theo mã trong file), cờ "ẩn khỏi link công khai" và "lập chi mới".
-- Payload mở rộng: persons[].{hiddenFromPublic, foundsBranch, worshipKeeper}, unions[].{status, marriageYear/Month/Day}.
-- Thiếu các trường mới (payload cũ) thì dùng mặc định như trước.

create or replace function private.import_people(target_tree uuid, payload jsonb) returns integer
language plpgsql set search_path = ''
as $$
declare
  ids jsonb := '{}'::jsonb;
  item jsonb;
  new_id uuid;
  total integer := 0;
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_TREE_OWNER' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.persons where tree_id = target_tree) then
    raise exception 'TREE_NOT_EMPTY'
      using detail = 'Chỉ nhập Excel vào gia phả mới hoặc gia phả chưa có ai.', errcode = 'check_violation';
  end if;

  for item in select value from jsonb_array_elements(payload -> 'persons') loop
    new_id := private.insert_person(target_tree, item -> 'fields');
    ids := ids || jsonb_build_object(item ->> 'key', new_id);
    total := total + 1;
  end loop;

  insert into public.parent_links (child_id, parent_id, kind)
  select (ids ->> (link ->> 'child'))::uuid, (ids ->> (link ->> 'parent'))::uuid, coalesce(link ->> 'kind', 'ruot')
  from jsonb_array_elements(payload -> 'parentLinks') as link;

  insert into public.unions (partner_a, partner_b, order_for_a, order_for_b, status, marriage_year, marriage_month, marriage_day)
  select (ids ->> (u ->> 'a'))::uuid, (ids ->> (u ->> 'b'))::uuid, (u ->> 'orderA')::integer, (u ->> 'orderB')::integer,
         coalesce(u ->> 'status', 'con'),
         (u ->> 'marriageYear')::smallint, (u ->> 'marriageMonth')::smallint, (u ->> 'marriageDay')::smallint
  from jsonb_array_elements(payload -> 'unions') as u;

  -- Cờ và người phụ trách cúng giỗ chỉ đặt được sau khi mọi Người đã có id.
  update public.persons p set
    hidden_from_public = coalesce((person ->> 'hiddenFromPublic')::boolean, false),
    founds_branch = coalesce((person ->> 'foundsBranch')::boolean, false),
    worship_keeper_id = (ids ->> (person ->> 'worshipKeeper'))::uuid
  from jsonb_array_elements(payload -> 'persons') as person
  where p.id = (ids ->> (person ->> 'key'))::uuid
    and (coalesce((person ->> 'hiddenFromPublic')::boolean, false)
         or coalesce((person ->> 'foundsBranch')::boolean, false)
         or person ->> 'worshipKeeper' is not null);

  -- Người đầu tiên tự là Thuỷ tổ; đặt lại theo đúng người mô-đun Excel chọn.
  if payload ->> 'progenitor' is not null then
    update public.persons set is_progenitor = false where tree_id = target_tree and is_progenitor;
    update public.persons set is_progenitor = true where id = (ids ->> (payload ->> 'progenitor'))::uuid;
  end if;
  return total;
end;
$$;
