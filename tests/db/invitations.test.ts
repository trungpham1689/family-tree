import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

type Invitation = { email: string; role: string; created_at: string };

describe('seam B: mời bằng email chưa có tài khoản', () => {
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

  const unique = (name: string) => `${name}-${crypto.randomUUID()}@example.com`;

  beforeEach(async () => {
    owner = await db.createUser(unique('chu'));
    me = db.as(owner);
    const [tree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
    await me.query("insert into persons (tree_id, full_name) values ($1, 'Thuỷ tổ')", [treeId]);
  });

  const invite = (email: string, role = 'editor') => me.rpc<string>('invite_to_tree', { target_tree: treeId, invite_email: email, new_role: role });
  const invitations = () => me.rpcRows<Invitation>('list_tree_pending_invites', { target_tree: treeId });

  it('email đã có tài khoản: cấp vai trò ngay, trả "added"', async () => {
    const existing = await db.createUser(unique('co-san'));
    expect(await invite(existing.email)).toBe('added');
    expect(await invitations()).toEqual([]);
    expect(await db.as(existing).query('select 1 from family_trees where id = $1', [treeId])).toHaveLength(1);
  });

  it('email chưa có tài khoản: lưu lời mời chờ, trả "pending", không phân biệt hoa thường và khoảng trắng', async () => {
    const address = unique('moi');
    expect(await invite(`  ${address.toUpperCase()} `)).toBe('pending');
    expect(await invitations()).toEqual([expect.objectContaining({ email: address, role: 'editor' })]);
  });

  it('mời lại cùng email: đổi vai trò, không thêm dòng', async () => {
    const address = unique('moi');
    await invite(address, 'editor');
    await invite(address, 'viewer');
    expect(await invitations()).toEqual([expect.objectContaining({ email: address, role: 'viewer' })]);
  });

  it('đăng ký bằng đúng email: nhận vai trò ngay, lời mời hết chờ, người mời được ghi nhận; chưa duyệt thì chưa thấy gia phả, duyệt xong thấy', async () => {
    const address = unique('moi');
    await invite(address, 'editor');

    const newcomer = await db.createUser(address, { approved: false });
    const [role] = await db.admin.query<{ role: string; invited_by: string | null }>(
      'select role, invited_by from tree_roles where tree_id = $1 and account_id = $2',
      [treeId, newcomer.id],
    ).then((result) => result.rows);
    expect(role).toEqual({ role: 'editor', invited_by: owner.id });
    expect(await invitations()).toEqual([]);

    // Chưa được duyệt: không thấy gia phả.
    expect(await db.as(newcomer).query('select 1 from family_trees where id = $1', [treeId])).toEqual([]);
    await db.admin.query('update public.account_approvals set approved = true where account_id = $1', [newcomer.id]);
    expect(await db.as(newcomer).query('select 1 from family_trees where id = $1', [treeId])).toHaveLength(1);
    // Vai trò Biên tập viên: thêm được Người.
    expect(await db.as(newcomer).query("insert into persons (tree_id, full_name) values ($1, 'Người mới') returning id", [treeId])).toHaveLength(1);
  });

  it('lời mời của nhiều gia phả cho cùng một email: đăng ký xong có đủ các gia phả', async () => {
    const address = unique('moi');
    const [other] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ Lê') returning id");
    await invite(address, 'viewer');
    await me.rpc('invite_to_tree', { target_tree: other!.id, invite_email: address, new_role: 'editor' });
    const newcomer = await db.createUser(address);
    const roles = (await db.admin.query<{ tree_id: string; role: string }>('select tree_id, role from tree_roles where account_id = $1', [newcomer.id])).rows;
    expect(roles.map((row) => [row.tree_id, row.role]).sort()).toEqual([[other!.id, 'editor'], [treeId, 'viewer']].sort());
  });

  it('huỷ lời mời: đăng ký sau đó không nhận được vai trò', async () => {
    const address = unique('moi');
    await invite(address);
    await me.rpc('cancel_tree_invitation', { target_tree: treeId, invite_email: address.toUpperCase() });
    expect(await invitations()).toEqual([]);
    const newcomer = await db.createUser(address);
    expect(await db.admin.query('select 1 from tree_roles where account_id = $1', [newcomer.id]).then((r) => r.rows)).toEqual([]);
  });

  it('chỉ Chủ sở hữu mời, xem, huỷ lời mời chờ; email sai bị từ chối; tối đa 50 lời mời chờ', async () => {
    const editor = await db.createUser(unique('bt'));
    await invite(editor.email);
    const asEditor = db.as(editor);
    await expect(asEditor.rpc('invite_to_tree', { target_tree: treeId, invite_email: unique('x'), new_role: 'viewer' })).rejects.toThrow(/NOT_ALLOWED/);
    await expect(asEditor.rpcRows('list_tree_pending_invites', { target_tree: treeId })).rejects.toThrow(/NOT_ALLOWED/);
    await expect(asEditor.rpc('cancel_tree_invitation', { target_tree: treeId, invite_email: 'a@b.co' })).rejects.toThrow(/NOT_ALLOWED/);

    await expect(invite('khong-phai-email')).rejects.toThrow(/INVALID_EMAIL/);
    await expect(invite('a b@c.de')).rejects.toThrow(/INVALID_EMAIL/);
    await expect(invite(unique('x'), 'owner')).rejects.toThrow(/INVALID_ROLE/);

    for (let i = 0; i < 49; i += 1) await db.admin.query("insert into public.tree_pending_invites (tree_id, email, role) values ($1, $2, 'viewer')", [treeId, `cho-${i}@example.com`]);
    await invite(unique('thu-50'));
    await expect(invite(unique('thu-51'))).rejects.toThrow(/TOO_MANY_INVITATIONS/);
    // Mời lại một email đã chờ vẫn được dù đã đủ 50.
    await invite('cho-0@example.com', 'editor');
  });

  it('không đọc ghi trực tiếp bảng lời mời được', async () => {
    await invite(unique('moi'));
    await expect(me.query('select * from tree_pending_invites')).rejects.toThrow();
    await expect(me.query("insert into tree_pending_invites (tree_id, email, role) values ($1, 'x@y.zz', 'viewer')", [treeId])).rejects.toThrow();
  });

  it('xoá gia phả thì lời mời chờ mất theo', async () => {
    await invite(unique('moi'));
    await me.query('delete from family_trees where id = $1', [treeId]);
    expect(await db.admin.query('select 1 from tree_pending_invites where tree_id = $1', [treeId]).then((r) => r.rows)).toEqual([]);
  });
});
