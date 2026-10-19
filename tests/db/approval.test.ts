import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

describe('seam B: Duyệt tài khoản', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  const newUser = (approved: boolean) => db.createUser(`tk-${crypto.randomUUID()}@example.com`, { approved });

  it('tài khoản mới chưa duyệt: thấy trạng thái của mình, không tạo được gia phả', async () => {
    const user = await newUser(false);
    const rows = await db.as(user).query<{ approved: boolean; email: string }>('select approved, email from account_approvals');
    expect(rows).toEqual([{ approved: false, email: user.email }]);

    await expect(db.as(user).query("insert into family_trees (name) values ('Họ Phạm')")).rejects.toThrow();
  });

  it('chỉ thấy dòng duyệt của chính mình và không tự duyệt được', async () => {
    const pending = await newUser(false);
    const other = await newUser(false);
    expect(await db.as(pending).query('select 1 from account_approvals where account_id = $1', [other.id])).toHaveLength(0);

    await expect(db.as(pending).query('update account_approvals set approved = true where account_id = $1', [pending.id])).rejects.toThrow();
    await expect(db.as(pending).query('insert into account_approvals (account_id, approved) values ($1, true)', [crypto.randomUUID()])).rejects.toThrow();
  });

  it('được duyệt rồi thì dùng được; thu hồi duyệt thì mất quyền ngay, cả với gia phả đã có', async () => {
    const user = await newUser(false);
    await db.admin.query('update account_approvals set approved = true where account_id = $1', [user.id]);
    const [tree] = await db.as(user).query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");

    const [stamped] = await db.admin.query<{ approved_at: string | null }>('select approved_at from account_approvals where account_id = $1', [user.id]).then((r) => r.rows);
    expect(stamped!.approved_at).not.toBeNull();

    await db.admin.query('update account_approvals set approved = false where account_id = $1', [user.id]);
    expect(await db.as(user).query('select id from family_trees where id = $1', [tree!.id])).toHaveLength(0);
    expect(await db.as(user).query<{ ok: boolean }>('select public.can_view_tree($1) as ok', [tree!.id])).toEqual([{ ok: false }]);
  });

  it('được mời vào gia phả mà chưa duyệt thì vẫn không thấy gì', async () => {
    const owner = await newUser(true);
    const invitee = await newUser(false);
    const [tree] = await db.as(owner).query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    await db.as(owner).rpc('invite_to_tree', { target_tree: tree!.id, invite_email: invitee.email, new_role: 'editor' });

    expect(await db.as(invitee).query('select id from family_trees where id = $1', [tree!.id])).toHaveLength(0);
    await db.admin.query('update account_approvals set approved = true where account_id = $1', [invitee.id]);
    expect(await db.as(invitee).query('select id from family_trees where id = $1', [tree!.id])).toHaveLength(1);
  });
});
