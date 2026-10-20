-- Gửi email cho lời mời chờ đăng ký (Pages Function /api/invite-email gửi qua Resend). Cột emailed_at ghi lần gửi gần nhất để chống gửi dồn:
-- hàm claim chỉ cho gửi khi chưa gửi hoặc đã quá 1 phút; gửi hỏng thì release để gửi lại được ngay.

alter table public.tree_pending_invites add column emailed_at timestamptz;

drop function public.list_tree_invitations(uuid);
create function public.list_tree_invitations(target_tree uuid)
returns table (email text, role text, created_at timestamptz, emailed_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  return query
    select i.email, i.role, i.created_at, i.emailed_at from public.tree_pending_invites i where i.tree_id = target_tree order by i.created_at, i.email;
end;
$$;

-- true: được phép gửi ngay bây giờ (đã đánh dấu đang gửi); false: không có lời mời này hoặc vừa gửi chưa đầy 1 phút.
create function public.claim_invitation_email(target_tree uuid, invite_email text) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.tree_pending_invites set emailed_at = now()
  where tree_id = target_tree and email = lower(btrim(coalesce(invite_email, '')))
    and (emailed_at is null or emailed_at < now() - interval '1 minute');
  return found;
end;
$$;

create function public.release_invitation_email(target_tree uuid, invite_email text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_tree_owner(target_tree) then
    raise exception 'NOT_ALLOWED' using errcode = 'insufficient_privilege';
  end if;
  update public.tree_pending_invites set emailed_at = null
  where tree_id = target_tree and email = lower(btrim(coalesce(invite_email, '')));
end;
$$;

revoke execute on function public.list_tree_invitations(uuid), public.claim_invitation_email(uuid, text), public.release_invitation_email(uuid, text)
  from public, anon;
grant execute on function public.list_tree_invitations(uuid), public.claim_invitation_email(uuid, text), public.release_invitation_email(uuid, text)
  to authenticated;
