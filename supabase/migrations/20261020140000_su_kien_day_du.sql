-- Sự kiện đầy đủ: lặp hằng tháng, mô tả, người chủ trì, tối đa 5 ảnh, và chọn có đưa vào Phả ký / Dòng thời gian hay không.
--  * repeats_monthly: lặp mỗi tháng vào `day` (âm hoặc dương theo `calendar`); khi đó `month` không dùng (null) và không có tháng nhuận.
--    Sự kiện lặp (hằng năm / hằng tháng) có thể ghi `year` = năm bắt đầu; sự kiện một lần bắt buộc có `year`.
--  * Mô tả sự kiện dùng cột `note` sẵn có (giao diện gọi là "Mô tả").
--  * host_person_id: Người chủ trì, phải cùng gia phả.
--  * show_in_pha_ky / show_in_timeline: đưa vào Phả ký / Dòng thời gian. Dòng thời gian xếp theo năm nên cần `year`.
--  * event_photos: tối đa app_settings.max_photos_per_event (5) ảnh mỗi sự kiện; ảnh nằm trên Google Drive như ảnh Người
--    (đường dẫn "{tree_id}/{id file Drive}"); quyền sửa/xoá ảnh theo quyền sửa sự kiện (Chủ sở hữu, hoặc Biên tập viên đã tạo sự kiện).

alter table public.tree_events
  add column repeats_monthly boolean not null default false,
  add column host_person_id uuid references public.persons (id) on delete set null,
  add column show_in_pha_ky boolean not null default false,
  add column show_in_timeline boolean not null default false;

alter table public.tree_events alter column month drop not null;

-- Ràng buộc "một lần thì phải có năm" cũ chỉ biết hằng năm; thay bằng bộ ràng buộc có hằng tháng.
do $$
declare
  old_check record;
begin
  for old_check in
    select conname from pg_constraint
    where conrelid = 'public.tree_events'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%repeats_yearly%'
  loop
    execute format('alter table public.tree_events drop constraint %I', old_check.conname);
  end loop;
end;
$$;

alter table public.tree_events
  add constraint tree_events_once_has_year check (repeats_yearly or repeats_monthly or year is not null),
  add constraint tree_events_one_repeat check (not (repeats_yearly and repeats_monthly)),
  add constraint tree_events_month_unless_monthly check (repeats_monthly or month is not null),
  add constraint tree_events_monthly_no_leap check (not (repeats_monthly and leap)),
  add constraint tree_events_timeline_has_year check (not show_in_timeline or year is not null);

create index tree_events_host_idx on public.tree_events (host_person_id) where host_person_id is not null;

create function private.check_event_refs() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.host_person_id is not null
     and not exists (select 1 from public.persons where id = new.host_person_id and tree_id = new.tree_id) then
    raise exception 'EVENT_HOST_INVALID' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tree_events_check_refs before insert or update on public.tree_events
  for each row execute function private.check_event_refs();

-- ---------------------------------------------------------------------------
-- Ảnh sự kiện
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value) values ('max_photos_per_event', 5);

-- Chủ sở hữu, hoặc Biên tập viên đã tạo sự kiện đó (cùng luật với policy sửa sự kiện).
create function private.can_edit_event(target_event uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tree_events e
    where e.id = target_event
      and (private.tree_role(e.tree_id) = 'owner'
           or (private.tree_role(e.tree_id) = 'editor' and e.created_by = auth.uid()))
  )
$$;

-- Bản gọi được qua API cho Pages Function /api/photos: cùng một quy tắc với RLS của event_photos.
create function public.can_edit_event(target_event uuid) returns boolean
language sql stable set search_path = ''
as $$ select private.can_edit_event(target_event) $$;

create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  event_id uuid not null references public.tree_events (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index event_photos_event_idx on public.event_photos (event_id, created_at);
create index event_photos_tree_idx on public.event_photos (tree_id);

create function private.check_event_photo() returns trigger
language plpgsql security definer set search_path = ''
as $$
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
$$;

create trigger event_photos_check before insert on public.event_photos
  for each row execute function private.check_event_photo();

alter table public.event_photos enable row level security;
create policy "xem ảnh sự kiện trong gia phả mình có vai trò" on public.event_photos
  for select to authenticated using (public.can_view_tree(tree_id));
create policy "người sửa sự kiện thêm ảnh sự kiện" on public.event_photos
  for insert to authenticated with check (private.can_edit_event(event_id));
create policy "người sửa sự kiện xoá ảnh sự kiện" on public.event_photos
  for delete to authenticated using (private.can_edit_event(event_id));

revoke all on public.event_photos from anon;
revoke update on public.event_photos from authenticated;

revoke execute on function private.check_event_refs(), private.check_event_photo() from public, anon, authenticated;
revoke execute on function private.can_edit_event(uuid) from public, anon;
grant execute on function private.can_edit_event(uuid) to authenticated;
revoke execute on function public.can_edit_event(uuid) from public, anon;
grant execute on function public.can_edit_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Lịch đăng ký: thêm repeats_monthly cho sự kiện
-- ---------------------------------------------------------------------------
create or replace function public_share.calendar_feed(token text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
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
$$;
