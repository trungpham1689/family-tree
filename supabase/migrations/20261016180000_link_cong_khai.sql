-- Link chia sẻ công khai (ticket 12, ADR 0002).
-- Khách không đăng nhập không đọc thẳng bảng nào; mọi dữ liệu đi qua public_tree(token),
-- và việc lọc thông tin riêng tư làm ngay trong database.

alter table public.family_trees add column public_token text unique
  check (public_token is null or public_token ~ '^[0-9a-f]{32}$');

-- Biên tập viên bật trên hồ sơ: người này không xuất hiện trên link công khai.
alter table public.persons add column hidden_from_public boolean not null default false;

-- ---------------------------------------------------------------------------
-- Bật, tạo lại, tắt link (Chủ sở hữu; chạy với quyền người gọi nên RLS "chủ sở hữu sửa gia phả" áp dụng)
-- ---------------------------------------------------------------------------
create function public.rotate_public_link(target_tree uuid) returns text
language plpgsql set search_path = ''
as $$
declare
  token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.family_trees set public_token = token where id = target_tree;
  return token;
end;
$$;

create function public.disable_public_link(target_tree uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.family_trees set public_token = null where id = target_tree;
end;
$$;

-- ---------------------------------------------------------------------------
-- Bản công khai đã lọc
-- ---------------------------------------------------------------------------
-- Schema riêng cho hàm khách không đăng nhập được gọi, để không phải mở schema private cho anon.
-- PostgREST không phục vụ schema này; khách gọi qua bản public bên dưới.
create schema if not exists public_share;
revoke all on schema public_share from public;
grant usage on schema public_share to anon, authenticated, service_role;

-- Người còn sống: chỉ tên, giới tính, năm sinh, thứ tự con (Đời và quan hệ đi kèm).
-- Người đã mất: đầy đủ trừ Mộ phần.
-- Người bị ẩn: bỏ hẳn; nếu có con trong cây thì thay bằng ô "Ẩn danh" để con cháu vẫn nối được.
create function public_share.public_tree(token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  tree public.family_trees;
begin
  if token is null or token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into tree from public.family_trees where public_token = token;
  if tree.id is null then
    return null;
  end if;

  return (
    with positions as (
      select * from public.tree_positions(tree.id)
    ),
    shown as (
      select p.*,
             p.hidden_from_public as anonymous
      from public.persons p
      where p.tree_id = tree.id
        and (not p.hidden_from_public
             or exists (select 1 from public.parent_links l where l.parent_id = p.id))
    ),
    people as (
      select jsonb_build_object(
               'id', s.id,
               'full_name', case when s.anonymous then 'Ẩn danh' else s.full_name end,
               'gender', case when s.anonymous then null else s.gender end,
               'is_progenitor', s.is_progenitor,
               'is_deceased', case when s.anonymous then false else s.is_deceased end,
               'birth_order', s.birth_order,
               'birth_year', case when s.anonymous then null else s.birth_year end,
               'birth_approx', case when s.anonymous then false else s.birth_approx end,
               'birth_precision', case when s.anonymous or s.birth_year is null then null else 'nam' end,
               'anonymous', s.anonymous
             )
             || case
                  when s.anonymous or not s.is_deceased then '{}'::jsonb
                  else jsonb_build_object(
                    'birth_precision', s.birth_precision,
                    'birth_calendar', s.birth_calendar,
                    'birth_month', s.birth_month,
                    'birth_day', s.birth_day,
                    'birth_leap', s.birth_leap,
                    'birth_solar_date', s.birth_solar_date,
                    'birth_place', s.birth_place,
                    'common_name', s.common_name,
                    'taboo_name', s.taboo_name,
                    'courtesy_name', s.courtesy_name,
                    'han_name', s.han_name,
                    'hometown', s.hometown,
                    'residence', s.residence,
                    'occupation', s.occupation,
                    'education', s.education,
                    'title', s.title,
                    'biography', s.biography,
                    'role_note', s.role_note,
                    'death_calendar', s.death_calendar,
                    'death_precision', s.death_precision,
                    'death_year', s.death_year,
                    'death_month', s.death_month,
                    'death_day', s.death_day,
                    'death_leap', s.death_leap,
                    'death_approx', s.death_approx,
                    'death_solar_date', s.death_solar_date,
                    'anniversary_day', s.anniversary_day,
                    'anniversary_month', s.anniversary_month,
                    'worship_place', s.worship_place,
                    'worship_keeper', s.worship_keeper
                  )
                end as person
      from shown s
    )
    select jsonb_build_object(
      'tree', jsonb_build_object(
        'name', tree.name,
        'description', tree.description,
        'outside_generations', tree.outside_generations
      ),
      'persons', coalesce((select jsonb_agg(person) from people), '[]'::jsonb),
      'parentLinks', coalesce((
        select jsonb_agg(jsonb_build_object('child_id', l.child_id, 'parent_id', l.parent_id, 'kind', l.kind))
        from public.parent_links l
        where l.tree_id = tree.id
          and l.child_id in (select id from shown) and l.parent_id in (select id from shown)
      ), '[]'::jsonb),
      'unions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', u.id, 'partner_a', u.partner_a, 'partner_b', u.partner_b,
          'order_for_a', u.order_for_a, 'order_for_b', u.order_for_b, 'status', u.status))
        from public.unions u
        where u.tree_id = tree.id
          and u.partner_a in (select id from shown) and u.partner_b in (select id from shown)
      ), '[]'::jsonb),
      'positions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'person_id', pos.person_id, 'generation', pos.generation, 'branch_id', pos.branch_id, 'kind', pos.kind))
        from positions pos
        where pos.person_id in (select id from shown)
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- Thông tin nhẹ cho thẻ xem trước khi dán link vào Zalo/Facebook.
create function public_share.public_tree_card(token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', t.name,
    'description', t.description,
    'persons', (select count(*) from public.persons p where p.tree_id = t.id and not p.hidden_from_public)
  )
  from public.family_trees t
  where token ~ '^[0-9a-f]{32}$' and t.public_token = token
$$;

create function public.public_tree(token text) returns jsonb
language sql stable set search_path = '' as $$ select public_share.public_tree(token) $$;
create function public.public_tree_card(token text) returns jsonb
language sql stable set search_path = '' as $$ select public_share.public_tree_card(token) $$;

revoke execute on function public.rotate_public_link(uuid), public.disable_public_link(uuid) from public, anon;
grant execute on function public.rotate_public_link(uuid), public.disable_public_link(uuid) to authenticated;

revoke execute on function public_share.public_tree(text), public_share.public_tree_card(text) from public;
grant execute on function public_share.public_tree(text), public_share.public_tree_card(text) to anon, authenticated;
revoke execute on function public.public_tree(text), public.public_tree_card(text) from public;
grant execute on function public.public_tree(text), public.public_tree_card(text) to anon, authenticated;
