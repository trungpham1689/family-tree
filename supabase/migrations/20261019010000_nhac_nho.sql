-- Nhắc nhở (SPEC story 45, 61-67), phần trong app: liên kết tài khoản–Người, Danh sách nhắc giỗ,
-- độ sớm nhắc, trạng thái đã đọc. Tính "sắp đến hạn" vẫn suy trực tiếp từ persons/tree_events khi
-- tải trang (module reminders/due-reminders.ts), không lưu trùng — chỉ lưu phần không suy được:
-- ai theo dõi ai, nhắc trước mấy ngày, đã đọc cái nào.
-- Bản tin email + Worker Cron (SPEC story 65) cần tài khoản Resend/Cloudflare riêng của chủ dự án,
-- chưa làm ở đây — xem README.

-- ---------------------------------------------------------------------------
-- Liên kết tài khoản với Người là chính mình trong một Gia phả
-- ---------------------------------------------------------------------------
alter table public.tree_roles add column linked_person_id uuid references public.persons (id) on delete set null;

create function private.check_linked_person() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.linked_person_id is not null and private.tree_of(new.linked_person_id) <> new.tree_id then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tree_roles_linked_person before insert or update on public.tree_roles
  for each row execute function private.check_linked_person();

-- ---------------------------------------------------------------------------
-- Danh sách nhắc giỗ: những Người mà một tài khoản muốn được nhắc ngày giỗ
-- ---------------------------------------------------------------------------
create table public.reminder_watch (
  account_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete cascade,
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, person_id)
);

create index reminder_watch_account_idx on public.reminder_watch (account_id);

create function private.check_reminder_watch() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.tree_id := private.tree_of(new.person_id);
  return new;
end;
$$;

create trigger reminder_watch_check before insert on public.reminder_watch
  for each row execute function private.check_reminder_watch();

alter table public.reminder_watch enable row level security;
create policy "tài khoản xem Danh sách nhắc giỗ của mình" on public.reminder_watch
  for select to authenticated using (account_id = auth.uid());
create policy "tài khoản thêm vào Danh sách nhắc giỗ của mình" on public.reminder_watch
  for insert to authenticated with check (account_id = auth.uid() and public.can_view_tree(tree_id));
create policy "tài khoản gỡ khỏi Danh sách nhắc giỗ của mình" on public.reminder_watch
  for delete to authenticated using (account_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Độ sớm nhắc theo mỗi Gia phả (đúng ngày / trước 1-3-7 ngày)
-- ---------------------------------------------------------------------------
create table public.reminder_prefs (
  account_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  offset_days integer not null default 0 check (offset_days in (0, 1, 3, 7)),
  updated_at timestamptz not null default now(),
  primary key (account_id, tree_id)
);

alter table public.reminder_prefs enable row level security;
create policy "tài khoản xem cài đặt nhắc của mình" on public.reminder_prefs
  for select to authenticated using (account_id = auth.uid());
create policy "tài khoản tạo cài đặt nhắc của mình" on public.reminder_prefs
  for insert to authenticated with check (account_id = auth.uid() and public.can_view_tree(tree_id));
create policy "tài khoản đổi cài đặt nhắc của mình" on public.reminder_prefs
  for update to authenticated using (account_id = auth.uid()) with check (account_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Đã đọc: tránh hiện lại một nhắc nhở đã xem. Khoá là chuỗi suy từ ngày + loại + Người/Sự kiện
-- (xem notificationKey trong reminders/due-reminders.ts), không phải id riêng vì nhắc nhở không
-- lưu thành dòng của chính nó.
-- ---------------------------------------------------------------------------
create table public.notification_reads (
  account_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key (account_id, notification_key)
);

alter table public.notification_reads enable row level security;
create policy "tài khoản xem đã đọc của mình" on public.notification_reads
  for select to authenticated using (account_id = auth.uid());
create policy "tài khoản tự đánh dấu đã đọc" on public.notification_reads
  for insert to authenticated with check (account_id = auth.uid());
create policy "tài khoản xoá đã đọc của mình" on public.notification_reads
  for delete to authenticated using (account_id = auth.uid());

revoke insert, update, delete on public.reminder_watch, public.reminder_prefs, public.notification_reads from anon;

-- ---------------------------------------------------------------------------
-- Liên kết + mồi Danh sách nhắc giỗ bằng tổ tiên trực hệ ~4 đời (chỉ khi danh sách còn trống,
-- để không ghi đè lựa chọn người dùng đã tự chỉnh ở lần liên kết sau).
-- ---------------------------------------------------------------------------
create function public.link_account_to_person(target_tree uuid, person_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  existing_watch integer;
begin
  update public.tree_roles set linked_person_id = link_account_to_person.person_id
  where tree_id = target_tree and account_id = auth.uid();
  if not found then
    raise exception 'NOT_TREE_MEMBER' using errcode = 'check_violation';
  end if;

  select count(*) into existing_watch from public.reminder_watch where account_id = auth.uid() and tree_id = target_tree;
  if existing_watch = 0 then
    insert into public.reminder_watch (account_id, person_id, tree_id)
    select auth.uid(), ancestor.id, target_tree
    from (
      with recursive up (id, depth) as (
        select l.parent_id, 1
        from public.parent_links l
        where l.child_id = link_account_to_person.person_id
        union all
        select l.parent_id, u.depth + 1
        from up u
        join public.parent_links l on l.child_id = u.id
        where u.depth < 4
      )
      select distinct id from up
    ) ancestor
    on conflict do nothing;
  end if;
end;
$$;

revoke execute on function private.check_linked_person(), private.check_reminder_watch() from public, anon, authenticated;
revoke execute on function public.link_account_to_person(uuid, uuid) from public, anon;
grant execute on function public.link_account_to_person(uuid, uuid) to authenticated;
