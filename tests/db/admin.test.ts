import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb, type TestUser } from './harness';

type AccountRow = { account_id: string; email: string; approved: boolean; is_superadmin: boolean; is_root: boolean; tree_count: number; is_banned: boolean };

describe('seam B: Quản trị tài khoản (siêu quản trị)', () => {
  let db: TestDb;
  let root: TestUser;

  beforeAll(async () => {
    db = await createTestDb();
    // Email gốc đăng ký: trigger tự duyệt và nâng thành siêu quản trị.
    root = await db.createUser('trungpham168@gmail.com', { approved: false });
  });

  afterAll(async () => {
    await db.close();
  });

  const newUser = (approved = false) => db.createUser(`qt-${crypto.randomUUID()}@example.com`, { approved });
  const list = (user: TestUser) => db.as(user).rpcRows<AccountRow>('admin_list_accounts');

  it('email gốc đăng ký xong là siêu quản trị đã duyệt; người khác thì không', async () => {
    const [mine] = await db.as(root).query<{ approved: boolean; is_superadmin: boolean }>('select approved, is_superadmin from account_approvals');
    expect(mine).toEqual({ approved: true, is_superadmin: true });
    const other = await newUser();
    const [theirs] = await db.as(other).query<{ is_superadmin: boolean }>('select is_superadmin from account_approvals');
    expect(theirs).toEqual({ is_superadmin: false });
  });

  it('chỉ siêu quản trị xem được danh sách tài khoản; người thường, chưa duyệt và khách đều bị chặn', async () => {
    const pending = await newUser();
    expect((await list(root)).map((row) => row.email)).toContain(pending.email);

    for (const caller of [await newUser(true), pending]) await expect(list(caller)).rejects.toThrow(/NOT_ALLOWED/);
    await expect(db.asAnon().rpcRows('admin_list_accounts')).rejects.toThrow();
  });

  it('danh sách có trạng thái, cờ gốc và số gia phả của mỗi tài khoản', async () => {
    const owner = await newUser(true);
    await db.as(owner).query("insert into family_trees (name) values ('Họ Phạm')");
    const rows = await list(root);
    expect(rows.find((row) => row.account_id === owner.id)).toMatchObject({ approved: true, is_superadmin: false, is_root: false, tree_count: 1 });
    expect(rows.find((row) => row.account_id === root.id)).toMatchObject({ approved: true, is_superadmin: true, is_root: true });
  });

  it('siêu quản trị duyệt rồi thu hồi: người đó dùng được rồi mất quyền ngay', async () => {
    const user = await newUser();
    await expect(db.as(user).query("insert into family_trees (name) values ('A')")).rejects.toThrow();
    await db.as(root).rpc('admin_set_approval', { target_account: user.id, new_approved: true });
    await db.as(user).query("insert into family_trees (name) values ('A')");
    await db.as(root).rpc('admin_set_approval', { target_account: user.id, new_approved: false });
    await expect(db.as(user).query("insert into family_trees (name) values ('B')")).rejects.toThrow();
  });

  it('người thường không tự duyệt, không duyệt người khác, không cấp quyền siêu quản trị cho mình', async () => {
    const user = await newUser(true);
    const pending = await newUser();
    await expect(db.as(user).rpc('admin_set_approval', { target_account: pending.id, new_approved: true })).rejects.toThrow(/NOT_ALLOWED/);
    await expect(db.as(user).rpc('admin_set_superadmin', { target_account: user.id, make_superadmin: true })).rejects.toThrow(/ROOT_ONLY/);
    await expect(db.as(user).query('update account_approvals set is_superadmin = true where account_id = $1', [user.id])).rejects.toThrow();
    const [row] = await db.admin.query<{ is_superadmin: boolean }>('select is_superadmin from account_approvals where account_id = $1', [user.id]).then((r) => r.rows);
    expect(row!.is_superadmin).toBe(false);
  });

  it('gốc cấp quyền siêu quản trị (tự duyệt luôn); siêu quản trị đó duyệt được nhưng không cấp quyền hay thu hồi gốc', async () => {
    const admin = await newUser();
    await db.as(root).rpc('admin_set_superadmin', { target_account: admin.id, make_superadmin: true });
    expect((await list(admin)).find((row) => row.account_id === admin.id)).toMatchObject({ approved: true, is_superadmin: true, is_root: false });

    const pending = await newUser();
    await db.as(admin).rpc('admin_set_approval', { target_account: pending.id, new_approved: true });
    await expect(db.as(admin).rpc('admin_set_superadmin', { target_account: pending.id, make_superadmin: true })).rejects.toThrow(/ROOT_ONLY/);
    await expect(db.as(admin).rpc('admin_set_approval', { target_account: root.id, new_approved: false })).rejects.toThrow(/SUPERADMIN_PROTECTED/);
  });

  it('không thu hồi được siêu quản trị khi chưa gỡ quyền; không gỡ được gốc; gỡ quyền rồi thì mất trang quản trị', async () => {
    const admin = await newUser();
    await db.as(root).rpc('admin_set_superadmin', { target_account: admin.id, make_superadmin: true });
    await expect(db.as(root).rpc('admin_set_approval', { target_account: admin.id, new_approved: false })).rejects.toThrow(/SUPERADMIN_PROTECTED/);
    await expect(db.as(root).rpc('admin_set_superadmin', { target_account: root.id, make_superadmin: false })).rejects.toThrow(/SUPERADMIN_PROTECTED/);

    await db.as(root).rpc('admin_set_superadmin', { target_account: admin.id, make_superadmin: false });
    await expect(list(admin)).rejects.toThrow(/NOT_ALLOWED/);
  });

  it('thu hồi duyệt của siêu quản trị bằng cách khác (sửa tay trong database) cũng làm họ mất quyền quản trị', async () => {
    const admin = await newUser();
    await db.as(root).rpc('admin_set_superadmin', { target_account: admin.id, make_superadmin: true });
    await db.admin.query('update account_approvals set approved = false where account_id = $1', [admin.id]);
    await expect(list(admin)).rejects.toThrow(/NOT_ALLOWED/);
  });

  it('tài khoản không tồn tại báo ACCOUNT_NOT_FOUND', async () => {
    await expect(db.as(root).rpc('admin_set_approval', { target_account: crypto.randomUUID(), new_approved: true })).rejects.toThrow(/ACCOUNT_NOT_FOUND/);
  });

  it('chặn: mất quyền dữ liệu ngay, hiện trạng thái bị chặn, không duyệt lại được khi còn chặn; bỏ chặn thì về chờ duyệt', async () => {
    const user = await newUser(true);
    const [tree] = await db.as(user).query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    await db.as(root).rpc('admin_set_banned', { target_account: user.id, new_banned: true });

    expect(await db.as(user).query('select id from family_trees where id = $1', [tree!.id])).toHaveLength(0);
    expect((await list(root)).find((row) => row.account_id === user.id)).toMatchObject({ approved: false, is_banned: true });
    await expect(db.as(root).rpc('admin_set_approval', { target_account: user.id, new_approved: true })).rejects.toThrow(/ACCOUNT_BANNED/);

    await db.as(root).rpc('admin_set_banned', { target_account: user.id, new_banned: false });
    expect((await list(root)).find((row) => row.account_id === user.id)).toMatchObject({ approved: false, is_banned: false });
    await db.as(root).rpc('admin_set_approval', { target_account: user.id, new_approved: true });
    expect(await db.as(user).query('select id from family_trees where id = $1', [tree!.id])).toHaveLength(1);
  });

  it('xoá tài khoản: xoá hẳn người chưa có gia phả; chặn xoá chủ gia phả, siêu quản trị, và người thường không gọi được', async () => {
    const spam = await newUser();
    await db.as(root).rpc('admin_delete_account', { target_account: spam.id });
    expect((await list(root)).some((row) => row.account_id === spam.id)).toBe(false);
    expect(await db.admin.query('select 1 from auth.users where id = $1', [spam.id]).then((r) => r.rows)).toHaveLength(0);

    const owner = await newUser(true);
    await db.as(owner).query("insert into family_trees (name) values ('Họ Lê')");
    await expect(db.as(root).rpc('admin_delete_account', { target_account: owner.id })).rejects.toThrow(/ACCOUNT_OWNS_TREES/);

    const admin = await newUser();
    await db.as(root).rpc('admin_set_superadmin', { target_account: admin.id, make_superadmin: true });
    await expect(db.as(root).rpc('admin_delete_account', { target_account: admin.id })).rejects.toThrow(/SUPERADMIN_PROTECTED/);
    await expect(db.as(root).rpc('admin_delete_account', { target_account: root.id })).rejects.toThrow(/SUPERADMIN_PROTECTED/);
    await expect(db.as(root).rpc('admin_set_banned', { target_account: root.id, new_banned: true })).rejects.toThrow(/SUPERADMIN_PROTECTED/);

    const plain = await newUser(true);
    const victim = await newUser();
    await expect(db.as(plain).rpc('admin_delete_account', { target_account: victim.id })).rejects.toThrow(/NOT_ALLOWED/);
    await expect(db.as(plain).rpc('admin_set_banned', { target_account: victim.id, new_banned: true })).rejects.toThrow(/NOT_ALLOWED/);
  });
});
