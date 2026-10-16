import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb, type TestUser } from './harness';

describe('seam B: cấu hình Phả đồ', () => {
  let db: TestDb;
  let owner: TestUser;
  let viewer: TestUser;
  let treeId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    owner = await db.createUser(`chu-${crypto.randomUUID()}@example.com`);
    viewer = await db.createUser(`xem-${crypto.randomUUID()}@example.com`);
    const [tree] = await db.as(owner).query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
    await db.admin.query("insert into tree_roles (tree_id, account_id, role) values ($1, $2, 'viewer')", [treeId, viewer.id]);
  });

  const save = (user: TestUser, config: object) =>
    db
      .as(user)
      .query(
        `insert into pha_do_configs (tree_id, config) values ($1, $2)
         on conflict (tree_id) do update set config = excluded.config`,
        [treeId, JSON.stringify(config)],
      );

  it('Biên tập viên lưu và mở lại đúng cấu hình; ai có vai trò cũng đọc được', async () => {
    await save(owner, { paper: 'A0', orientation: 'portrait' });
    await save(owner, { paper: 'A2', orientation: 'landscape', extraLines: ['gio'] });
    const rows = await db.as(viewer).query<{ config: unknown }>('select config from pha_do_configs where tree_id = $1', [treeId]);
    expect(rows).toEqual([{ config: { paper: 'A2', orientation: 'landscape', extraLines: ['gio'] } }]);
  });

  it('Người xem và người ngoài không lưu được', async () => {
    await expect(save(viewer, { paper: 'A0' })).rejects.toThrow();
    const stranger = await db.createUser(`la-${crypto.randomUUID()}@example.com`);
    await expect(save(stranger, { paper: 'A0' })).rejects.toThrow();
    expect(await db.as(stranger).query('select * from pha_do_configs')).toEqual([]);
  });

  it('chỉ nhận object JSON', async () => {
    await expect(
      db.as(owner).query('insert into pha_do_configs (tree_id, config) values ($1, $2)', [treeId, JSON.stringify([1, 2])]),
    ).rejects.toThrow();
  });
});
