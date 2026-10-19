-- Duyệt tài khoản: đăng ký xong chưa dùng được gì cho tới khi chủ hệ thống tích "approved" trong
-- Supabase (Table Editor → account_approvals). Chưa duyệt thì private.tree_role() trả null — mọi policy
-- RLS và hàm kiểm quyền đều đi qua nó nên tài khoản không thấy, không sửa được dữ liệu nào, kể cả khi
-- đã được mời vào gia phả — và không tạo được gia phả mới.

create table public.account_approvals (
  account_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Ghi lại thời điểm duyệt khi tích approved.
create function private.stamp_approval() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.approved_at := case when new.approved then coalesce(old.approved_at, now()) else null end;
  return new;
end;
$$;

create trigger account_approvals_stamp before update on public.account_approvals
  for each row execute function private.stamp_approval();

-- Tài khoản nào đã tồn tại trước khi có tính năng này thì coi như đã duyệt.
insert into public.account_approvals (account_id, email, approved, approved_at)
select id, email, true, now() from auth.users;

-- Tài khoản mới: một dòng chưa duyệt.
create function private.new_account_approval() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.account_approvals (account_id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created_approval after insert on auth.users
  for each row execute function private.new_account_approval();

alter table public.account_approvals enable row level security;
-- Người dùng chỉ đọc được dòng của chính mình (để app biết đang chờ duyệt); không ai ghi được qua API.
create policy "xem trạng thái duyệt của chính mình" on public.account_approvals
  for select to authenticated using (account_id = auth.uid());
revoke insert, update, delete on public.account_approvals from anon, authenticated;
revoke all on public.account_approvals from anon;

create function private.is_approved() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select approved from public.account_approvals where account_id = auth.uid()), false) $$;

create or replace function private.tree_role(target_tree uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select role from public.tree_roles
  where tree_id = target_tree and account_id = auth.uid() and private.is_approved()
$$;

drop policy "xem gia phả mình có vai trò" on public.family_trees;
create policy "xem gia phả mình có vai trò" on public.family_trees
  for select to authenticated using ((owner_id = auth.uid() and private.is_approved()) or public.can_view_tree(id));

drop policy "tạo gia phả đứng tên chính mình" on public.family_trees;
create policy "tạo gia phả đứng tên chính mình" on public.family_trees
  for insert to authenticated with check (owner_id = auth.uid() and private.is_approved());

revoke execute on function private.stamp_approval(), private.new_account_approval() from public, anon, authenticated;
revoke execute on function private.is_approved() from public, anon;
grant execute on function private.is_approved() to authenticated;
