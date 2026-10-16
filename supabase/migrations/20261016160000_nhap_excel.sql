-- Nhập Gia phả từ Excel: lưu cả gia phả trong một transaction (lỗi giữa chừng thì không lưu gì).
-- Payload do mô-đun Excel phía trình duyệt tạo sau khi người dùng xem trước và xác nhận:
--   { persons: [{ key, fields }], parentLinks: [{ child, parent, kind }],
--     unions: [{ a, b, orderA, orderB }], progenitor: key | null }
-- Hàm chạy với quyền người gọi nên RLS, giới hạn 2.000 Người/3 Gia phả và các trigger kiểm tra vẫn áp dụng.

create function private.import_people(target_tree uuid, payload jsonb) returns integer
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

  insert into public.unions (partner_a, partner_b, order_for_a, order_for_b)
  select (ids ->> (u ->> 'a'))::uuid, (ids ->> (u ->> 'b'))::uuid, (u ->> 'orderA')::integer, (u ->> 'orderB')::integer
  from jsonb_array_elements(payload -> 'unions') as u;

  -- Người đầu tiên tự là Thuỷ tổ; đặt lại theo đúng người mô-đun Excel chọn.
  if payload ->> 'progenitor' is not null then
    update public.persons set is_progenitor = false where tree_id = target_tree and is_progenitor;
    update public.persons set is_progenitor = true where id = (ids ->> (payload ->> 'progenitor'))::uuid;
  end if;
  return total;
end;
$$;

-- Nhập vào một Gia phả đang trống của mình.
create function public.import_into_tree(target_tree uuid, payload jsonb) returns integer
language sql set search_path = ''
as $$ select private.import_people(target_tree, payload) $$;

-- Tạo Gia phả mới và nhập luôn, trong cùng một transaction.
create function public.import_new_tree(tree_name text, payload jsonb) returns uuid
language plpgsql set search_path = ''
as $$
declare
  new_tree uuid;
begin
  insert into public.family_trees (name) values (tree_name) returning id into new_tree;
  perform private.import_people(new_tree, payload);
  return new_tree;
end;
$$;

revoke execute on function private.import_people(uuid, jsonb) from public, anon;
grant execute on function private.import_people(uuid, jsonb) to authenticated;
revoke execute on function public.import_into_tree(uuid, jsonb), public.import_new_tree(text, jsonb) from public, anon;
grant execute on function public.import_into_tree(uuid, jsonb), public.import_new_tree(text, jsonb) to authenticated;
