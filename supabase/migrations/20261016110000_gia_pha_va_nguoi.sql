-- Ticket 02: Gia phả, Vai trò, Người (bản đầu) cùng RLS.
-- Thuật ngữ theo CONTEXT.md; quyền theo ADR 0001 (mọi dữ liệu thuộc đúng một Gia phả).

-- ---------------------------------------------------------------------------
-- Cấu hình giới hạn (đổi được mà không cần sửa code)
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value integer not null
);

insert into public.app_settings (key, value) values
  ('max_trees_per_account', 3),
  ('max_persons_per_tree', 2000),
  ('max_photos_per_person', 5);

alter table public.app_settings enable row level security;
create policy "ai đăng nhập cũng đọc được cấu hình" on public.app_settings
  for select to authenticated using (true);
revoke insert, update, delete on public.app_settings from anon, authenticated;

create function public.app_setting(setting_key text) returns integer
language sql stable security definer set search_path = public
as $$
  select value from public.app_settings where key = setting_key
$$;

-- ---------------------------------------------------------------------------
-- Tiện ích chung
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gia phả
-- ---------------------------------------------------------------------------
create table public.family_trees (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text check (description is null or length(description) <= 2000),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index family_trees_owner_idx on public.family_trees (owner_id);

create trigger family_trees_touch before update on public.family_trees
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Vai trò của tài khoản trên một Gia phả
-- ---------------------------------------------------------------------------
create table public.tree_roles (
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  account_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (tree_id, account_id)
);

create index tree_roles_account_idx on public.tree_roles (account_id);
create unique index tree_roles_one_owner on public.tree_roles (tree_id) where role = 'owner';

-- Vai trò của người đang gọi trên một Gia phả (null nếu không có).
-- security definer để policy của tree_roles không tự gọi lại chính nó.
create function public.tree_role(target_tree uuid) returns text
language sql stable security definer set search_path = public
as $$
  select role from public.tree_roles
  where tree_id = target_tree and account_id = auth.uid()
$$;

create function public.can_view_tree(target_tree uuid) returns boolean
language sql stable
as $$ select public.tree_role(target_tree) is not null $$;

create function public.can_edit_tree(target_tree uuid) returns boolean
language sql stable
as $$ select coalesce(public.tree_role(target_tree) in ('owner', 'editor'), false) $$;

create function public.is_tree_owner(target_tree uuid) returns boolean
language sql stable
as $$ select coalesce(public.tree_role(target_tree) = 'owner', false) $$;

-- Giới hạn số Gia phả mỗi tài khoản sở hữu.
create function public.enforce_tree_limit() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  owned integer;
begin
  select count(*) into owned from public.family_trees where owner_id = new.owner_id;
  if owned >= public.app_setting('max_trees_per_account') then
    raise exception 'TREE_LIMIT_REACHED'
      using detail = format('Mỗi tài khoản tạo tối đa %s gia phả.', public.app_setting('max_trees_per_account')),
            errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger family_trees_limit before insert on public.family_trees
  for each row execute function public.enforce_tree_limit();

-- Người tạo Gia phả tự động là Chủ sở hữu.
create function public.grant_owner_role() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.tree_roles (tree_id, account_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger family_trees_grant_owner after insert on public.family_trees
  for each row execute function public.grant_owner_role();

alter table public.family_trees enable row level security;

-- owner_id = auth.uid() để `insert … returning` thấy ngay dòng vừa tạo,
-- trước khi trigger ghi vai trò Chủ sở hữu.
create policy "xem gia phả mình có vai trò" on public.family_trees
  for select to authenticated using (owner_id = auth.uid() or public.can_view_tree(id));
create policy "tạo gia phả đứng tên chính mình" on public.family_trees
  for insert to authenticated with check (owner_id = auth.uid());
create policy "chủ sở hữu sửa gia phả" on public.family_trees
  for update to authenticated using (public.is_tree_owner(id)) with check (owner_id = auth.uid());
create policy "chủ sở hữu xoá gia phả" on public.family_trees
  for delete to authenticated using (public.is_tree_owner(id));

alter table public.tree_roles enable row level security;

create policy "xem vai trò trong gia phả mình có vai trò" on public.tree_roles
  for select to authenticated using (public.can_view_tree(tree_id));
-- Thêm/đổi/gỡ vai trò thuộc ticket 11; tới lúc đó chỉ trigger (security definer) ghi được.

-- ---------------------------------------------------------------------------
-- Người (bản đầu; ticket 05 bổ sung hồ sơ đầy đủ)
-- ---------------------------------------------------------------------------
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  gender text check (gender in ('nam', 'nu')),
  birth_year integer check (birth_year between 1 and 2200),
  death_year integer check (death_year between 1 and 2200),
  is_deceased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (birth_year is null or death_year is null or death_year >= birth_year)
);

create index persons_tree_idx on public.persons (tree_id);

create trigger persons_touch before update on public.persons
  for each row execute function public.touch_updated_at();

alter table public.persons enable row level security;

create policy "xem Người trong gia phả mình có vai trò" on public.persons
  for select to authenticated using (public.can_view_tree(tree_id));
create policy "biên tập viên thêm Người" on public.persons
  for insert to authenticated with check (public.can_edit_tree(tree_id));
create policy "biên tập viên sửa Người" on public.persons
  for update to authenticated using (public.can_edit_tree(tree_id)) with check (public.can_edit_tree(tree_id));
create policy "biên tập viên xoá Người" on public.persons
  for delete to authenticated using (public.can_edit_tree(tree_id));

-- Không cho tài khoản chưa đăng nhập ghi vào bất kỳ bảng nào.
revoke insert, update, delete on public.family_trees, public.tree_roles, public.persons from anon;
revoke insert, update, delete on public.tree_roles from authenticated;
