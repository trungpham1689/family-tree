-- Ticket 03: quan hệ cha mẹ – con, hôn phối, Thuỷ tổ, Đời và Chi (ADR 0003).
-- Đời và Chi không lưu: tính từ Thuỷ tổ mỗi lần đọc (tree_positions), nên luôn đúng khi quan hệ đổi.

-- ---------------------------------------------------------------------------
-- Bổ sung cho Người
-- ---------------------------------------------------------------------------
alter table public.persons
  add column birth_order integer check (birth_order between 1 and 99),
  add column is_progenitor boolean not null default false;

create unique index persons_one_progenitor on public.persons (tree_id) where is_progenitor;

-- Người đầu tiên của một Gia phả tự là Thuỷ tổ.
create function private.mark_first_progenitor() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.persons where tree_id = new.tree_id and is_progenitor) then
    new.is_progenitor := true;
  end if;
  return new;
end;
$$;

create trigger persons_first_progenitor before insert on public.persons
  for each row execute function private.mark_first_progenitor();

-- Giới hạn số Người mỗi Gia phả.
create function private.enforce_person_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  current_count integer;
  max_persons integer := private.app_setting('max_persons_per_tree');
begin
  select count(*) into current_count from public.persons where tree_id = new.tree_id;
  if current_count >= max_persons then
    raise exception 'PERSON_LIMIT_REACHED'
      using detail = format('Mỗi gia phả có tối đa %s Người.', max_persons),
            errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger persons_limit before insert on public.persons
  for each row execute function private.enforce_person_limit();

-- ---------------------------------------------------------------------------
-- Cha/mẹ – con
-- ---------------------------------------------------------------------------
create table public.parent_links (
  child_id uuid not null references public.persons (id) on delete cascade,
  parent_id uuid not null references public.persons (id) on delete cascade,
  kind text not null default 'ruot' check (kind in ('ruot', 'nuoi')),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (child_id, parent_id),
  check (child_id <> parent_id)
);

create index parent_links_parent_idx on public.parent_links (parent_id);
create index parent_links_tree_idx on public.parent_links (tree_id);

create function private.check_parent_link() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  child_tree uuid;
  parent_tree uuid;
begin
  select tree_id into child_tree from public.persons where id = new.child_id;
  select tree_id into parent_tree from public.persons where id = new.parent_id;
  if child_tree is null or parent_tree is null or child_tree <> parent_tree then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;
  new.tree_id := child_tree;

  -- Cha/mẹ không được là hậu duệ của chính người con.
  if exists (
    with recursive descendants(id) as (
      select new.child_id
      union
      select l.child_id from public.parent_links l join descendants d on l.parent_id = d.id
    )
    select 1 from descendants where id = new.parent_id
  ) then
    raise exception 'ANCESTOR_CYCLE' using errcode = 'check_violation';
  end if;

  if new.kind = 'ruot' and (
    select count(*) from public.parent_links
    where child_id = new.child_id and kind = 'ruot' and parent_id <> new.parent_id
  ) >= 2 then
    raise exception 'TOO_MANY_PARENTS'
      using detail = 'Một người có tối đa hai cha mẹ ruột.', errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger parent_links_check before insert or update on public.parent_links
  for each row execute function private.check_parent_link();

-- ---------------------------------------------------------------------------
-- Hôn phối
-- ---------------------------------------------------------------------------
create table public.unions (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.family_trees (id) on delete cascade,
  partner_a uuid not null references public.persons (id) on delete cascade,
  partner_b uuid not null references public.persons (id) on delete cascade,
  -- Thứ tự hôn phối: người kia là vợ/chồng thứ mấy của partner_a (và ngược lại).
  order_for_a integer not null default 1 check (order_for_a between 1 and 20),
  order_for_b integer not null default 1 check (order_for_b between 1 and 20),
  status text not null default 'con' check (status in ('con', 'ly_hon', 'goa')),
  created_at timestamptz not null default now(),
  check (partner_a <> partner_b)
);

create unique index unions_pair on public.unions (least(partner_a, partner_b), greatest(partner_a, partner_b));
create index unions_partner_a_idx on public.unions (partner_a);
create index unions_partner_b_idx on public.unions (partner_b);
create index unions_tree_idx on public.unions (tree_id);

create function private.check_union() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  tree_a uuid;
  tree_b uuid;
begin
  select tree_id into tree_a from public.persons where id = new.partner_a;
  select tree_id into tree_b from public.persons where id = new.partner_b;
  if tree_a is null or tree_b is null or tree_a <> tree_b then
    raise exception 'SAME_TREE_REQUIRED' using errcode = 'check_violation';
  end if;
  new.tree_id := tree_a;
  return new;
end;
$$;

create trigger unions_check before insert or update on public.unions
  for each row execute function private.check_union();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.parent_links enable row level security;
create policy "xem quan hệ cha mẹ trong gia phả mình có vai trò" on public.parent_links
  for select to authenticated using (public.can_view_tree(tree_id));
create policy "biên tập viên thêm quan hệ cha mẹ" on public.parent_links
  for insert to authenticated with check (public.can_edit_tree(tree_id));
create policy "biên tập viên sửa quan hệ cha mẹ" on public.parent_links
  for update to authenticated using (public.can_edit_tree(tree_id)) with check (public.can_edit_tree(tree_id));
create policy "biên tập viên xoá quan hệ cha mẹ" on public.parent_links
  for delete to authenticated using (public.can_edit_tree(tree_id));

alter table public.unions enable row level security;
create policy "xem hôn phối trong gia phả mình có vai trò" on public.unions
  for select to authenticated using (public.can_view_tree(tree_id));
create policy "biên tập viên thêm hôn phối" on public.unions
  for insert to authenticated with check (public.can_edit_tree(tree_id));
create policy "biên tập viên sửa hôn phối" on public.unions
  for update to authenticated using (public.can_edit_tree(tree_id)) with check (public.can_edit_tree(tree_id));
create policy "biên tập viên xoá hôn phối" on public.unions
  for delete to authenticated using (public.can_edit_tree(tree_id));

revoke insert, update, delete on public.parent_links, public.unions from anon;

-- ---------------------------------------------------------------------------
-- Thao tác ghép (một transaction, chạy với quyền người gọi nên RLS vẫn áp dụng)
-- ---------------------------------------------------------------------------

-- Tạo một Người từ JSON; chỉ nhận các trường hồ sơ, bỏ qua id/tree_id/cờ hệ thống.
create function private.insert_person(target_tree uuid, data jsonb) returns uuid
language plpgsql set search_path = ''
as $$
declare
  fields public.persons;
  new_id uuid;
begin
  fields := jsonb_populate_record(null::public.persons, data);
  insert into public.persons (tree_id, full_name, gender, birth_year, death_year, is_deceased, birth_order)
  values (
    target_tree,
    fields.full_name,
    fields.gender,
    fields.birth_year,
    fields.death_year,
    coalesce(fields.is_deceased, fields.death_year is not null),
    fields.birth_order
  )
  returning id into new_id;
  return new_id;
end;
$$;

create function private.tree_of(target_person uuid) returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  found uuid;
begin
  select tree_id into found from public.persons where id = target_person;
  if found is null then
    raise exception 'PERSON_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  return found;
end;
$$;

create function public.add_child(parent_id uuid, other_parent_id uuid, link_kind text, person jsonb) returns uuid
language plpgsql set search_path = ''
as $$
declare
  target_tree uuid := private.tree_of(add_child.parent_id);
  new_id uuid;
begin
  new_id := private.insert_person(target_tree, person);

  -- Không ghi Thứ tự con thì xếp sau các anh chị em hiện có.
  update public.persons set birth_order = (
    select coalesce(max(sibling.birth_order), 0) + 1
    from public.parent_links l join public.persons sibling on sibling.id = l.child_id
    where l.parent_id = add_child.parent_id and sibling.id <> new_id
  )
  where id = new_id and birth_order is null;

  insert into public.parent_links (child_id, parent_id, kind) values (new_id, add_child.parent_id, link_kind);
  if other_parent_id is not null then
    insert into public.parent_links (child_id, parent_id, kind) values (new_id, other_parent_id, link_kind);
  end if;
  return new_id;
end;
$$;

create function public.add_spouse(person_id uuid, union_order integer, person jsonb) returns uuid
language plpgsql set search_path = ''
as $$
declare
  target_tree uuid := private.tree_of(add_spouse.person_id);
  new_id uuid;
  next_order integer;
begin
  select count(*) + 1 into next_order from public.unions u
  where add_spouse.person_id in (u.partner_a, u.partner_b);

  new_id := private.insert_person(target_tree, person);
  insert into public.unions (partner_a, partner_b, order_for_a, order_for_b)
  values (add_spouse.person_id, new_id, coalesce(union_order, next_order), 1);
  return new_id;
end;
$$;

create function public.add_parent(child_id uuid, link_kind text, person jsonb) returns uuid
language plpgsql set search_path = ''
as $$
declare
  target_tree uuid := private.tree_of(add_parent.child_id);
  new_id uuid;
  existing_parent uuid;
  child_was_progenitor boolean;
begin
  select is_progenitor into child_was_progenitor from public.persons where id = add_parent.child_id;
  new_id := private.insert_person(target_tree, person);

  -- Thêm cha/mẹ cho Thuỷ tổ: người mới trở thành Thuỷ tổ.
  if child_was_progenitor then
    update public.persons set is_progenitor = false where id = add_parent.child_id;
    update public.persons set is_progenitor = true where id = new_id;
  end if;

  -- Cha mẹ ruột của cùng một người con là vợ chồng của nhau.
  if link_kind = 'ruot' then
    for existing_parent in
      select l.parent_id from public.parent_links l where l.child_id = add_parent.child_id and l.kind = 'ruot'
    loop
      if not exists (
        select 1 from public.unions u
        where least(u.partner_a, u.partner_b) = least(existing_parent, new_id)
          and greatest(u.partner_a, u.partner_b) = greatest(existing_parent, new_id)
      ) then
        insert into public.unions (partner_a, partner_b, order_for_a, order_for_b)
        values (
          existing_parent,
          new_id,
          (select count(*) + 1 from public.unions u where existing_parent in (u.partner_a, u.partner_b)),
          1
        );
      end if;
    end loop;
  end if;

  insert into public.parent_links (child_id, parent_id, kind) values (add_parent.child_id, new_id, link_kind);
  return new_id;
end;
$$;

-- Chọn lại Thuỷ tổ (ví dụ khi người được đánh dấu chưa đúng).
create function public.set_progenitor(person_id uuid) returns void
language plpgsql set search_path = ''
as $$
declare
  target_tree uuid := private.tree_of(set_progenitor.person_id);
begin
  update public.persons set is_progenitor = false where tree_id = target_tree and is_progenitor;
  update public.persons set is_progenitor = true where id = set_progenitor.person_id;
  if not found then
    raise exception 'PERSON_NOT_FOUND' using errcode = 'no_data_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Đời, Chi và loại (Thuỷ tổ / đinh / dâu-rể / chưa nối) của mọi Người trong Gia phả
-- ---------------------------------------------------------------------------
create function public.tree_positions(target_tree uuid)
returns table (person_id uuid, generation integer, branch_id uuid, kind text)
language sql stable set search_path = ''
as $$
  with recursive descent (id, gen, branch, path) as (
    select p.id, 1, null::uuid, array[p.id]
    from public.persons p
    where p.tree_id = target_tree and p.is_progenitor
    union all
    select l.child_id,
           d.gen + 1,
           case when d.gen = 1 then l.child_id else d.branch end,
           d.path || l.child_id
    from descent d
    join public.parent_links l on l.parent_id = d.id
    where not l.child_id = any (d.path) and d.gen < 500
  ),
  blood as (
    select distinct on (id) id, gen, branch from descent order by id, gen
  ),
  in_laws as (
    select distinct on (spouse.id) spouse.id, b.gen, b.branch
    from blood b
    join public.unions u on b.id in (u.partner_a, u.partner_b)
    cross join lateral (select case when u.partner_a = b.id then u.partner_b else u.partner_a end as id) spouse
    where not exists (select 1 from blood other where other.id = spouse.id)
    order by spouse.id, b.gen
  )
  select p.id,
         coalesce(b.gen, i.gen),
         coalesce(b.branch, i.branch),
         case
           when p.is_progenitor then 'thuy_to'
           when b.id is not null then 'dinh'
           when i.id is not null then 'dau_re'
           else 'chua_noi'
         end
  from public.persons p
  left join blood b on b.id = p.id
  left join in_laws i on i.id = p.id
  where p.tree_id = target_tree
$$;

-- ---------------------------------------------------------------------------
-- Quyền gọi hàm
-- ---------------------------------------------------------------------------
revoke execute on function private.mark_first_progenitor(), private.enforce_person_limit(),
  private.check_parent_link(), private.check_union() from public, anon, authenticated;
revoke execute on function private.insert_person(uuid, jsonb), private.tree_of(uuid) from public, anon;
grant execute on function private.insert_person(uuid, jsonb), private.tree_of(uuid) to authenticated;

revoke execute on function public.add_child(uuid, uuid, text, jsonb), public.add_spouse(uuid, integer, jsonb),
  public.add_parent(uuid, text, jsonb), public.set_progenitor(uuid), public.tree_positions(uuid) from public, anon;
grant execute on function public.add_child(uuid, uuid, text, jsonb), public.add_spouse(uuid, integer, jsonb),
  public.add_parent(uuid, text, jsonb), public.set_progenitor(uuid), public.tree_positions(uuid) to authenticated;
