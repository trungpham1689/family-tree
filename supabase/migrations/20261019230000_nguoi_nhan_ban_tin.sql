-- Người nhận bản tin email nhắc nhở, tính trong database thay vì Worker tự ghép từ nhiều bảng + Admin API:
-- Chủ sở hữu và Biên tập viên đã được duyệt của mỗi gia phả, trừ ai đã tắt email ở gia phả đó (reminder_prefs.email_enabled).
-- Chỉ service_role (Worker Cron) gọi được; người dùng thường và khách không.
create function public.digest_recipients() returns table (tree_id uuid, email text)
language sql stable security definer set search_path = ''
as $$
  select r.tree_id, u.email::text
  from public.tree_roles r
  join auth.users u on u.id = r.account_id
  join public.account_approvals a on a.account_id = r.account_id and a.approved
  left join public.reminder_prefs p on p.account_id = r.account_id and p.tree_id = r.tree_id
  where r.role in ('owner', 'editor')
    and u.email is not null
    and coalesce(p.email_enabled, true)
$$;

revoke execute on function public.digest_recipients() from public, anon, authenticated;
grant execute on function public.digest_recipients() to service_role;
