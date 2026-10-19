import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb } from './harness';

/**
 * Ma trận quyền ghi theo bảng × vai trò (CONTEXT.md, "Quy tắc ghi"). Mỗi dòng nói: Chủ sở hữu / Biên tập viên (người tạo) /
 * Biên tập viên (người khác) / Người xem / người ngoài có được ghi hay không. Đổi chính sách mà không đổi bảng này là test hỏng.
 */
describe('seam B: quy tắc ghi theo bảng và vai trò', () => {
  let db: TestDb;
  let owner: Caller;
  let creator: Caller;
  let otherEditor: Caller;
  let viewer: Caller;
  let outsider: Caller;
  let treeId: string;
  let rootId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const make = async (label: string) => db.createUser(`${label}-${crypto.randomUUID()}@example.com`);
    const ownerUser = await make('chu');
    owner = db.as(ownerUser);
    const [tree] = await owner.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
    rootId = (await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Tổ') returning id", [treeId]))[0]!.id;
    const invite = async (label: string, role: 'editor' | 'viewer') => {
      const user = await make(label);
      await owner.rpc('invite_to_tree', { target_tree: treeId, invite_email: user.email, new_role: role });
      return db.as(user);
    };
    creator = await invite('bt1', 'editor');
    otherEditor = await invite('bt2', 'editor');
    viewer = await invite('xem', 'viewer');
    outsider = db.as(await make('la'));
  });

  afterAll(async () => {
    await db.close();
  });

  const can = async (caller: Caller, sql: string, params: unknown[] = []) => {
    try {
      return (await caller.query(sql, params)).length > 0;
    } catch {
      return false;
    }
  };

  describe('tree_events: Biên tập viên chỉ sửa/xoá Sự kiện mình tạo', () => {
    const insert = (caller: Caller) =>
      can(caller, "insert into tree_events (tree_id, title, month, day) values ($1, 'Họp họ', 5, 5) returning id", [treeId]);

    it('thêm: Chủ sở hữu và Biên tập viên được; Người xem và người ngoài không', async () => {
      expect(await insert(owner)).toBe(true);
      expect(await insert(creator)).toBe(true);
      expect(await insert(viewer)).toBe(false);
      expect(await insert(outsider)).toBe(false);
    });

    it('sửa và xoá: người tạo và Chủ sở hữu được; Biên tập viên khác, Người xem, người ngoài không', async () => {
      const mk = async () => (await creator.query<{ id: string }>("insert into tree_events (tree_id, title, month, day) values ($1, 'X', 1, 1) returning id", [treeId]))[0]!.id;
      const update = (caller: Caller, id: string) => can(caller, "update tree_events set title = 'Đổi' where id = $1 returning id", [id]);
      const remove = (caller: Caller, id: string) => can(caller, 'delete from tree_events where id = $1 returning id', [id]);

      const id = await mk();
      expect(await update(otherEditor, id)).toBe(false);
      expect(await update(viewer, id)).toBe(false);
      expect(await update(outsider, id)).toBe(false);
      expect(await update(creator, id)).toBe(true);
      expect(await update(owner, id)).toBe(true);
      expect(await remove(otherEditor, id)).toBe(false);
      expect(await remove(creator, id)).toBe(true);

      const id2 = await mk();
      expect(await remove(owner, id2)).toBe(true);
    });

    it('Biên tập viên không đặt người tạo là người khác', async () => {
      const [stranger] = await owner.query<{ id: string }>('select auth.uid() as id');
      expect(await can(creator, "insert into tree_events (tree_id, title, month, day, created_by) values ($1, 'Giả', 1, 1, $2) returning id", [treeId, stranger!.id])).toBe(false);
    });
  });

  describe('pha_do_configs: Biên tập viên nào cũng lưu được (một dòng chung)', () => {
    const save = (caller: Caller) =>
      can(caller, "insert into pha_do_configs (tree_id, config) values ($1, '{}') on conflict (tree_id) do update set config = excluded.config returning tree_id", [treeId]);

    it('Chủ sở hữu và mọi Biên tập viên lưu được; Người xem và người ngoài không', async () => {
      expect(await save(owner)).toBe(true);
      expect(await save(otherEditor)).toBe(true);
      expect(await save(viewer)).toBe(false);
      expect(await save(outsider)).toBe(false);
    });
  });

  describe('parent_links và unions: Biên tập viên thêm và sửa, chỉ Chủ sở hữu xoá', () => {
    it('quan hệ cha mẹ', async () => {
      const childId = await creator.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Con' } });
      expect(await can(otherEditor, "update parent_links set kind = 'nuoi' where child_id = $1 returning child_id", [childId])).toBe(true);
      expect(await can(viewer, "update parent_links set kind = 'ruot' where child_id = $1 returning child_id", [childId])).toBe(false);
      expect(await can(otherEditor, 'delete from parent_links where child_id = $1 returning child_id', [childId])).toBe(false);
      expect(await can(owner, 'delete from parent_links where child_id = $1 returning child_id', [childId])).toBe(true);
    });

    it('hôn phối', async () => {
      await creator.rpc('add_spouse', { person_id: rootId, union_order: null, person: { full_name: 'Vợ' } });
      expect(await can(otherEditor, "update unions set status = 'goa' where partner_a = $1 returning id", [rootId])).toBe(true);
      expect(await can(outsider, "update unions set status = 'con' where partner_a = $1 returning id", [rootId])).toBe(false);
      expect(await can(otherEditor, 'delete from unions where partner_a = $1 returning id', [rootId])).toBe(false);
      expect(await can(owner, 'delete from unions where partner_a = $1 returning id', [rootId])).toBe(true);
    });
  });
});
