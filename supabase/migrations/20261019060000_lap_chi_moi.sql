-- Lập chi mới: cho Biên tập viên đánh dấu bất kỳ Người nào làm tổ của một chi, thay cho quy ước
-- cứng "mỗi con Đời 2 của Thuỷ tổ tự động là một chi". Mặc định false, nên đến khi có người được
-- đánh dấu, "Các chi trong họ" (Phả ký) không có chi nào ngoài Thuỷ tổ.
alter table public.persons add column founds_branch boolean not null default false;

create or replace function public.tree_positions(target_tree uuid)
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
