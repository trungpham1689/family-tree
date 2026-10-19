-- Người phụ trách cúng giỗ là một Người trong gia phả (tìm & chọn), không còn gõ tay tên.
-- Giữ cột worship_keeper (chữ) cũ để không mất dữ liệu đã nhập trước đây; chỉ không còn ghi vào nữa.

alter table public.persons
  add column worship_keeper_id uuid references public.persons(id) on delete set null;

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
$$;
