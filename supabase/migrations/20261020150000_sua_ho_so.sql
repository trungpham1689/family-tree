-- Sửa hồ sơ (họ tên, ngày sinh, số điện thoại): người dùng sửa của mình, siêu quản trị sửa của bất kỳ ai.
-- Quy tắc kiểm tra tách ra private.validate_profile để trigger đăng ký và hai hàm sửa dùng chung một chỗ.

create function private.validate_profile(name_text text, birth_text text, phone_text text) returns date
language plpgsql stable set search_path = ''
as $$
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
$$;

create or replace function private.new_account_approval() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  is_root constant boolean := lower(coalesce(new.email, '')) = private.root_superadmin_email();
  meta constant jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name_text constant text := btrim(coalesce(meta ->> 'full_name', ''));
  phone_text constant text := btrim(coalesce(meta ->> 'phone', ''));
  birth constant date := private.validate_profile(name_text, btrim(coalesce(meta ->> 'birth_date', '')), phone_text);
begin
  insert into public.account_approvals (account_id, email, approved, is_superadmin, approved_at, full_name, birth_date, phone)
  values (new.id, new.email, is_root, is_root, case when is_root then now() end, name_text, birth, phone_text);
  return new;
end;
$$;

create function private.write_profile(target_account uuid, new_name text, new_birth text, new_phone text) returns void
language plpgsql security definer set search_path = ''
as $$
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
$$;

create function public.update_my_profile(new_name text, new_birth text, new_phone text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  perform private.write_profile(auth.uid(), new_name, new_birth, new_phone);
end;
$$;

create function public.admin_update_profile(target_account uuid, new_name text, new_birth text, new_phone text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_superadmin() then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  perform private.write_profile(target_account, new_name, new_birth, new_phone);
end;
$$;

revoke execute on function private.validate_profile(text, text, text), private.write_profile(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.update_my_profile(text, text, text), public.admin_update_profile(uuid, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text), public.admin_update_profile(uuid, text, text, text) to authenticated;
