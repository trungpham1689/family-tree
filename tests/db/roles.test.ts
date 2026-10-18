import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

type Member = { account_id: string; role: string; email: string; created_at: string };

describe('seam B: mời vai trò Biên tập viên / Người xem', () => {
  let db: TestDb;
  let owner: TestUser;
  let me: Caller;
  let treeId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    owner = await db.createUser(`chu-${crypto.randomUUID()}@example.com`);
    me = db.as(owner);
    const [tree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm làng Đông') returning id");
    treeId = tree!.id;
  });

  const members = (caller: Caller = me) => caller.rpcRows<Member>('list_tree_members', { target_tree: treeId });

  it('Chủ sở hữu mời một tài khoản đã có làm Biên tập viên', async () => {
    const friend = await db.createUser(`ban-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: friend.email, new_role: 'editor' });

    const list = await members();
    expect(list).toContainEqual(expect.objectContaining({ account_id: friend.id, role: 'editor', email: friend.email }));
    expect(list.find((row) => row.account_id === owner.id)).toMatchObject({ role: 'owner' });
  });

  it('mời lại cùng email thì đổi vai trò, không tạo dòng mới', async () => {
    const friend = await db.createUser(`ban-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: friend.email, new_role: 'viewer' });
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: friend.email, new_role: 'editor' });

    const list = await members();
    expect(list.filter((row) => row.account_id === friend.id)).toHaveLength(1);
    expect(list.find((row) => row.account_id === friend.id)).toMatchObject({ role: 'editor' });
  });

  it('Biên tập viên cũng mời được người khác', async () => {
    const editor = await db.createUser(`bt-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: editor.email, new_role: 'editor' });

    const friend = await db.createUser(`ban-${crypto.randomUUID()}@example.com`);
    await db.as(editor).rpc('invite_to_tree', { target_tree: treeId, invite_email: friend.email, new_role: 'viewer' });

    expect(await members()).toContainEqual(expect.objectContaining({ account_id: friend.id, role: 'viewer' }));
  });

  it('Người xem không mời được ai', async () => {
    const viewer = await db.createUser(`xem-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: viewer.email, new_role: 'viewer' });

    const other = await db.createUser(`khac-${crypto.randomUUID()}@example.com`);
    await expect(
      db.as(viewer).rpc('invite_to_tree', { target_tree: treeId, invite_email: other.email, new_role: 'viewer' }),
    ).rejects.toThrow(/NOT_ALLOWED/);
  });

  it('mời email chưa có tài khoản báo lỗi rõ ràng', async () => {
    await expect(
      me.rpc('invite_to_tree', { target_tree: treeId, invite_email: 'chua-dang-ky@example.com', new_role: 'editor' }),
    ).rejects.toThrow(/ACCOUNT_NOT_FOUND/);
  });

  it('không mời được với vai trò ngoài editor/viewer', async () => {
    const friend = await db.createUser(`ban-${crypto.randomUUID()}@example.com`);
    await expect(
      me.rpc('invite_to_tree', { target_tree: treeId, invite_email: friend.email, new_role: 'owner' }),
    ).rejects.toThrow(/INVALID_ROLE/);
  });

  it('không mời lại chính Chủ sở hữu', async () => {
    await expect(
      me.rpc('invite_to_tree', { target_tree: treeId, invite_email: owner.email, new_role: 'editor' }),
    ).rejects.toThrow(/ALREADY_OWNER/);
  });

  it('Chủ sở hữu đổi vai trò và gỡ quyền; người khác không được', async () => {
    const friend = await db.createUser(`ban-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: friend.email, new_role: 'viewer' });

    await me.rpc('update_tree_role', { target_tree: treeId, target_account: friend.id, new_role: 'editor' });
    expect(await members()).toContainEqual(expect.objectContaining({ account_id: friend.id, role: 'editor' }));

    await expect(
      db.as(friend).rpc('update_tree_role', { target_tree: treeId, target_account: friend.id, new_role: 'viewer' }),
    ).rejects.toThrow(/NOT_ALLOWED/);

    await me.rpc('remove_tree_role', { target_tree: treeId, target_account: friend.id });
    expect(await members()).not.toContainEqual(expect.objectContaining({ account_id: friend.id }));
  });

  it('không đổi được hay gỡ được vai trò Chủ sở hữu', async () => {
    await expect(
      me.rpc('update_tree_role', { target_tree: treeId, target_account: owner.id, new_role: 'editor' }),
    ).rejects.toThrow(/CANNOT_CHANGE_OWNER/);
    await expect(me.rpc('remove_tree_role', { target_tree: treeId, target_account: owner.id })).rejects.toThrow(
      /CANNOT_CHANGE_OWNER/,
    );
  });

  it('người không có vai trò không xem được danh sách', async () => {
    const stranger = await db.createUser(`la-${crypto.randomUUID()}@example.com`);
    await expect(members(db.as(stranger))).rejects.toThrow(/NOT_ALLOWED/);
    await expect(members(db.asAnon())).rejects.toThrow();
  });
});
