-- Sự kiện của Gia phả (ticket 13): họp họ, ngày tự đặt… Giỗ và sinh nhật không lưu ở đây,
-- chúng được suy ra từ hồ sơ Người khi hiển thị lịch.
create table public.tree_events (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  calendar text not null default 'duong' check (calendar in ('duong', 'am')),
  -- Lặp hằng năm thì không cần năm; một lần thì bắt buộc có năm.
  repeats_yearly boolean not null default true,
  year integer check (year between 1 and 2200),
  month integer not null check (month between 1 and 12),
  day integer not null check (day between 1 and 31),
  leap boolean not null default false,
  start_time time,
  location text check (location is null or length(location) <= 300),
  note text check (note is null or length(note) <= 2000),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (repeats_yearly or year is not null),
  check (calendar = 'am' or not leap),
  check (calendar = 'duong' or day <= 30)
);

create index tree_events_tree_idx on public.tree_events (tree_id);

create trigger tree_events_touch before update on public.tree_events
  for each row execute function public.touch_updated_at();

alter table public.tree_events enable row level security;
create policy "xem sự kiện trong gia phả mình có vai trò" on public.tree_events
  for select to authenticated using (public.can_view_tree(tree_id));
create policy "biên tập viên thêm sự kiện" on public.tree_events
  for insert to authenticated with check (public.can_edit_tree(tree_id));
create policy "biên tập viên sửa sự kiện" on public.tree_events
  for update to authenticated using (public.can_edit_tree(tree_id)) with check (public.can_edit_tree(tree_id));
create policy "biên tập viên xoá sự kiện" on public.tree_events
  for delete to authenticated using (public.can_edit_tree(tree_id));

revoke all on public.tree_events from anon;
