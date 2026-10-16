import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

describe('seam B: danh tính người gọi', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it('nhận ra tài khoản đã đăng nhập', async () => {
    const an = await db.createUser('an@example.com');

    const [row] = await db.as(an).query<{ uid: string; role: string }>(
      'select auth.uid() as uid, current_user as role',
    );

    expect(row).toEqual({ uid: an.id, role: 'authenticated' });
  });

  it('người chưa đăng nhập không có danh tính', async () => {
    const [row] = await db.asAnon().query<{ uid: string | null; role: string }>(
      'select auth.uid() as uid, current_user as role',
    );

    expect(row).toEqual({ uid: null, role: 'anon' });
  });

  it('người chưa đăng nhập không đọc được danh sách tài khoản', async () => {
    await expect(db.asAnon().query('select * from auth.users')).rejects.toThrow(/permission denied/);
  });
});
