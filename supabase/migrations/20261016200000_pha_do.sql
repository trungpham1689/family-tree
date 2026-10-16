-- Cấu hình Phả đồ đã lưu, mỗi Gia phả một bản (ticket 16; ticket 17 thêm phần trang trí vào cùng JSON).
create table public.pha_do_configs (
  tree_id uuid primary key references public.family_trees (id) on delete cascade,
  config jsonb not null check (jsonb_typeof(config) = 'object' and pg_column_size(config) < 20000),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create trigger pha_do_configs_touch before update on public.pha_do_configs
  for each row execute function public.touch_updated_at();

alter table public.pha_do_configs enable row level security;
create policy "xem cấu hình phả đồ của gia phả mình có vai trò" on public.pha_do_configs
  for select to authenticated using (public.can_view_tree(tree_id));
create policy "biên tập viên lưu cấu hình phả đồ" on public.pha_do_configs
  for insert to authenticated with check (public.can_edit_tree(tree_id));
create policy "biên tập viên sửa cấu hình phả đồ" on public.pha_do_configs
  for update to authenticated using (public.can_edit_tree(tree_id)) with check (public.can_edit_tree(tree_id));

revoke all on public.pha_do_configs from anon;
