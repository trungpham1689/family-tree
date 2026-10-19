-- Lịch đăng ký (.ics) cho điện thoại: mỗi tài khoản có một link bí mật riêng (token), dán vào
-- Google/Apple Calendar một lần là giỗ, sinh nhật, kỷ niệm cưới và sự kiện tự cập nhật.
-- App lịch không đăng nhập được nên đọc qua public_share.calendar_feed(token) — chỉ trả đúng
-- những gì lịch cần (tên + ngày) của các gia phả mà tài khoản đó có vai trò. Tạo lại link thì link cũ hết hiệu lực.

create table public.calendar_feeds (
  account_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-f]{32}$'),
  created_at timestamptz not null default now()
);

-- Không ai đọc/ghi trực tiếp qua API; mọi thứ đi qua các hàm bên dưới.
alter table public.calendar_feeds enable row level security;
revoke all on public.calendar_feeds from anon, authenticated;

create function public.rotate_calendar_feed() returns text
language plpgsql security definer set search_path = ''
as $$
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
$$;

create function public.my_calendar_feed() returns text
language sql stable security definer set search_path = ''
as $$ select token from public.calendar_feeds where account_id = auth.uid() $$;

create function public.disable_calendar_feed() returns void
language sql security definer set search_path = ''
as $$ delete from public.calendar_feeds where account_id = auth.uid() $$;

create function public_share.calendar_feed(token text) returns jsonb
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
          'birth_solar_date', p.birth_solar_date))
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

create function public.calendar_feed(token text) returns jsonb
language sql stable set search_path = '' as $$ select public_share.calendar_feed(token) $$;

revoke execute on function public.rotate_calendar_feed(), public.my_calendar_feed(), public.disable_calendar_feed() from public, anon;
grant execute on function public.rotate_calendar_feed(), public.my_calendar_feed(), public.disable_calendar_feed() to authenticated;
revoke execute on function public_share.calendar_feed(text), public.calendar_feed(text) from public;
grant execute on function public_share.calendar_feed(text), public.calendar_feed(text) to anon, authenticated;
