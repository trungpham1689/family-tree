import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

type Member = { account_id: string; email: string; role: string; person_id: string | null; is_me: boolean };

describe('seam B: Vai trò', () => {
  let db: TestDb;
  let owner: TestUser;
  let editor: TestUser;
  let viewer: TestUser;
  let treeId: string;
  let rootId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  const unique = (name: string) => `${name}-${crypto.randomUUID()}@example.com`;

  beforeEach(async () => {
    owner = await db.createUser(unique('chu'));
    editor = await db.createUser(unique('bien-tap'));
    viewer = await db.createUser(unique('xem'));
    const me = db.as(owner);
    const [tree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
    const [root] = await me.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Tổ') returning id", [
      treeId,
    ]);
    rootId = root!.id;
    await me.rpc('invite_member', { target_tree: treeId, invitee_email: editor.email, new_role: 'editor' });
    await me.rpc('invite_member', { target_tree: treeId, invitee_email: viewer.email.toUpperCase(), new_role: 'viewer' });
  });

  const members = (caller: Caller) => caller.rpcRows<Member>('tree_members', { target_tree: treeId });
  const roleOf = async (user: TestUser) => (await members(db.as(owner))).find((m) => m.account_id === user.id)?.role;

  describe('mời', () => {
    it('mời email đã có tài khoản thì cấp vai trò ngay; người được mời thấy gia phả', async () => {
      expect(await roleOf(editor)).toBe('editor');
      expect(await roleOf(viewer)).toBe('viewer');
      expect(await db.as(viewer).query('select id from family_trees')).toEqual([{ id: treeId }]);
    });

    it('lời mời cho email chưa đăng ký tự kích hoạt khi đăng ký', async () => {
      const email = unique('chua-co');
      expect(await db.as(owner).rpc('invite_member', { target_tree: treeId, invitee_email: email, new_role: 'viewer' })).toBe(
        'invited',
      );
      expect(await db.as(owner).query('select email, role from tree_invitations')).toEqual([{ email, role: 'viewer' }]);

      const newcomer = await db.createUser(email);
      expect(await roleOf(newcomer)).toBe('viewer');
      expect(await db.as(owner).query('select * from tree_invitations')).toEqual([]);
    });

    it('Biên tập viên mời được, Người xem thì không', async () => {
      await db.as(editor).rpc('invite_member', { target_tree: treeId, invitee_email: unique('a'), new_role: 'viewer' });
      await expect(
        db.as(viewer).rpc('invite_member', { target_tree: treeId, invitee_email: unique('b'), new_role: 'viewer' }),
      ).rejects.toThrow(/NOT_ALLOWED/);
    });

    it('không mời làm Chủ sở hữu, không mời trùng, email sai', async () => {
      const me = db.as(owner);
      await expect(me.rpc('invite_member', { target_tree: treeId, invitee_email: unique('c'), new_role: 'owner' })).rejects.toThrow(
        /INVALID_ROLE/,
      );
      await expect(me.rpc('invite_member', { target_tree: treeId, invitee_email: editor.email, new_role: 'viewer' })).rejects.toThrow(
        /ALREADY_MEMBER/,
      );
      await expect(me.rpc('invite_member', { target_tree: treeId, invitee_email: 'khong-phai-email', new_role: 'viewer' })).rejects.toThrow(
        /INVALID_EMAIL/,
      );
    });
  });

  describe('đổi vai trò, gỡ, rời', () => {
    it('đổi vai trò', async () => {
      await db.as(owner).rpc('set_member_role', { target_tree: treeId, member: viewer.id, new_role: 'editor' });
      expect(await roleOf(viewer)).toBe('editor');
    });

    it('Biên tập viên không đổi, không gỡ được Chủ sở hữu', async () => {
      await expect(
        db.as(editor).rpc('set_member_role', { target_tree: treeId, member: owner.id, new_role: 'viewer' }),
      ).rejects.toThrow(/OWNER_PROTECTED/);
      await expect(db.as(editor).rpc('remove_member', { target_tree: treeId, member: owner.id })).rejects.toThrow(/OWNER_PROTECTED/);
      await expect(db.as(owner).rpc('remove_member', { target_tree: treeId, member: owner.id })).rejects.toThrow(/OWNER_PROTECTED/);
      expect(await roleOf(owner)).toBe('owner');
    });

    it('Người xem không đổi vai trò, không gỡ người khác được', async () => {
      await expect(
        db.as(viewer).rpc('set_member_role', { target_tree: treeId, member: viewer.id, new_role: 'editor' }),
      ).rejects.toThrow(/NOT_ALLOWED/);
      await expect(db.as(viewer).rpc('remove_member', { target_tree: treeId, member: editor.id })).rejects.toThrow(/NOT_ALLOWED/);
    });

    it('tài khoản bị gỡ mất quyền đọc ngay', async () => {
      await db.as(owner).rpc('remove_member', { target_tree: treeId, member: editor.id });
      const asEditor = db.as(editor);
      expect(await asEditor.query('select * from family_trees')).toEqual([]);
      expect(await asEditor.query('select * from persons')).toEqual([]);
      expect(await members(asEditor)).toEqual([]);
    });

    it('tự rời được', async () => {
      await db.as(viewer).rpc('remove_member', { target_tree: treeId, member: viewer.id });
      expect(await roleOf(viewer)).toBeUndefined();
    });
  });

  describe('Người xem không ghi được bảng nào', () => {
    it('mọi lệnh ghi đều không có tác dụng hoặc bị từ chối', async () => {
      const asViewer = db.as(viewer);
      const attempts: [string, unknown[]][] = [
        ['update family_trees set name = $2 where id = $1', [treeId, 'Bị sửa']],
        ['delete from family_trees where id = $1', [treeId]],
        ["insert into persons (tree_id, full_name) values ($1, 'Lạ')", [treeId]],
        ["update persons set full_name = 'Bị sửa' where id = $1", [rootId]],
        ['delete from persons where id = $1', [rootId]],
        ["insert into tree_roles (tree_id, account_id, role) values ($1, $2, 'owner')", [treeId, viewer.id]],
        ["update tree_roles set role = 'editor' where account_id = $1", [viewer.id]],
        ['delete from tree_roles where tree_id = $1', [treeId]],
        ["insert into tree_invitations (tree_id, email, role) values ($1, 'x@y.vn', 'editor')", [treeId]],
        ['delete from parent_links where tree_id = $1', [treeId]],
        ['delete from unions where tree_id = $1', [treeId]],
      ];
      for (const [sql, params] of attempts) await asViewer.query(sql, params).catch(() => undefined);
      const rpcs: [string, Record<string, unknown>][] = [
        ['add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Lạ' } }],
        ['add_spouse', { person_id: rootId, union_order: 1, person: { full_name: 'Lạ' } }],
        ['add_parent', { child_id: rootId, link_kind: 'ruot', person: { full_name: 'Lạ' } }],
        ['set_progenitor', { person_id: rootId }],
        ['import_into_tree', { target_tree: treeId, payload: { persons: [], parentLinks: [], unions: [] } }],
      ];
      for (const [name, args] of rpcs) await asViewer.rpc(name, args).catch(() => undefined);

      const admin = db.admin;
      expect((await admin.query('select name from family_trees where id = $1', [treeId])).rows).toEqual([{ name: 'Họ Phạm' }]);
      expect((await admin.query('select full_name from persons where tree_id = $1', [treeId])).rows).toEqual([{ full_name: 'Tổ' }]);
      expect(await roleOf(viewer)).toBe('viewer');
      expect((await admin.query('select * from tree_invitations where tree_id = $1', [treeId])).rows).toEqual([]);
    });
  });

  describe('liên kết tài khoản ↔ Người', () => {
    it('tự liên kết, huỷ liên kết; một Người chỉ gắn với một tài khoản', async () => {
      await db.as(viewer).rpc('set_member_person', { target_tree: treeId, member: viewer.id, target_person: rootId });
      expect((await members(db.as(owner))).find((m) => m.account_id === viewer.id)?.person_id).toBe(rootId);

      await expect(
        db.as(owner).rpc('set_member_person', { target_tree: treeId, member: editor.id, target_person: rootId }),
      ).rejects.toThrow(/PERSON_ALREADY_LINKED/);

      await db.as(viewer).rpc('set_member_person', { target_tree: treeId, member: viewer.id, target_person: null });
      expect((await members(db.as(owner))).find((m) => m.account_id === viewer.id)?.person_id).toBeNull();
    });

    it('Người xem không liên kết hộ người khác', async () => {
      await expect(
        db.as(viewer).rpc('set_member_person', { target_tree: treeId, member: editor.id, target_person: rootId }),
      ).rejects.toThrow(/NOT_ALLOWED/);
    });

    it('xoá Người thì liên kết tự huỷ', async () => {
      await db.as(owner).rpc('set_member_person', { target_tree: treeId, member: owner.id, target_person: rootId });
      await db.as(owner).query('delete from persons where id = $1', [rootId]);
      expect((await members(db.as(owner))).find((m) => m.is_me)?.person_id).toBeNull();
    });
  });

  it('Người xem thấy email người khác đã che bớt', async () => {
    const list = await members(db.as(viewer));
    expect(list.find((m) => m.account_id === viewer.id)?.email).toBe(viewer.email);
    expect(list.find((m) => m.account_id === owner.id)?.email).toMatch(/^c\*\*\*@example\.com$/);
    expect((await members(db.as(editor))).find((m) => m.account_id === owner.id)?.email).toBe(owner.email);
  });
});
