-- TẠO TỰ ĐỘNG từ các migration — đừng sửa tay. Cập nhật: UPDATE_SCHEMA_SNAPSHOT=1 pnpm test:db
-- Đây là bản HIỆN HÀNH của từng hàm (nhiều hàm được định nghĩa lại qua nhiều migration); đọc file này thay vì lần theo các migration.

-- private.account_email(target_account uuid)  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.account_email(target_account uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select email from auth.users where id = target_account
$function$;

-- private.account_id_by_email(target_email text)  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.account_id_by_email(target_email text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select id from auth.users where lower(email) = lower(target_email) limit 1
$function$;

-- private.app_setting(setting_key text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION private.app_setting(setting_key text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select value from public.app_settings where key = setting_key $function$;

-- private.bump_person_version()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.bump_person_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.version is distinct from old.version then
    raise exception 'STALE_VERSION'
      using detail = 'Người này đã được sửa sau khi bạn mở.', errcode = 'serialization_failure';
  end if;
  if to_jsonb(new) - 'avatar_path' - 'updated_at' - 'birth_order' = to_jsonb(old) - 'avatar_path' - 'updated_at' - 'birth_order' then
    return new;
  end if;
  new.version := old.version + 1;
  return new;
end;
$function$;

-- private.can_edit_event(target_event uuid)  [anon: không, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION private.can_edit_event(target_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.tree_events e
    where e.id = target_event
      and (private.tree_role(e.tree_id) = 'owner'
           or (private.tree_role(e.tree_id) = 'editor' and e.created_by = auth.uid()))
  )
$function$;

-- private.can_edit_person(target_person uuid)  [anon: không, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION private.can_edit_person(target_person uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.persons p
    where p.id = target_person and private.tree_role(p.tree_id) in ('owner', 'editor')
  )
$function$;

-- private.check_event_photo()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.check_event_photo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_tree uuid;
  current_count integer;
  max_photos integer := private.app_setting('max_photos_per_event');
begin
  select tree_id into target_tree from public.tree_events where id = new.event_id;
  if target_tree is null then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  new.tree_id := target_tree;

  if split_part(new.storage_path, '/', 1) <> target_tree::text then
    raise exception 'PHOTO_PATH_INVALID' using errcode = 'check_violation';
  end if;

  select count(*) into current_count from public.event_photos where event_id = new.event_id;
  if current_count >= max_photos then
    raise exception 'EVENT_PHOTO_LIMIT_REACHED'
      using detail = format('Mỗi sự kiện tối đa %s ảnh.', max_photos), errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

-- private.check_event_refs()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.check_event_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.host_person_id is not null
     and not exists (select 1 from public.persons where id = new.host_person_id and tree_id = new.tree_id) then
    raise exception 'EVENT_HOST_INVALID' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

-- private.check_linked_person()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.check_linked_person()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.linked_person_id is not null and private.tree_of(new.linked_person_id) <> new.tree_id then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

-- private.check_parent_link()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.check_parent_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- private.check_person_photo()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.check_person_photo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_tree uuid;
  current_count integer;
  max_photos integer := private.app_setting('max_photos_per_person');
begin
  select tree_id into target_tree from public.persons where id = new.person_id;
  if target_tree is null then
    raise exception 'PERSON_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  new.tree_id := target_tree;

  -- Đường dẫn là "{tree_id}/…": không cho trỏ ảnh sang kho của gia phả khác.
  if split_part(new.storage_path, '/', 1) <> target_tree::text then
    raise exception 'PHOTO_PATH_INVALID' using errcode = 'check_violation';
  end if;

  select count(*) into current_count from public.person_photos where person_id = new.person_id;
  if current_count >= max_photos then
    raise exception 'PHOTO_LIMIT_REACHED'
      using detail = format('Mỗi người tối đa %s ảnh.', max_photos), errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

-- private.check_person_refs()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.check_person_refs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' and new.tree_id is distinct from old.tree_id then
    raise exception 'TREE_IMMUTABLE' using errcode = 'check_violation';
  end if;
  if new.worship_keeper_id is not null and not exists (
    select 1 from public.persons p where p.id = new.worship_keeper_id and p.tree_id = new.tree_id
  ) then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

-- private.check_reminder_watch()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.check_reminder_watch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  new.tree_id := private.tree_of(new.person_id);
  return new;
end;
$function$;

-- private.check_union()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.check_union()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  tree_a uuid;
  tree_b uuid;
begin
  select tree_id into tree_a from public.persons where id = new.partner_a;
  select tree_id into tree_b from public.persons where id = new.partner_b;
  if tree_a is null or tree_b is null or tree_a <> tree_b then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;
  new.tree_id := tree_a;
  return new;
end;
$function$;

-- private.confirm_email_on_approval()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.confirm_email_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = new.account_id;
  return new;
end;
$function$;

-- private.default_date_precision()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.default_date_precision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.birth_year is not null and new.birth_precision is null and new.birth_month is null then
    new.birth_precision := 'nam';
  end if;
  if new.death_year is not null and new.death_precision is null and new.death_month is null then
    new.death_precision := 'nam';
  end if;
  if new.birth_year is null and new.birth_month is null and new.birth_day is null then
    new.birth_precision := null;
  end if;
  if new.death_year is null and new.death_month is null and new.death_day is null then
    new.death_precision := null;
  end if;
  return new;
end;
$function$;

-- private.drop_legacy_photo_storage()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.drop_legacy_photo_storage()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  legacy_count integer;
begin
  select
    (select count(*) from public.person_photos where array_length(string_to_array(storage_path, '/'), 1) <> 2)
    + (select count(*) from public.persons where avatar_path is not null and array_length(string_to_array(avatar_path, '/'), 1) <> 2)
    + (select count(*) from public.family_trees where photo_path is not null and array_length(string_to_array(photo_path, '/'), 1) <> 2)
    + (select count(*) from storage.objects where bucket_id = 'avatars')
  into legacy_count;

  if legacy_count > 0 then
    return format('Chưa gỡ: còn %s ảnh/đường dẫn cũ trên Supabase Storage. Chạy scripts/migrate-photos-to-drive.mjs trước.', legacy_count);
  end if;

  drop policy if exists "xem ảnh đại diện trong gia phả mình có vai trò" on storage.objects;
  drop policy if exists "biên tập viên tải ảnh đại diện lên" on storage.objects;
  drop policy if exists "biên tập viên đổi ảnh đại diện" on storage.objects;
  drop policy if exists "biên tập viên xoá ảnh đại diện" on storage.objects;
  return 'Đã gỡ policy Storage cũ. Xoá bucket "avatars" (đang rỗng) trong Dashboard → Storage nếu muốn.';
end;
$function$;

-- private.enforce_person_limit()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.enforce_person_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  current_count integer;
  max_persons integer := private.app_setting('max_persons_per_tree');
begin
  select count(*) into current_count from public.persons where tree_id = new.tree_id;
  if current_count >= max_persons then
    raise exception 'PERSON_LIMIT_REACHED'
      using detail = format('Mỗi gia phả có tối đa %s Người.', max_persons),
            errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

-- private.enforce_tree_limit()  [anon: không, authenticated: không, service_role: có]
CREATE OR REPLACE FUNCTION private.enforce_tree_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  owned integer;
  max_trees integer := private.app_setting('max_trees_per_account');
begin
  select count(*) into owned from public.family_trees where owner_id = new.owner_id;
  if owned >= max_trees then
    raise exception 'TREE_LIMIT_REACHED'
      using detail = format('Mỗi tài khoản tạo tối đa %s gia phả.', max_trees),
            errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

-- private.ensure_union(first_partner uuid, second_partner uuid)  [anon: không, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION private.ensure_union(first_partner uuid, second_partner uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if exists (
    select 1 from public.unions u
    where least(u.partner_a, u.partner_b) = least(first_partner, second_partner)
      and greatest(u.partner_a, u.partner_b) = greatest(first_partner, second_partner)
  ) then
    return;
  end if;
  insert into public.unions (partner_a, partner_b, order_for_a, order_for_b)
  values (
    first_partner,
    second_partner,
    (select count(*) + 1 from public.unions u where first_partner in (u.partner_a, u.partner_b)),
    (select count(*) + 1 from public.unions u where second_partner in (u.partner_a, u.partner_b))
  );
end;
$function$;

-- private.grant_owner_role()  [anon: không, authenticated: không, service_role: có]
CREATE OR REPLACE FUNCTION private.grant_owner_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.tree_roles (tree_id, account_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$function$;

-- private.import_people(target_tree uuid, payload jsonb)  [anon: không, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION private.import_people(target_tree uuid, payload jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

-- private.insert_person(target_tree uuid, data jsonb)  [anon: không, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION private.insert_person(target_tree uuid, data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  f public.persons;
  new_id uuid;
begin
  f := jsonb_populate_record(null::public.persons, data);
  insert into public.persons (
    tree_id, full_name, gender, birth_order, is_deceased,
    common_name, taboo_name, courtesy_name, han_name,
    birth_calendar, birth_precision, birth_year, birth_month, birth_day, birth_leap, birth_approx, birth_solar_date, birth_place,
    hometown, residence, occupation, education, title, phone, email, biography, role_note,
    death_calendar, death_precision, death_year, death_month, death_day, death_leap, death_approx, death_solar_date,
    anniversary_day, anniversary_month, anniversary_manual,
    burial_place, burial_map_url, worship_place, worship_keeper_id
  )
  values (
    target_tree, f.full_name, f.gender, f.birth_order, coalesce(f.is_deceased, f.death_year is not null),
    f.common_name, f.taboo_name, f.courtesy_name, f.han_name,
    coalesce(f.birth_calendar, 'duong'),
    coalesce(f.birth_precision, case when f.birth_year is not null then 'nam' end),
    f.birth_year, f.birth_month, f.birth_day, coalesce(f.birth_leap, false), coalesce(f.birth_approx, false),
    f.birth_solar_date, f.birth_place,
    f.hometown, f.residence, f.occupation, f.education, f.title, f.phone, f.email, f.biography, f.role_note,
    coalesce(f.death_calendar, 'duong'),
    coalesce(f.death_precision, case when f.death_year is not null then 'nam' end),
    f.death_year, f.death_month, f.death_day, coalesce(f.death_leap, false), coalesce(f.death_approx, false),
    f.death_solar_date,
    f.anniversary_day, f.anniversary_month, coalesce(f.anniversary_manual, false),
    f.burial_place, f.burial_map_url, f.worship_place, f.worship_keeper_id
  )
  returning id into new_id;
  return new_id;
end;
$function$;

-- private.is_approved()  [anon: không, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION private.is_approved()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select coalesce((select approved from public.account_approvals where account_id = auth.uid()), false) $function$;

-- private.is_root_superadmin()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.is_root_superadmin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.is_superadmin()
    and coalesce((select lower(email) = private.root_superadmin_email() from public.account_approvals where account_id = auth.uid()), false)
$function$;

-- private.is_superadmin()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.is_superadmin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select is_superadmin and approved from public.account_approvals where account_id = auth.uid()), false)
$function$;

-- private.keep_person_creator()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.keep_person_creator()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.created_by := old.created_by;
  return new;
end;
$function$;

-- private.lock_person_photo()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.lock_person_photo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if coalesce(current_setting('app.merging_persons', true), '') = 'on' then
    return new;
  end if;
  if new.person_id <> old.person_id or new.tree_id <> old.tree_id then
    raise exception 'PHOTO_IMMUTABLE' using errcode = 'check_violation';
  end if;
  if split_part(new.storage_path, '/', 1) <> new.tree_id::text then
    raise exception 'PHOTO_PATH_INVALID' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

-- private.mark_first_progenitor()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.mark_first_progenitor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (select 1 from public.persons where tree_id = new.tree_id and is_progenitor) then
    new.is_progenitor := true;
  end if;
  return new;
end;
$function$;

-- private.new_account_approval()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.new_account_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  is_root constant boolean := lower(coalesce(new.email, '')) = private.root_superadmin_email();
  meta constant jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name_text constant text := btrim(coalesce(meta ->> 'full_name', ''));
  phone_text constant text := btrim(coalesce(meta ->> 'phone', ''));
  birth constant date := private.validate_profile(name_text, btrim(coalesce(meta ->> 'birth_date', '')), phone_text);
begin
  insert into public.account_approvals (account_id, email, approved, is_superadmin, approved_at, full_name, birth_date, phone)
  values (new.id, new.email, is_root, is_root, case when is_root then now() end, name_text, birth, phone_text);

  insert into public.tree_roles (tree_id, account_id, role, invited_by)
  select i.tree_id, new.id, i.role, i.invited_by from public.tree_pending_invites i where i.email = lower(coalesce(new.email, ''))
  on conflict (tree_id, account_id) do nothing;
  delete from public.tree_pending_invites where email = lower(coalesce(new.email, ''));
  return new;
end;
$function$;

-- private.root_superadmin_email()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.root_superadmin_email()
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select 'trungpham168@gmail.com'::text $function$;

-- private.stamp_approval()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.stamp_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.approved_at := case when new.approved then coalesce(old.approved_at, now()) else null end;
  return new;
end;
$function$;

-- private.sync_avatar_path()  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.sync_avatar_path()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  affected uuid := coalesce(new.person_id, old.person_id);
begin
  update public.persons
  set avatar_path = (select storage_path from public.person_photos where person_id = affected and is_avatar limit 1)
  where id = affected;
  return null;
end;
$function$;

-- private.tree_of(target_person uuid)  [anon: không, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION private.tree_of(target_person uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  found uuid;
begin
  select tree_id into found from public.persons where id = target_person;
  if found is null then
    raise exception 'PERSON_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  return found;
end;
$function$;

-- private.tree_role(target_tree uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION private.tree_role(target_tree uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select role from public.tree_roles
  where tree_id = target_tree and account_id = auth.uid() and private.is_approved()
$function$;

-- private.validate_profile(name_text text, birth_text text, phone_text text)  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.validate_profile(name_text text, birth_text text, phone_text text)
 RETURNS date
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  birth date;
begin
  if coalesce(name_text, '') = '' or coalesce(phone_text, '') = '' or coalesce(birth_text, '') = '' then
    raise exception 'PROFILE_REQUIRED'
      using detail = 'Cần nhập họ và tên, ngày sinh và số điện thoại.', errcode = 'check_violation';
  end if;
  begin
    birth := birth_text::date;
  exception when others then
    raise exception 'PROFILE_INVALID' using detail = 'Ngày sinh không hợp lệ.', errcode = 'check_violation';
  end;
  if birth < date '1900-01-01' or birth > current_date then
    raise exception 'PROFILE_INVALID' using detail = 'Ngày sinh không hợp lệ.', errcode = 'check_violation';
  end if;
  if char_length(name_text) > 120 then
    raise exception 'PROFILE_INVALID' using detail = 'Họ và tên tối đa 120 ký tự.', errcode = 'check_violation';
  end if;
  if phone_text !~ '^[0-9+(). -]{8,20}$' or char_length(regexp_replace(phone_text, '[^0-9]', '', 'g')) < 8 then
    raise exception 'PROFILE_INVALID' using detail = 'Số điện thoại không hợp lệ.', errcode = 'check_violation';
  end if;
  return birth;
end;
$function$;

-- private.write_profile(target_account uuid, new_name text, new_birth text, new_phone text)  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION private.write_profile(target_account uuid, new_name text, new_birth text, new_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  name_text constant text := btrim(coalesce(new_name, ''));
  phone_text constant text := btrim(coalesce(new_phone, ''));
  birth constant date := private.validate_profile(name_text, btrim(coalesce(new_birth, '')), phone_text);
begin
  update public.account_approvals set full_name = name_text, birth_date = birth, phone = phone_text where account_id = target_account;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$function$;

-- public.add_child(parent_id uuid, other_parent_id uuid, link_kind text, person jsonb)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.add_child(parent_id uuid, other_parent_id uuid, link_kind text, person jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_tree uuid := private.tree_of(add_child.parent_id);
  new_id uuid;
begin
  new_id := private.insert_person(target_tree, person);

  -- Không ghi Thứ tự con thì xếp sau các anh chị em hiện có.
  update public.persons set birth_order = (
    select coalesce(max(sibling.birth_order), 0) + 1
    from public.parent_links l join public.persons sibling on sibling.id = l.child_id
    where l.parent_id = add_child.parent_id and sibling.id <> new_id
  )
  where id = new_id and birth_order is null;

  insert into public.parent_links (child_id, parent_id, kind) values (new_id, add_child.parent_id, link_kind);
  if other_parent_id is not null then
    insert into public.parent_links (child_id, parent_id, kind) values (new_id, other_parent_id, link_kind);
  end if;
  return new_id;
end;
$function$;

-- public.add_parent(child_id uuid, link_kind text, person jsonb)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.add_parent(child_id uuid, link_kind text, person jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_tree uuid := private.tree_of(add_parent.child_id);
  new_id uuid;
  existing_parent uuid;
  child_was_progenitor boolean;
begin
  select is_progenitor into child_was_progenitor from public.persons where id = add_parent.child_id;
  new_id := private.insert_person(target_tree, person);

  -- Thêm cha/mẹ cho Thuỷ tổ: người mới trở thành Thuỷ tổ.
  if child_was_progenitor then
    update public.persons set is_progenitor = false where id = add_parent.child_id;
    update public.persons set is_progenitor = true where id = new_id;
  end if;

  -- Cha mẹ ruột của cùng một người con là vợ chồng của nhau.
  if link_kind = 'ruot' then
    for existing_parent in
      select l.parent_id from public.parent_links l where l.child_id = add_parent.child_id and l.kind = 'ruot'
    loop
      if not exists (
        select 1 from public.unions u
        where least(u.partner_a, u.partner_b) = least(existing_parent, new_id)
          and greatest(u.partner_a, u.partner_b) = greatest(existing_parent, new_id)
      ) then
        insert into public.unions (partner_a, partner_b, order_for_a, order_for_b)
        values (
          existing_parent,
          new_id,
          (select count(*) + 1 from public.unions u where existing_parent in (u.partner_a, u.partner_b)),
          1
        );
      end if;
    end loop;
  end if;

  insert into public.parent_links (child_id, parent_id, kind) values (add_parent.child_id, new_id, link_kind);
  return new_id;
end;
$function$;

-- public.add_spouse(person_id uuid, union_order integer, person jsonb)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.add_spouse(person_id uuid, union_order integer, person jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_tree uuid := private.tree_of(add_spouse.person_id);
  new_id uuid;
  next_order integer;
begin
  select count(*) + 1 into next_order from public.unions u
  where add_spouse.person_id in (u.partner_a, u.partner_b);

  new_id := private.insert_person(target_tree, person);
  insert into public.unions (partner_a, partner_b, order_for_a, order_for_b)
  values (add_spouse.person_id, new_id, coalesce(union_order, next_order), 1);
  return new_id;
end;
$function$;

-- public.admin_account_counts()  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.admin_account_counts()
 RETURNS TABLE(total_count integer, pending_count integer, i_am_root boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select count(*)::integer, (count(*) filter (where not a.approved))::integer, private.is_root_superadmin()
    from public.account_approvals a;
end;
$function$;

-- public.admin_delete_account(target_account uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.admin_delete_account(target_account uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target public.account_approvals;
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.account_approvals where account_id = target_account;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if target.is_superadmin then
    raise exception 'SUPERADMIN_PROTECTED' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.family_trees where owner_id = target_account) then
    raise exception 'ACCOUNT_OWNS_TREES' using errcode = 'check_violation';
  end if;
  delete from auth.users where id = target_account;
end;
$function$;

-- public.admin_list_accounts(status_filter text, search text, page_size integer, page_offset integer)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.admin_list_accounts(status_filter text DEFAULT 'all'::text, search text DEFAULT ''::text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS TABLE(account_id uuid, email text, full_name text, birth_date date, phone text, approved boolean, is_superadmin boolean, is_root boolean, created_at timestamp with time zone, approved_at timestamp with time zone, last_sign_in_at timestamp with time zone, tree_count integer, is_banned boolean, invited_by jsonb, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  needle constant text := lower(btrim(coalesce(search, '')));
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select a.account_id, a.email, a.full_name, a.birth_date, a.phone, a.approved, a.is_superadmin,
           lower(coalesce(a.email, '')) = private.root_superadmin_email(),
           a.created_at, a.approved_at, u.last_sign_in_at,
           (select count(*)::integer from public.family_trees t where t.owner_id = a.account_id),
           coalesce(u.banned_until > now(), false),
           (select coalesce(jsonb_agg(x.who order by x.first_at), '[]'::jsonb)
              from (select jsonb_build_object('account_id', r.invited_by, 'email', ia.email, 'full_name', ia.full_name) as who,
                           min(r.created_at) as first_at
                      from public.tree_roles r
                      join public.account_approvals ia on ia.account_id = r.invited_by
                     where r.account_id = a.account_id and r.invited_by is not null
                     group by r.invited_by, ia.email, ia.full_name) x),
           count(*) over ()
    from public.account_approvals a
    left join auth.users u on u.id = a.account_id
    where (status_filter = 'all' or (status_filter = 'pending' and not a.approved) or (status_filter = 'approved' and a.approved))
      and (needle = ''
           or position(needle in lower(coalesce(a.email, ''))) > 0
           or position(needle in lower(coalesce(a.full_name, ''))) > 0
           or position(needle in coalesce(a.phone, '')) > 0)
    order by a.approved, a.created_at desc, a.account_id
    limit least(greatest(coalesce(page_size, 20), 1), 100)
    offset greatest(coalesce(page_offset, 0), 0);
end;
$function$;

-- public.admin_set_approval(target_account uuid, new_approved boolean)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.admin_set_approval(target_account uuid, new_approved boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target public.account_approvals;
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.account_approvals where account_id = target_account;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if target.is_superadmin and not new_approved then
    raise exception 'SUPERADMIN_PROTECTED' using errcode = 'check_violation';
  end if;
  if new_approved and exists (select 1 from auth.users where id = target_account and banned_until > now()) then
    raise exception 'ACCOUNT_BANNED' using errcode = 'check_violation';
  end if;
  update public.account_approvals set approved = new_approved where account_id = target_account;
end;
$function$;

-- public.admin_set_banned(target_account uuid, new_banned boolean)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.admin_set_banned(target_account uuid, new_banned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target public.account_approvals;
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.account_approvals where account_id = target_account;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if target.is_superadmin then
    raise exception 'SUPERADMIN_PROTECTED' using errcode = 'check_violation';
  end if;
  update auth.users set banned_until = case when new_banned then 'infinity'::timestamptz end where id = target_account;
  if new_banned then
    update public.account_approvals set approved = false where account_id = target_account;
  end if;
end;
$function$;

-- public.admin_set_superadmin(target_account uuid, make_superadmin boolean)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.admin_set_superadmin(target_account uuid, make_superadmin boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target public.account_approvals;
begin
  if not private.is_root_superadmin() then
    raise exception 'ROOT_ONLY' using errcode = 'insufficient_privilege';
  end if;
  select * into target from public.account_approvals where account_id = target_account;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if not make_superadmin and lower(coalesce(target.email, '')) = private.root_superadmin_email() then
    raise exception 'SUPERADMIN_PROTECTED' using errcode = 'check_violation';
  end if;
  update public.account_approvals
    set is_superadmin = make_superadmin, approved = approved or make_superadmin
    where account_id = target_account;
end;
$function$;

-- public.admin_update_profile(target_account uuid, new_name text, new_birth text, new_phone text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.admin_update_profile(target_account uuid, new_name text, new_birth text, new_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  perform private.write_profile(target_account, new_name, new_birth, new_phone);
end;
$function$;

-- public.approve_delete_person(target_person uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.approve_delete_person(target_person uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_tree uuid := private.tree_of(approve_delete_person.target_person);
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  delete from public.persons where id = approve_delete_person.target_person;
end;
$function$;

-- public.calendar_feed(token text)  [anon: có, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.calendar_feed(token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select public_share.calendar_feed(token) $function$;

-- public.can_edit_event(target_event uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.can_edit_event(target_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.can_edit_event(target_event) $function$;

-- public.can_edit_person(target_person uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.can_edit_person(target_person uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.can_edit_person(target_person) $function$;

-- public.can_edit_tree(target_tree uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.can_edit_tree(target_tree uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select coalesce(private.tree_role(target_tree) in ('owner', 'editor'), false) $function$;

-- public.can_view_tree(target_tree uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.can_view_tree(target_tree uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select private.tree_role(target_tree) is not null $function$;

-- public.cancel_tree_invitation(target_tree uuid, invite_email text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.cancel_tree_invitation(target_tree uuid, invite_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  delete from public.tree_pending_invites where tree_id = target_tree and email = lower(btrim(coalesce(invite_email, '')));
end;
$function$;

-- public.claim_invitation_email(target_tree uuid, invite_email text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.claim_invitation_email(target_tree uuid, invite_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.tree_pending_invites set emailed_at = now()
  where tree_id = target_tree and email = lower(btrim(coalesce(invite_email, '')))
    and (emailed_at is null or emailed_at < now() - interval '1 minute');
  return found;
end;
$function$;

-- public.digest_recipients()  [anon: không, authenticated: không, service_role: có]
CREATE OR REPLACE FUNCTION public.digest_recipients()
 RETURNS TABLE(tree_id uuid, email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.tree_id, u.email::text
  from public.tree_roles r
  join auth.users u on u.id = r.account_id
  join public.account_approvals a on a.account_id = r.account_id and a.approved
  left join public.reminder_prefs p on p.account_id = r.account_id and p.tree_id = r.tree_id
  where r.role in ('owner', 'editor')
    and u.email is not null
    and coalesce(p.email_enabled, true)
$function$;

-- public.disable_calendar_feed()  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.disable_calendar_feed()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ delete from public.calendar_feeds where account_id = auth.uid() $function$;

-- public.disable_public_link(target_tree uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.disable_public_link(target_tree uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.family_trees set public_token = null, public_password_hash = null where id = target_tree;
end;
$function$;

-- public.import_into_tree(target_tree uuid, payload jsonb)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.import_into_tree(target_tree uuid, payload jsonb)
 RETURNS integer
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.import_people(target_tree, payload) $function$;

-- public.import_new_tree(tree_name text, payload jsonb)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.import_new_tree(tree_name text, payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  new_tree uuid;
begin
  insert into public.family_trees (name) values (tree_name) returning id into new_tree;
  perform private.import_people(new_tree, payload);
  return new_tree;
end;
$function$;

-- public.invite_to_tree(target_tree uuid, invite_email text, new_role text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.invite_to_tree(target_tree uuid, invite_email text, new_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  address constant text := lower(btrim(coalesce(invite_email, '')));
  invitee uuid;
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if new_role not in ('editor', 'viewer') then
    raise exception 'INVALID_ROLE' using errcode = 'check_violation';
  end if;
  if address !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(address) > 254 then
    raise exception 'INVALID_EMAIL' using errcode = 'check_violation';
  end if;

  invitee := private.account_id_by_email(address);
  if invitee is null then
    if not exists (select 1 from public.tree_pending_invites where tree_id = target_tree and email = address)
       and (select count(*) from public.tree_pending_invites where tree_id = target_tree) >= 50 then
      raise exception 'TOO_MANY_INVITATIONS' using errcode = 'check_violation';
    end if;
    insert into public.tree_pending_invites (tree_id, email, role, invited_by) values (target_tree, address, new_role, auth.uid())
      on conflict (tree_id, email) do update set role = excluded.role;
    return 'pending';
  end if;

  if exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = invitee and role = 'owner') then
    raise exception 'ALREADY_OWNER' using errcode = 'check_violation';
  end if;
  insert into public.tree_roles (tree_id, account_id, role, invited_by) values (target_tree, invitee, new_role, auth.uid())
    on conflict (tree_id, account_id) do update set role = excluded.role;
  return 'added';
end;
$function$;

-- public.is_tree_owner(target_tree uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.is_tree_owner(target_tree uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select coalesce(private.tree_role(target_tree) = 'owner', false) $function$;

-- public.link_account_to_person(target_tree uuid, person_id uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.link_account_to_person(target_tree uuid, person_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.tree_role(target_tree) is null then
    raise exception 'NOT_TREE_MEMBER' using errcode = 'check_violation';
  end if;
  update public.tree_roles set linked_person_id = link_account_to_person.person_id
  where tree_id = target_tree and account_id = auth.uid();
end;
$function$;

-- public.link_co_parent(parent_id uuid, co_parent_id uuid, child_ids uuid[])  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.link_co_parent(parent_id uuid, co_parent_id uuid, child_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

-- public.link_parent(child_id uuid, parent_id uuid, link_kind text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.link_parent(child_id uuid, parent_id uuid, link_kind text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  existing_parent uuid;
  child_was_progenitor boolean;
begin
  -- Báo PERSON_NOT_FOUND nếu một trong hai không tồn tại hoặc không xem được.
  perform private.tree_of(link_parent.child_id);
  perform private.tree_of(link_parent.parent_id);
  select is_progenitor into child_was_progenitor from public.persons where id = link_parent.child_id;

  insert into public.parent_links (child_id, parent_id, kind)
  values (link_parent.child_id, link_parent.parent_id, link_kind);

  -- Gắn cha/mẹ cho Thuỷ tổ thì Thuỷ tổ chuyển lên người cha/mẹ (giống add_parent).
  if child_was_progenitor then
    update public.persons set is_progenitor = false where id = link_parent.child_id;
    update public.persons set is_progenitor = true where id = link_parent.parent_id;
  end if;

  -- Cha mẹ ruột của cùng một người con là vợ chồng của nhau.
  if link_kind = 'ruot' then
    for existing_parent in
      select l.parent_id from public.parent_links l
      where l.child_id = link_parent.child_id and l.kind = 'ruot' and l.parent_id <> link_parent.parent_id
    loop
      perform private.ensure_union(existing_parent, link_parent.parent_id);
    end loop;
  end if;
end;
$function$;

-- public.link_spouse(person_id uuid, spouse_id uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.link_spouse(person_id uuid, spouse_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform private.tree_of(link_spouse.person_id);
  perform private.tree_of(link_spouse.spouse_id);
  perform private.ensure_union(link_spouse.person_id, link_spouse.spouse_id);
end;
$function$;

-- public.list_pending_deletions(target_tree uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.list_pending_deletions(target_tree uuid)
 RETURNS TABLE(person_id uuid, full_name text, requested_by_email text, requested_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select p.id, p.full_name, private.account_email(p.pending_delete_by), p.pending_delete_at
    from public.persons p
    where p.tree_id = target_tree and p.pending_delete_by is not null
    order by p.pending_delete_at;
end;
$function$;

-- public.list_tree_invitations(target_tree uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.list_tree_invitations(target_tree uuid)
 RETURNS TABLE(email text, role text, created_at timestamp with time zone, emailed_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select i.email, i.role, i.created_at, i.emailed_at from public.tree_pending_invites i where i.tree_id = target_tree order by i.created_at, i.email;
end;
$function$;

-- public.list_tree_members(target_tree uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.list_tree_members(target_tree uuid)
 RETURNS TABLE(account_id uuid, role text, email text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.can_view_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;

  return query
    select r.account_id, r.role, private.account_email(r.account_id), r.created_at
    from public.tree_roles r
    where r.tree_id = target_tree
    order by (r.role = 'owner') desc, r.created_at;
end;
$function$;

-- public.merge_persons(keep_person uuid, drop_person uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.merge_persons(keep_person uuid, drop_person uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- public.merge_persons_group(keep_person uuid, drop_persons uuid[])  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.merge_persons_group(keep_person uuid, drop_persons uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  dropped uuid;
begin
  foreach dropped in array coalesce(drop_persons, '{}') loop
    perform public.merge_persons(merge_persons_group.keep_person, dropped);
  end loop;
end;
$function$;

-- public.my_calendar_feed()  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.my_calendar_feed()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select token from public.calendar_feeds where account_id = auth.uid() $function$;

-- public.public_tree(token text, password text)  [anon: có, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.public_tree(token text, password text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select public_share.public_tree(token, password) $function$;

-- public.public_tree_card(token text)  [anon: có, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.public_tree_card(token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select public_share.public_tree_card(token) $function$;

-- public.reject_delete_person(target_person uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.reject_delete_person(target_person uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_tree uuid := private.tree_of(reject_delete_person.target_person);
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.persons set pending_delete_by = null, pending_delete_at = null
  where id = reject_delete_person.target_person;
end;
$function$;

-- public.release_invitation_email(target_tree uuid, invite_email text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.release_invitation_email(target_tree uuid, invite_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.tree_pending_invites set emailed_at = null
  where tree_id = target_tree and email = lower(btrim(coalesce(invite_email, '')));
end;
$function$;

-- public.remove_tree_role(target_tree uuid, target_account uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.remove_tree_role(target_tree uuid, target_account uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = target_account and role = 'owner') then
    raise exception 'CANNOT_CHANGE_OWNER' using errcode = 'check_violation';
  end if;

  delete from public.tree_roles where tree_id = target_tree and account_id = target_account;
end;
$function$;

-- public.reorder_children(ordered_ids uuid[])  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.reorder_children(ordered_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_tree uuid;
  found_count integer;
begin
  if coalesce(array_length(ordered_ids, 1), 0) = 0 then
    return;
  end if;
  select tree_id into target_tree from public.persons where id = ordered_ids[1];
  if target_tree is null or not public.can_edit_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  select count(*) into found_count from public.persons where id = any (ordered_ids) and tree_id = target_tree;
  if found_count <> array_length(ordered_ids, 1) then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;

  update public.persons p set birth_order = least(o.position, 99)
  from unnest(ordered_ids) with ordinality as o(id, position)
  where p.id = o.id;
end;
$function$;

-- public.reorder_unions(viewer_id uuid, ordered_union_ids uuid[])  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.reorder_unions(viewer_id uuid, ordered_union_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

-- public.request_delete_person(target_person uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.request_delete_person(target_person uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_tree uuid := private.tree_of(request_delete_person.target_person);
begin
  if public.is_tree_owner(target_tree) then
    delete from public.persons where id = request_delete_person.target_person;
    return;
  end if;
  if not public.can_edit_tree(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.persons
  set pending_delete_by = auth.uid(), pending_delete_at = now()
  where id = request_delete_person.target_person and pending_delete_by is null;
end;
$function$;

-- public.rotate_calendar_feed()  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.rotate_calendar_feed()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  new_token text := replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null or not private.is_approved() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  insert into public.calendar_feeds (account_id, token) values (auth.uid(), new_token)
    on conflict (account_id) do update set token = excluded.token, created_at = now();
  return new_token;
end;
$function$;

-- public.rotate_public_link(target_tree uuid, password text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.rotate_public_link(target_tree uuid, password text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

-- public.set_avatar_photo(photo_id uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.set_avatar_photo(photo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_person uuid;
begin
  select person_id into target_person from public.person_photos where id = set_avatar_photo.photo_id;
  if target_person is null then
    raise exception 'PHOTO_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  update public.person_photos set is_avatar = false where person_id = target_person and is_avatar;
  update public.person_photos set is_avatar = true where id = set_avatar_photo.photo_id;
end;
$function$;

-- public.set_progenitor(person_id uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.set_progenitor(person_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_tree uuid := private.tree_of(set_progenitor.person_id);
begin
  update public.persons set is_progenitor = false where tree_id = target_tree and is_progenitor;
  update public.persons set is_progenitor = true where id = set_progenitor.person_id;
  if not found then
    raise exception 'PERSON_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$function$;

-- public.set_public_link_password(target_tree uuid, password text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.set_public_link_password(target_tree uuid, password text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

-- public.touch_updated_at()  [anon: có, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- public.transfer_tree_ownership(target_tree uuid, target_account uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.transfer_tree_ownership(target_tree uuid, target_account uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  max_trees integer := private.app_setting('max_trees_per_account');
begin
  -- Khoá dòng gia phả để hai lần chuyển cùng lúc không chen nhau.
  perform 1 from public.family_trees where id = target_tree for update;

  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = target_account and role = 'editor') then
    raise exception 'NEW_OWNER_NOT_EDITOR' using errcode = 'check_violation';
  end if;
  -- Tài khoản chưa duyệt hoặc bị chặn (chặn cũng bỏ duyệt) không vào được app: trao cho họ là gia phả mất Chủ sở hữu.
  if not coalesce((select approved from public.account_approvals where account_id = target_account), false) then
    raise exception 'NEW_OWNER_NOT_APPROVED' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.family_trees where owner_id = target_account) >= max_trees then
    raise exception 'NEW_OWNER_TREE_LIMIT'
      using detail = format('Mỗi tài khoản sở hữu tối đa %s gia phả.', max_trees), errcode = 'check_violation';
  end if;

  -- Hạ Chủ sở hữu cũ trước: mỗi gia phả chỉ có một dòng 'owner' (tree_roles_one_owner).
  update public.tree_roles set role = 'editor' where tree_id = target_tree and role = 'owner';
  update public.tree_roles set role = 'owner' where tree_id = target_tree and account_id = target_account;
  update public.family_trees set owner_id = target_account where id = target_tree;
end;
$function$;

-- public.tree_positions(target_tree uuid)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.tree_positions(target_tree uuid)
 RETURNS TABLE(person_id uuid, generation integer, branch_id uuid, kind text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with recursive descent (id, gen, branch, path) as (
    select p.id, 1, null::uuid, array[p.id]
    from public.persons p
    where p.tree_id = target_tree and p.is_progenitor
    union all
    select l.child_id,
           d.gen + 1,
           case when c.founds_branch then l.child_id else d.branch end,
           d.path || l.child_id
    from descent d
    join public.parent_links l on l.parent_id = d.id
    join public.persons c on c.id = l.child_id
    where not l.child_id = any (d.path) and d.gen < 500
  ),
  blood as (
    select distinct on (id) id, gen, branch from descent order by id, gen
  ),
  in_laws as (
    select distinct on (spouse.id) spouse.id, b.gen, b.branch
    from blood b
    join public.unions u on b.id in (u.partner_a, u.partner_b)
    cross join lateral (select case when u.partner_a = b.id then u.partner_b else u.partner_a end as id) spouse
    where not exists (select 1 from blood other where other.id = spouse.id)
    order by spouse.id, b.gen
  )
  select p.id,
         coalesce(b.gen, i.gen),
         coalesce(b.branch, i.branch),
         case
           when p.is_progenitor then 'thuy_to'
           when b.id is not null then 'dinh'
           when i.id is not null then 'dau_re'
           else 'chua_noi'
         end
  from public.persons p
  left join blood b on b.id = p.id
  left join in_laws i on i.id = p.id
  where p.tree_id = target_tree
$function$;

-- public.update_my_profile(new_name text, new_birth text, new_phone text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.update_my_profile(new_name text, new_birth text, new_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  perform private.write_profile(auth.uid(), new_name, new_birth, new_phone);
end;
$function$;

-- public.update_tree_role(target_tree uuid, target_account uuid, new_role text)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.update_tree_role(target_tree uuid, target_account uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  if new_role not in ('editor', 'viewer') then
    raise exception 'INVALID_ROLE' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.tree_roles where tree_id = target_tree and account_id = target_account and role = 'owner') then
    raise exception 'CANNOT_CHANGE_OWNER' using errcode = 'check_violation';
  end if;

  update public.tree_roles set role = new_role where tree_id = target_tree and account_id = target_account;
end;
$function$;

-- public.update_union(target_union uuid, viewer uuid, new_order integer, new_status text, set_marriage boolean, new_marriage_year smallint, new_marriage_month smallint, new_marriage_day smallint)  [anon: không, authenticated: có, service_role: có]
CREATE OR REPLACE FUNCTION public.update_union(target_union uuid, viewer uuid, new_order integer DEFAULT NULL::integer, new_status text DEFAULT NULL::text, set_marriage boolean DEFAULT false, new_marriage_year smallint DEFAULT NULL::smallint, new_marriage_month smallint DEFAULT NULL::smallint, new_marriage_day smallint DEFAULT NULL::smallint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$;

-- public_share.calendar_feed(token text)  [anon: có, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION public_share.calendar_feed(token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  account uuid;
begin
  if token is null or token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select f.account_id into account from public.calendar_feeds f where f.token = calendar_feed.token;
  if account is null or not coalesce(
    (select a.approved from public.account_approvals a where a.account_id = account), false
  ) then
    return null;
  end if;

  return (
    with my_trees as (
      select t.id, t.name from public.family_trees t
      join public.tree_roles r on r.tree_id = t.id and r.account_id = account
    )
    select jsonb_build_object(
      'trees', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name)) from my_trees), '[]'::jsonb),
      'persons', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'tree_id', p.tree_id, 'full_name', p.full_name, 'is_deceased', p.is_deceased,
          'anniversary_day', p.anniversary_day, 'anniversary_month', p.anniversary_month,
          'birth_solar_date', p.birth_solar_date, 'death_solar_date', p.death_solar_date))
        from public.persons p
        where p.tree_id in (select id from my_trees)
          and (p.is_deceased or p.birth_solar_date is not null)
      ), '[]'::jsonb),
      'events', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id, 'tree_id', e.tree_id, 'title', e.title, 'calendar', e.calendar,
          'repeats_yearly', e.repeats_yearly, 'repeats_monthly', e.repeats_monthly, 'year', e.year, 'month', e.month, 'day', e.day,
          'leap', e.leap, 'start_time', e.start_time, 'location', e.location))
        from public.tree_events e where e.tree_id in (select id from my_trees)
      ), '[]'::jsonb),
      'marriages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', u.id, 'tree_id', u.tree_id, 'partner_a', u.partner_a,
          'names', a.full_name || ' & ' || b.full_name,
          'marriage_year', u.marriage_year, 'marriage_month', u.marriage_month, 'marriage_day', u.marriage_day))
        from public.unions u
        join public.persons a on a.id = u.partner_a
        join public.persons b on b.id = u.partner_b
        where u.tree_id in (select id from my_trees) and u.marriage_day is not null and u.status <> 'ly_hon'
      ), '[]'::jsonb)
    )
  );
end;
$function$;

-- public_share.public_tree(token text, password text)  [anon: có, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION public_share.public_tree(token text, password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- public_share.public_tree_card(token text)  [anon: có, authenticated: có, service_role: không]
CREATE OR REPLACE FUNCTION public_share.public_tree_card(token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'name', t.name,
    'description', t.description,
    'persons', (select count(*) from public.persons p where p.tree_id = t.id and not p.hidden_from_public)
  )
  from public.family_trees t
  where token ~ '^[0-9a-f]{32}$' and t.public_token = token
$function$;

-- public_share.public_tree_unthrottled(token text, password text)  [anon: không, authenticated: không, service_role: không]
CREATE OR REPLACE FUNCTION public_share.public_tree_unthrottled(token text, password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
