-- Người đầu tiên của Gia phả không còn tự là Thuỷ tổ: chỉ khi chọn "Đặt làm Thuỷ tổ" ở trang Người.
-- Đời 1 vẫn có gốc: khi chưa ai là Thuỷ tổ, gốc là tổ tiên xa nhất của người tạo đầu tiên (loại 'dinh', không phải 'thuy_to').
drop trigger persons_first_progenitor on public.persons;
drop function private.mark_first_progenitor();

create or replace function public.tree_positions(target_tree uuid)
returns table (person_id uuid, generation integer, branch_id uuid, kind text)
language sql stable set search_path = ''
as $$
  with recursive up (id, depth, path) as (
    select f.id, 0, array[f.id]
    from (select id from public.persons where tree_id = target_tree order by created_at, id limit 1) f
    union all
    select l.parent_id, u.depth + 1, u.path || l.parent_id
    from up u
    join public.parent_links l on l.child_id = u.id
    where not l.parent_id = any (u.path) and u.depth < 500
  ),
  root as (
    select coalesce(
      (select id from public.persons where tree_id = target_tree and is_progenitor),
      (select u.id from up u join public.persons p on p.id = u.id order by u.depth desc, p.created_at, p.id limit 1)
    ) as id
  ),
  descent (id, gen, branch, path) as (
    select r.id, 1, null::uuid, array[r.id] from root r where r.id is not null
    union all
    select l.child_id,
           d.gen + 1,
           case when c.founds_branch then l.child_id else d.branch end,
           d.path || l.child_id
    from descent d
    join public.parent_links l on l.parent_id = d.id
    join public.persons c on c.id = l.child_id
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
