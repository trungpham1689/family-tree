import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb, type TestUser } from './harness';

type EventRow = { id: string; tree_id: string; title: string };

describe('seam B: Sự kiện của Gia phả', () => {
  let db: TestDb;
  let owner: TestUser;
  let viewer: TestUser;
  let stranger: TestUser;
  let treeId: string;
  let otherTreeId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  const unique = (name: string) => `${name}-${crypto.randomUUID()}@example.com`;

  beforeEach(async () => {
    owner = await db.createUser(unique('chu'));
    viewer = await db.createUser(unique('xem'));
    stranger = await db.createUser(unique('la'));
    const [tree] = await db.as(owner).query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
    const [other] = await db.as(stranger).query<{ id: string }>("insert into family_trees (name) values ('Họ Lê') returning id");
    otherTreeId = other!.id;
    await db.admin.query("insert into tree_roles (tree_id, account_id, role) values ($1, $2, 'viewer')", [treeId, viewer.id]);
  });

  const addEvent = (user: TestUser, tree: string, title: string) =>
    db
      .as(user)
      .query<EventRow>(
        "insert into tree_events (tree_id, title, calendar, month, day) values ($1, $2, 'am', 1, 10) returning id, tree_id, title",
        [tree, title],
      );

  it('Biên tập viên tạo sự kiện; ai có vai trò cũng thấy', async () => {
    await addEvent(owner, treeId, 'Họp họ đầu xuân');
    expect((await db.as(viewer).query<EventRow>('select title from tree_events')).map((e) => e.title)).toEqual(['Họp họ đầu xuân']);
  });

  it('tài khoản chỉ thấy sự kiện của Gia phả mình có vai trò', async () => {
    await addEvent(owner, treeId, 'Của họ Phạm');
    await addEvent(stranger, otherTreeId, 'Của họ Lê');
    expect((await db.as(owner).query<EventRow>('select title from tree_events')).map((e) => e.title)).toEqual(['Của họ Phạm']);
    expect((await db.as(stranger).query<EventRow>('select title from tree_events')).map((e) => e.title)).toEqual(['Của họ Lê']);
    expect(await db.asAnon().query('select * from tree_events').catch(() => [])).toEqual([]);
  });

  it('Người xem không tạo, sửa, xoá được sự kiện', async () => {
    const [event] = await addEvent(owner, treeId, 'Giỗ tổ');
    await expect(addEvent(viewer, treeId, 'Lén thêm')).rejects.toThrow();
    await db.as(viewer).query("update tree_events set title = 'Bị sửa' where id = $1", [event!.id]);
    await db.as(viewer).query('delete from tree_events where id = $1', [event!.id]);
    expect((await db.admin.query<EventRow>('select title from tree_events where id = $1', [event!.id])).rows).toEqual([
      { title: 'Giỗ tổ' },
    ]);
  });

  it('Biên tập viên sửa và xoá được', async () => {
    const [event] = await addEvent(owner, treeId, 'Họp họ');
    await db.as(owner).query("update tree_events set title = 'Họp họ cuối năm' where id = $1", [event!.id]);
    expect((await db.as(owner).query<EventRow>('select title from tree_events'))[0]?.title).toBe('Họp họ cuối năm');
    await db.as(owner).query('delete from tree_events where id = $1', [event!.id]);
    expect(await db.as(owner).query('select * from tree_events')).toEqual([]);
  });

  it('sự kiện một lần phải có năm; tháng nhuận chỉ có ở âm lịch', async () => {
    await expect(
      db.as(owner).query("insert into tree_events (tree_id, title, month, day, repeats_yearly) values ($1, 'Thiếu năm', 5, 1, false)", [treeId]),
    ).rejects.toThrow();
    await expect(
      db.as(owner).query("insert into tree_events (tree_id, title, calendar, month, day, leap) values ($1, 'Sai', 'duong', 5, 1, true)", [treeId]),
    ).rejects.toThrow();
    await db.as(owner).query(
      "insert into tree_events (tree_id, title, month, day, repeats_yearly, year, start_time, location) values ($1, 'Khánh thành nhà thờ họ', 12, 20, false, 2026, '08:30', 'Nhà thờ họ')",
      [treeId],
    );
  });
});
