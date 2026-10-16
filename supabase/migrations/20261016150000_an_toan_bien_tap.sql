-- An toàn khi nhiều người cùng biên tập:
--   * version trên Người để phát hiện sửa chồng (không lịch sử, không thùng rác — Q21).
--   * Gắn Người chưa nối vào cây: nối với cha/mẹ hoặc vợ/chồng đã có.

-- ---------------------------------------------------------------------------
-- Phát hiện xung đột khi sửa Người
-- ---------------------------------------------------------------------------
alter table public.persons add column version integer not null default 1;

-- Người sửa gửi kèm version đã đọc. Khác version hiện tại nghĩa là đã có người lưu trước: từ chối.
-- Không gửi version (thao tác hệ thống, RPC quan hệ) thì coi như sửa trên bản mới nhất.
-- Mỗi lần sửa thành công, version tăng 1.
create function private.bump_person_version() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.version is distinct from old.version then
    raise exception 'STALE_VERSION'
      using detail = 'Người này đã được sửa sau khi bạn mở.', errcode = 'serialization_failure';
  end if;
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger persons_version before update on public.persons
  for each row execute function private.bump_person_version();

revoke execute on function private.bump_person_version() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gắn Người đã có vào cây
-- ---------------------------------------------------------------------------

-- Ghi hôn phối giữa hai người nếu chưa có; thứ tự xếp sau các hôn phối hiện có.
create function private.ensure_union(first_partner uuid, second_partner uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  if exists (
    select 1 from public.unions u
    where least(u.partner_a, u.partner_b) = least(first_partner, second_partner)
      and greatest(u.partner_a, u.partner_b) = greatest(first_partner, second_partner)
  ) then
    return;
  end if;
  insert into public.unions (partner_a, partner_b, order_for_a, order_for_b)
  values (
    first_partner,
    second_partner,
    (select count(*) + 1 from public.unions u where first_partner in (u.partner_a, u.partner_b)),
    (select count(*) + 1 from public.unions u where second_partner in (u.partner_a, u.partner_b))
  );
end;
$$;

-- Nối một Người đã có làm con của một Người đã có.
create function public.link_parent(child_id uuid, parent_id uuid, link_kind text) returns void
language plpgsql set search_path = ''
as $$
declare
  existing_parent uuid;
  child_was_progenitor boolean;
begin
  -- Báo PERSON_NOT_FOUND nếu một trong hai không tồn tại hoặc không xem được.
  perform private.tree_of(link_parent.child_id);
  perform private.tree_of(link_parent.parent_id);
  select is_progenitor into child_was_progenitor from public.persons where id = link_parent.child_id;

  insert into public.parent_links (child_id, parent_id, kind)
  values (link_parent.child_id, link_parent.parent_id, link_kind);

  -- Gắn cha/mẹ cho Thuỷ tổ thì Thuỷ tổ chuyển lên người cha/mẹ (giống add_parent).
  if child_was_progenitor then
    update public.persons set is_progenitor = false where id = link_parent.child_id;
    update public.persons set is_progenitor = true where id = link_parent.parent_id;
  end if;

  -- Cha mẹ ruột của cùng một người con là vợ chồng của nhau.
  if link_kind = 'ruot' then
    for existing_parent in
      select l.parent_id from public.parent_links l
      where l.child_id = link_parent.child_id and l.kind = 'ruot' and l.parent_id <> link_parent.parent_id
    loop
      perform private.ensure_union(existing_parent, link_parent.parent_id);
    end loop;
  end if;
end;
$$;

-- Nối một Người đã có làm vợ/chồng của một Người đã có.
create function public.link_spouse(person_id uuid, spouse_id uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  perform private.tree_of(link_spouse.person_id);
  perform private.tree_of(link_spouse.spouse_id);
  perform private.ensure_union(link_spouse.person_id, link_spouse.spouse_id);
end;
$$;

revoke execute on function private.ensure_union(uuid, uuid) from public, anon;
grant execute on function private.ensure_union(uuid, uuid) to authenticated;
revoke execute on function public.link_parent(uuid, uuid, text), public.link_spouse(uuid, uuid) from public, anon;
grant execute on function public.link_parent(uuid, uuid, text), public.link_spouse(uuid, uuid) to authenticated;
