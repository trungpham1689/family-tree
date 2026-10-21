-- Duyệt tài khoản = người quản lý đã xem email đó và chấp nhận, nên không bắt người dùng xác nhận email nữa.
-- Trước đây project Supabase bật "Confirm email" thì tài khoản được duyệt vẫn không đăng nhập được (email_not_confirmed).
create function private.confirm_email_on_approval() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = new.account_id;
  return new;
end;
$$;

revoke execute on function private.confirm_email_on_approval() from public, anon, authenticated;

create trigger confirm_email_on_approval
  after insert or update of approved on public.account_approvals
  for each row when (new.approved)
  execute function private.confirm_email_on_approval();

-- Tài khoản đã duyệt từ trước mà còn kẹt chưa xác nhận email.
update auth.users u set email_confirmed_at = now()
  from public.account_approvals a
  where a.account_id = u.id and a.approved and u.email_confirmed_at is null;
