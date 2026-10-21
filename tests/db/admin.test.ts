import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb, type TestUser } from './harness';

type Inviter = { account_id: string; email: string; full_name: string | null };
type AccountRow = {
  account_id: string;
  email: string;
  full_name: string | null;
  birth_date: string | null;
  phone: string | null;
  approved: boolean;
  is_superadmin: boolean;
  is_root: boolean;
  tree_count: number;
  is_banned: boolean;
  invited_by: Inviter[];
  total_count: number;
};

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
  const list = (user: TestUser, args: Record<string, unknown> = {}) =>
    db.as(user).rpcRows<AccountRow>('admin_list_accounts', { page_size: 100, ...args });

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

  it('duyệt tài khoản cũng xác nhận email của họ (khỏi kẹt email_not_confirmed khi project bật Confirm email)', async () => {
    const user = await newUser();
    const confirmed = () => db.admin.query<{ email_confirmed_at: string | null }>('select email_confirmed_at from auth.users where id = $1', [user.id]).then((r) => r.rows[0]!.email_confirmed_at);
    expect(await confirmed()).toBeNull();
    await db.as(root).rpc('admin_set_approval', { target_account: user.id, new_approved: true });
    expect(await confirmed()).not.toBeNull();
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
  it('đăng ký bắt buộc họ và tên, ngày sinh, số điện thoại hợp lệ; thiếu hoặc sai thì database từ chối', async () => {
    const attempt = (email: string, profile: Record<string, string> | null) => db.createUser(email, { profile });
    const ok = { full_name: 'Phạm Văn A', birth_date: '1985-03-20', phone: '+84 901 234 567' };
    await expect(attempt('thieu-1@example.com', null)).rejects.toThrow(/PROFILE_REQUIRED/);
    await expect(attempt('thieu-2@example.com', { ...ok, full_name: '  ' })).rejects.toThrow(/PROFILE_REQUIRED/);
    await expect(attempt('thieu-3@example.com', { ...ok, phone: '' })).rejects.toThrow(/PROFILE_REQUIRED/);
    await expect(attempt('thieu-4@example.com', { ...ok, birth_date: '' })).rejects.toThrow(/PROFILE_REQUIRED/);
    await expect(attempt('sai-1@example.com', { ...ok, birth_date: 'hôm qua' })).rejects.toThrow(/PROFILE_INVALID/);
    await expect(attempt('sai-2@example.com', { ...ok, birth_date: '2999-01-01' })).rejects.toThrow(/PROFILE_INVALID/);
    await expect(attempt('sai-3@example.com', { ...ok, phone: '12ab' })).rejects.toThrow(/PROFILE_INVALID/);

    const user = await attempt('dung@example.com', ok);
    expect((await list(root, { search: 'dung@example.com' }))[0]).toMatchObject({
      full_name: 'Phạm Văn A',
      birth_date: '1985-03-20',
      phone: '+84 901 234 567',
    });
    expect(user.email).toBe('dung@example.com');
  });

  it('danh sách ghi người đã mời: mời vào gia phả nào thì người mời hiện ra; tự đăng ký thì để trống; đổi vai trò giữ người mời cũ', async () => {
    const owner = await db.createUser(`chu-${crypto.randomUUID()}@example.com`, { profile: { full_name: 'Chủ Họ', birth_date: '1970-01-01', phone: '0911111111' } });
    const guest = await newUser(true);
    const [tree] = await db.as(owner).query<{ id: string }>("insert into family_trees (name) values ('Họ Mời') returning id");
    await db.as(owner).rpc('invite_to_tree', { target_tree: tree!.id, invite_email: guest.email, new_role: 'viewer' });
    await db.as(owner).rpc('invite_to_tree', { target_tree: tree!.id, invite_email: guest.email, new_role: 'editor' });

    const rows = await list(root);
    expect(rows.find((row) => row.account_id === guest.id)!.invited_by).toEqual([
      { account_id: owner.id, email: owner.email, full_name: 'Chủ Họ' },
    ]);
    expect(rows.find((row) => row.account_id === owner.id)!.invited_by).toEqual([]);
  });

  it('phân trang và tìm kiếm ở database: tổng khớp bộ lọc, trang không trùng, đếm tab riêng', async () => {
    const tag = crypto.randomUUID().slice(0, 8);
    for (let index = 0; index < 5; index += 1) {
      await db.createUser(`phan-trang-${tag}-${index}@example.com`, {
        approved: index % 2 === 0,
        profile: { full_name: `Trang ${tag} số ${index}`, birth_date: '1990-01-01', phone: `090000000${index}` },
      });
    }
    const first = await list(root, { search: tag, page_size: 2, page_offset: 0 });
    const second = await list(root, { search: tag, page_size: 2, page_offset: 2 });
    const last = await list(root, { search: tag, page_size: 2, page_offset: 4 });
    expect([first.length, second.length, last.length]).toEqual([2, 2, 1]);
    expect(first[0]!.total_count).toBe(5);
    expect(new Set([...first, ...second, ...last].map((row) => row.account_id)).size).toBe(5);

    const pending = await list(root, { search: tag, status_filter: 'pending' });
    const approved = await list(root, { search: tag, status_filter: 'approved' });
    expect([pending.length, approved.length]).toEqual([2, 3]);
    expect(pending.every((row) => !row.approved) && approved.every((row) => row.approved)).toBe(true);

    expect(await list(root, { search: `số 3` }).then((rows) => rows.some((row) => row.full_name === `Trang ${tag} số 3`))).toBe(true);
    expect(await list(root, { search: '%' })).toHaveLength(0);

    const counts = await db.as(root).rpcRows<{ total_count: number; pending_count: number; i_am_root: boolean }>('admin_account_counts');
    const all = await list(root, { page_size: 100 });
    expect(counts[0]).toMatchObject({ total_count: all.length, i_am_root: true });
    expect(counts[0]!.pending_count).toBe(all.filter((row) => !row.approved).length);

    const plain = await newUser(true);
    await expect(db.as(plain).rpcRows('admin_account_counts')).rejects.toThrow(/NOT_ALLOWED/);
  });

  it('sửa hồ sơ: người dùng sửa của mình, siêu quản trị sửa của người khác, người thường không sửa được của người khác; dữ liệu sai bị từ chối', async () => {
    const alice = await newUser(true);
    const bob = await newUser(true);
    const profile = async (user: TestUser) =>
      (await db.admin.query<{ full_name: string; birth_date: string; phone: string }>(
        'select full_name, birth_date::text as birth_date, phone from account_approvals where account_id = $1',
        [user.id],
      )).rows[0];

    await db.as(alice).rpc('update_my_profile', { new_name: '  Nguyễn An ', new_birth: '1985-03-20', new_phone: '0912 345 678' });
    expect(await profile(alice)).toEqual({ full_name: 'Nguyễn An', birth_date: '1985-03-20', phone: '0912 345 678' });

    await db.as(root).rpc('admin_update_profile', { target_account: bob.id, new_name: 'Trần Bình', new_birth: '1970-01-02', new_phone: '0987654321' });
    expect(await profile(bob)).toMatchObject({ full_name: 'Trần Bình' });

    await expect(db.as(alice).rpc('admin_update_profile', { target_account: bob.id, new_name: 'X', new_birth: '1970-01-02', new_phone: '0987654321' })).rejects.toThrow(/NOT_ALLOWED/);
    await expect(db.as(alice).rpc('update_my_profile', { new_name: '', new_birth: '1985-03-20', new_phone: '0912345678' })).rejects.toThrow(/PROFILE_REQUIRED/);
    await expect(db.as(alice).rpc('update_my_profile', { new_name: 'An', new_birth: '2999-01-01', new_phone: '0912345678' })).rejects.toThrow(/PROFILE_INVALID/);
    await expect(db.as(alice).rpc('update_my_profile', { new_name: 'An', new_birth: '1985-03-20', new_phone: 'abc' })).rejects.toThrow(/PROFILE_INVALID/);
    await expect(db.as(root).rpc('admin_update_profile', { target_account: crypto.randomUUID(), new_name: 'An', new_birth: '1985-03-20', new_phone: '0912345678' })).rejects.toThrow(/ACCOUNT_NOT_FOUND/);
  });
});
