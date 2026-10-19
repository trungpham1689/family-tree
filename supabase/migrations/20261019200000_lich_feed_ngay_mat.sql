-- Lịch đăng ký trả thêm death_solar_date cho Người đã mất, đúng bộ cột của CALENDAR_PERSON_COLUMNS
-- (packages/reminders/src/calendar-source.ts) mà web và Worker cùng đọc.
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
          'repeats_yearly', e.repeats_yearly, 'year', e.year, 'month', e.month, 'day', e.day,
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
