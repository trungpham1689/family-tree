-- Ticket 05: hồ sơ Người đầy đủ.
-- Ngày sinh/mất là "Ngày không đầy đủ" (CONTEXT.md): năm + độ chính xác (năm / tháng / ngày)
-- + lịch (dương / âm) + cờ nhuận + cờ "khoảng". Các cột *_solar_date và ngày giỗ do ứng dụng
-- tính bằng gói âm lịch rồi ghi vào, vì Postgres không có lịch âm.

alter table public.persons
  -- Định danh
  add column common_name text check (length(common_name) <= 200),
  add column taboo_name text check (length(taboo_name) <= 200),
  add column courtesy_name text check (length(courtesy_name) <= 200),
  add column han_name text check (length(han_name) <= 200),
  -- Sinh
  add column birth_calendar text not null default 'duong' check (birth_calendar in ('duong', 'am')),
  add column birth_precision text check (birth_precision in ('nam', 'thang', 'ngay')),
  add column birth_month smallint check (birth_month between 1 and 12),
  add column birth_day smallint check (birth_day between 1 and 31),
  add column birth_leap boolean not null default false,
  add column birth_approx boolean not null default false,
  add column birth_solar_date date,
  add column birth_place text check (length(birth_place) <= 300),
  -- Đời sống
  add column hometown text check (length(hometown) <= 300),
  add column residence text check (length(residence) <= 300),
  add column occupation text check (length(occupation) <= 200),
  add column education text check (length(education) <= 200),
  add column title text check (length(title) <= 300),
  add column phone text check (length(phone) <= 50),
  add column email text check (length(email) <= 200),
  add column biography text check (length(biography) <= 20000),
  add column role_note text check (length(role_note) <= 200),
  -- Mất & thờ cúng
  add column death_calendar text not null default 'duong' check (death_calendar in ('duong', 'am')),
  add column death_precision text check (death_precision in ('nam', 'thang', 'ngay')),
  add column death_month smallint check (death_month between 1 and 12),
  add column death_day smallint check (death_day between 1 and 31),
  add column death_leap boolean not null default false,
  add column death_approx boolean not null default false,
  add column death_solar_date date,
  add column anniversary_day smallint check (anniversary_day between 1 and 30),
  add column anniversary_month smallint check (anniversary_month between 1 and 12),
  add column anniversary_manual boolean not null default false,
  add column burial_place text check (length(burial_place) <= 500),
  add column burial_map_url text check (burial_map_url ~ '^https://' and length(burial_map_url) <= 1000),
  add column worship_place text check (length(worship_place) <= 300),
  add column worship_keeper text check (length(worship_keeper) <= 200);

-- Dữ liệu cũ chỉ có năm.
update public.persons set birth_precision = 'nam' where birth_year is not null and birth_precision is null;
update public.persons set death_precision = 'nam' where death_year is not null and death_precision is null;

alter table public.persons
  add constraint persons_birth_precision_matches check (
    (birth_year is null and birth_precision is null and birth_month is null and birth_day is null)
    or (birth_precision = 'nam' and birth_month is null and birth_day is null)
    or (birth_precision = 'thang' and birth_month is not null and birth_day is null)
    or (birth_precision = 'ngay' and birth_month is not null and birth_day is not null)
  ),
  add constraint persons_birth_year_required check (birth_precision is null or birth_year is not null),
  add constraint persons_birth_leap_lunar_only check (not birth_leap or birth_calendar = 'am'),
  add constraint persons_death_precision_matches check (
    (death_year is null and death_precision is null and death_month is null and death_day is null)
    or (death_precision = 'nam' and death_month is null and death_day is null)
    or (death_precision = 'thang' and death_month is not null and death_day is null)
    or (death_precision = 'ngay' and death_month is not null and death_day is not null)
  ),
  add constraint persons_death_year_required check (death_precision is null or death_year is not null),
  add constraint persons_death_leap_lunar_only check (not death_leap or death_calendar = 'am'),
  add constraint persons_anniversary_complete check ((anniversary_day is null) = (anniversary_month is null)),
  add constraint persons_birth_year_has_precision check ((birth_year is null) = (birth_precision is null)),
  add constraint persons_death_year_has_precision check ((death_year is null) = (death_precision is null));

-- Chỉ ghi năm (cách nhập cũ, hoặc nhập nhanh) thì độ chính xác là "năm".
create function private.default_date_precision() returns trigger
language plpgsql set search_path = ''
as $$
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
$$;

create trigger persons_default_date_precision before insert or update on public.persons
  for each row execute function private.default_date_precision();

revoke execute on function private.default_date_precision() from public, anon, authenticated;

-- Các thao tác thêm quan hệ nhận đủ trường hồ sơ; bỏ qua id, tree_id và các cờ hệ thống.
create or replace function private.insert_person(target_tree uuid, data jsonb) returns uuid
language plpgsql set search_path = ''
as $$
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
    burial_place, burial_map_url, worship_place, worship_keeper
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
    f.burial_place, f.burial_map_url, f.worship_place, f.worship_keeper
  )
  returning id into new_id;
  return new_id;
end;
$$;
