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

  it('Biên tập viên không mời được người khác', async () => {
    const editor = await db.createUser(`bt-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: editor.email, new_role: 'editor' });

    const friend = await db.createUser(`ban-${crypto.randomUUID()}@example.com`);
    await expect(
      db.as(editor).rpc('invite_to_tree', { target_tree: treeId, invite_email: friend.email, new_role: 'viewer' }),
    ).rejects.toThrow(/NOT_ALLOWED/);
  });

  it('Người xem không mời được ai', async () => {
    const viewer = await db.createUser(`xem-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: viewer.email, new_role: 'viewer' });

    const other = await db.createUser(`khac-${crypto.randomUUID()}@example.com`);
    await expect(
      db.as(viewer).rpc('invite_to_tree', { target_tree: treeId, invite_email: other.email, new_role: 'viewer' }),
    ).rejects.toThrow(/NOT_ALLOWED/);
  });

  it('mời email chưa có tài khoản không lỗi: lưu lời mời chờ đăng ký (xem invitations.test.ts)', async () => {
    expect(await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: 'chua-dang-ky@example.com', new_role: 'editor' })).toBe('pending');
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

  it('Chủ sở hữu chuyển quyền cho Biên tập viên: người nhận làm Chủ sở hữu, mình lùi về Biên tập viên', async () => {
    const heir = await db.createUser(`ke-nhiem-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: heir.email, new_role: 'editor' });

    await me.rpc('transfer_tree_ownership', { target_tree: treeId, target_account: heir.id });

    const list = await members();
    expect(list.find((row) => row.account_id === heir.id)).toMatchObject({ role: 'owner' });
    expect(list.find((row) => row.account_id === owner.id)).toMatchObject({ role: 'editor' });
    const [tree] = await db.as(heir).query<{ owner_id: string }>('select owner_id from family_trees where id = $1', [treeId]);
    expect(tree!.owner_id).toBe(heir.id);
    // Chủ sở hữu cũ hết quyền Chủ sở hữu; người mới làm được việc của Chủ sở hữu.
    await expect(me.rpc('remove_tree_role', { target_tree: treeId, target_account: heir.id })).rejects.toThrow(/NOT_ALLOWED/);
    await db.as(heir).rpc('update_tree_role', { target_tree: treeId, target_account: owner.id, new_role: 'viewer' });
  });

  it('chỉ chuyển được cho Biên tập viên, và chỉ Chủ sở hữu mới chuyển', async () => {
    const viewer = await db.createUser(`xem-${crypto.randomUUID()}@example.com`);
    const editor = await db.createUser(`bt-${crypto.randomUUID()}@example.com`);
    const stranger = await db.createUser(`la-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: viewer.email, new_role: 'viewer' });
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: editor.email, new_role: 'editor' });

    await expect(me.rpc('transfer_tree_ownership', { target_tree: treeId, target_account: viewer.id })).rejects.toThrow(/NEW_OWNER_NOT_EDITOR/);
    await expect(me.rpc('transfer_tree_ownership', { target_tree: treeId, target_account: stranger.id })).rejects.toThrow(/NEW_OWNER_NOT_EDITOR/);
    await expect(me.rpc('transfer_tree_ownership', { target_tree: treeId, target_account: owner.id })).rejects.toThrow(/NEW_OWNER_NOT_EDITOR/);
    await expect(
      db.as(editor).rpc('transfer_tree_ownership', { target_tree: treeId, target_account: editor.id }),
    ).rejects.toThrow(/NOT_ALLOWED/);
    expect((await members()).find((row) => row.account_id === owner.id)).toMatchObject({ role: 'owner' });
  });

  it('không chuyển cho tài khoản chưa duyệt hoặc bị chặn', async () => {
    const pending = await db.createUser(`cho-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: pending.email, new_role: 'editor' });
    await db.admin.query('update account_approvals set approved = false where account_id = $1', [pending.id]);

    await expect(me.rpc('transfer_tree_ownership', { target_tree: treeId, target_account: pending.id })).rejects.toThrow(/NEW_OWNER_NOT_APPROVED/);
    expect((await members()).find((row) => row.account_id === owner.id)).toMatchObject({ role: 'owner' });
  });

  it('không chuyển cho người đã sở hữu đủ số gia phả', async () => {
    const busy = await db.createUser(`nhieu-${crypto.randomUUID()}@example.com`);
    for (const name of ['Một', 'Hai', 'Ba']) await db.as(busy).query('insert into family_trees (name) values ($1)', [name]);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: busy.email, new_role: 'editor' });

    await expect(me.rpc('transfer_tree_ownership', { target_tree: treeId, target_account: busy.id })).rejects.toThrow(/NEW_OWNER_TREE_LIMIT/);
  });

  it('người không có vai trò không xem được danh sách', async () => {
    const stranger = await db.createUser(`la-${crypto.randomUUID()}@example.com`);
    await expect(members(db.as(stranger))).rejects.toThrow(/NOT_ALLOWED/);
    await expect(members(db.asAnon())).rejects.toThrow();
  });
});
