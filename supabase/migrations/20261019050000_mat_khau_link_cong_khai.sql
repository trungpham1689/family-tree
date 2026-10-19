-- Link chia sẻ công khai bắt buộc có mật khẩu: khách phải nhập đúng mật khẩu mới xem được
-- nội dung gia phả. Thẻ xem trước (public_tree_card, cho Zalo/Facebook khi dán link) vẫn không
-- cần mật khẩu — chỉ tên gia phả và số người, không phải "nội dung".

create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
grant usage on schema extensions to anon, authenticated;

alter table public.family_trees add column public_password_hash text;

-- Đổi chữ ký (thêm password) nên phải drop bản cũ trước khi tạo lại.
drop function public.rotate_public_link(uuid);

-- Bật/tạo lại link: luôn đặt kèm mật khẩu mới (ít nhất 4 ký tự).
create function public.rotate_public_link(target_tree uuid, password text) returns text
language plpgsql set search_path = ''
as $$
declare
  token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if password is null or length(password) < 4 then
    raise exception 'PASSWORD_TOO_SHORT' using errcode = 'check_violation';
  end if;
  update public.family_trees
  set public_token = token, public_password_hash = extensions.crypt(password, extensions.gen_salt('bf'))
  where id = target_tree;
  return token;
end;
$$;

-- Đổi mật khẩu mà không đổi link đang dùng.
create function public.set_public_link_password(target_tree uuid, password text) returns void
language plpgsql set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if password is null or length(password) < 4 then
    raise exception 'PASSWORD_TOO_SHORT' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.family_trees where id = target_tree and public_token is not null) then
    raise exception 'LINK_NOT_ENABLED' using errcode = 'check_violation';
  end if;
  update public.family_trees
  set public_password_hash = extensions.crypt(password, extensions.gen_salt('bf'))
  where id = target_tree;
end;
$$;

create or replace function public.disable_public_link(target_tree uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.family_trees set public_token = null, public_password_hash = null where id = target_tree;
end;
$$;

revoke execute on function public.set_public_link_password(uuid, text) from public, anon;
grant execute on function public.set_public_link_password(uuid, text) to authenticated;
-- rotate_public_link, disable_public_link: quyền cũ áp lại cho chữ ký mới (rotate) / không đổi (disable).
revoke execute on function public.rotate_public_link(uuid, text) from public, anon;
grant execute on function public.rotate_public_link(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- public_tree(token, password): đúng mật khẩu mới trả dữ liệu; sai thì báo rõ để phân biệt
-- với "link không còn hiệu lực" (token sai/đã tắt) — phân biệt được vì thẻ xem trước
-- (public_tree_card) đã công khai sự tồn tại của link rồi, không lộ thêm gì.
-- ---------------------------------------------------------------------------
drop function public_share.public_tree(text);
drop function public.public_tree(text);

create function public_share.public_tree(token text, password text)
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
  if tree.public_password_hash is null or password is null
     or extensions.crypt(password, tree.public_password_hash) is distinct from tree.public_password_hash then
    return jsonb_build_object('wrong_password', true);
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

create function public.public_tree(token text, password text) returns jsonb
language sql stable set search_path = '' as $$ select public_share.public_tree(token, password) $$;

revoke execute on function public_share.public_tree(text, text) from public;
grant execute on function public_share.public_tree(text, text) to anon, authenticated;
revoke execute on function public.public_tree(text, text) from public;
grant execute on function public.public_tree(text, text) to anon, authenticated;
