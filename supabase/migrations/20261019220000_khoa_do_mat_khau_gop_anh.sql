-- 1) Gộp người trùng không làm một Người vượt giới hạn ảnh (merge_persons chuyển tối đa số ảnh còn thiếu).
-- 2) Link công khai chống dò mật khẩu: sai mật khẩu 10 lần trong 10 phút thì khoá thử tiếp (TOO_MANY_ATTEMPTS) cho tới khi
--    hết 10 phút. Khoá theo gia phả, không theo người gọi (khách ẩn danh không có định danh tin được), nên người lạ đoán
--    mật khẩu cũng chặn tạm cả khách thật; Chủ sở hữu vẫn xem được bằng tài khoản. Mỗi lần thử còn tốn một lần bcrypt.

create or replace function public.merge_persons(keep_person uuid, drop_person uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  keep_tree uuid := private.tree_of(merge_persons.keep_person);
  drop_tree uuid := private.tree_of(merge_persons.drop_person);
  keep_json jsonb;
  drop_json jsonb;
  fill_columns text[];
  birth_cols constant text[] := array['birth_calendar', 'birth_precision', 'birth_year', 'birth_month', 'birth_day', 'birth_leap', 'birth_approx', 'birth_solar_date'];
  death_cols constant text[] := array['death_calendar', 'death_precision', 'death_year', 'death_month', 'death_day', 'death_leap', 'death_approx', 'death_solar_date', 'is_deceased'];
  anniversary_cols constant text[] := array['anniversary_day', 'anniversary_month', 'anniversary_manual'];
  column_list text;
  keep_has_avatar boolean;
begin
  if not public.is_tree_owner(keep_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if keep_person = drop_person then
    raise exception 'SAME_PERSON' using errcode = 'check_violation';
  end if;
  if keep_tree <> drop_tree then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;

  -- Quan hệ cha mẹ – con: chuyển sang keep, bỏ dòng trùng và dòng giữa hai người.
  delete from public.parent_links
    where (child_id = keep_person and parent_id = drop_person) or (child_id = drop_person and parent_id = keep_person);
  delete from public.parent_links l where l.child_id = drop_person
    and exists (select 1 from public.parent_links k where k.child_id = keep_person and k.parent_id = l.parent_id);
  update public.parent_links set child_id = keep_person where child_id = drop_person;
  delete from public.parent_links l where l.parent_id = drop_person
    and exists (select 1 from public.parent_links k where k.parent_id = keep_person and k.child_id = l.child_id);
  update public.parent_links set parent_id = keep_person where parent_id = drop_person;

  -- Hôn phối: tương tự; giữ ngày cưới của dòng bị bỏ nếu dòng giữ còn trống.
  delete from public.unions
    where (partner_a = keep_person and partner_b = drop_person) or (partner_a = drop_person and partner_b = keep_person);
  update public.unions k set
    marriage_year = d.marriage_year, marriage_month = d.marriage_month, marriage_day = d.marriage_day
  from public.unions d
  where k.marriage_year is null and d.marriage_year is not null
    and keep_person in (k.partner_a, k.partner_b) and drop_person in (d.partner_a, d.partner_b)
    and (case when k.partner_a = keep_person then k.partner_b else k.partner_a end)
      = (case when d.partner_a = drop_person then d.partner_b else d.partner_a end);
  delete from public.unions d where drop_person in (d.partner_a, d.partner_b)
    and exists (
      select 1 from public.unions k
      where keep_person in (k.partner_a, k.partner_b)
        and (case when k.partner_a = keep_person then k.partner_b else k.partner_a end)
          = (case when d.partner_a = drop_person then d.partner_b else d.partner_a end)
    );
  update public.unions set partner_a = keep_person where partner_a = drop_person;
  update public.unions set partner_b = keep_person where partner_b = drop_person;

  -- Ảnh: chuyển sang keep (ảnh đại diện của keep được ưu tiên).
  perform set_config('app.merging_persons', 'on', true);
  select exists (select 1 from public.person_photos where person_id = keep_person and is_avatar) into keep_has_avatar;
  -- Chỉ chuyển tối đa số ảnh còn thiếu so với giới hạn mỗi Người (ảnh đại diện của người bị gộp đi trước); ảnh dư
  -- bị xoá theo người bị gộp (file trên kho thành file mồ côi, dọn bằng "Dọn ảnh mồ côi").
  update public.person_photos p
    set person_id = keep_person, is_avatar = p.is_avatar and not keep_has_avatar
    where p.id in (
      select d.id from public.person_photos d
      where d.person_id = drop_person
      order by d.is_avatar desc, d.created_at
      limit greatest(0, private.app_setting('max_photos_per_person')
                        - (select count(*) from public.person_photos k where k.person_id = keep_person))
    );
  perform set_config('app.merging_persons', 'off', true);

  -- Tham chiếu khác.
  update public.persons set worship_keeper_id = keep_person where worship_keeper_id = drop_person;
  update public.tree_roles r set linked_person_id = keep_person
    where linked_person_id = drop_person
      and not exists (select 1 from public.tree_roles o where o.account_id = r.account_id and o.tree_id = r.tree_id and o.linked_person_id = keep_person);

  -- Hồ sơ: điền trường còn trống của keep bằng giá trị của drop. Các nhóm ngày sinh / ngày mất / ngày giỗ
  -- đi nguyên nhóm (và chỉ khi keep chưa có năm) để không lệch ràng buộc độ chính xác.
  select to_jsonb(p) into keep_json from public.persons p where p.id = keep_person;
  select to_jsonb(p) into drop_json from public.persons p where p.id = drop_person;
  select array_agg(d.key) into fill_columns
    from jsonb_each(drop_json) d
    where d.value <> 'null'::jsonb and keep_json -> d.key = 'null'::jsonb
      and d.key <> all (array['id', 'tree_id', 'version', 'created_at', 'updated_at', 'created_by', 'pending_delete_by',
                              'pending_delete_at', 'is_progenitor', 'avatar_path', 'worship_keeper_id']
                        || birth_cols || death_cols || anniversary_cols);
  if keep_json -> 'birth_year' = 'null'::jsonb and drop_json -> 'birth_year' <> 'null'::jsonb then
    fill_columns := fill_columns || birth_cols;
  end if;
  if keep_json -> 'death_year' = 'null'::jsonb and drop_json -> 'death_year' <> 'null'::jsonb then
    fill_columns := fill_columns || death_cols;
  end if;
  if keep_json -> 'anniversary_day' = 'null'::jsonb and drop_json -> 'anniversary_day' <> 'null'::jsonb then
    fill_columns := fill_columns || anniversary_cols;
  end if;
  if (drop_json ->> 'is_progenitor')::boolean then
    update public.persons set is_progenitor = false where id = drop_person;
    update public.persons set is_progenitor = true where id = keep_person;
  end if;
  -- Xoá drop trước khi ghi để các ràng buộc duy nhất (nếu có) không vướng.
  delete from public.persons where id = drop_person;
  select string_agg(quote_ident(c), ', ') into column_list from unnest(fill_columns) c;
  if column_list is not null then
    execute format(
      'update public.persons set (%1$s) = (select %1$s from jsonb_populate_record(null::public.persons, $1)) where id = $2',
      column_list
    ) using drop_json, keep_person;
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- Khoá dò mật khẩu link công khai
-- ---------------------------------------------------------------------------
create table public_share.password_failures (
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  failed_at timestamptz not null default now()
);
create index password_failures_idx on public_share.password_failures (tree_id, failed_at);
alter table public_share.password_failures enable row level security;

-- Hàm cũ giữ nguyên làm phần xử lý bên trong; chỉ hàm bọc mới được gọi từ ngoài.
alter function public_share.public_tree(text, text) rename to public_tree_unthrottled;
revoke execute on function public_share.public_tree_unthrottled(text, text) from public, anon, authenticated;

create function public_share.public_tree(token text, password text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  target uuid;
  result jsonb;
begin
  if token is null or token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select t.id into target from public.family_trees t where t.public_token = token;
  if target is null then
    return null;
  end if;
  if (select count(*) from public_share.password_failures f
      where f.tree_id = target and f.failed_at > now() - interval '10 minutes') >= 10 then
    raise exception 'TOO_MANY_ATTEMPTS' using errcode = 'insufficient_privilege';
  end if;

  result := public_share.public_tree_unthrottled(token, password);
  if result ? 'wrong_password' then
    delete from public_share.password_failures where failed_at < now() - interval '1 day';
    insert into public_share.password_failures (tree_id) values (target);
  end if;
  return result;
end;
$$;

revoke execute on function public_share.public_tree(text, text) from public;
grant execute on function public_share.public_tree(text, text) to anon, authenticated;

-- Hàm bọc ở schema public ghi dữ liệu nên không còn là `stable`.
create or replace function public.public_tree(token text, password text) returns jsonb
language sql set search_path = '' as $$ select public_share.public_tree(token, password) $$;
