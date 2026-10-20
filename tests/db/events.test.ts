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

  describe('lặp hằng tháng, chủ trì, hiển thị trong Phả ký / Dòng thời gian', () => {
    const insert = (user: TestUser, columns: string, values: string, params: unknown[] = []) =>
      db.as(user).query<EventRow>(`insert into tree_events (tree_id, title, ${columns}) values ($1, 'Sự kiện', ${values}) returning id, tree_id, title`, [treeId, ...params]);

    it('hằng tháng không cần tháng; không đi cùng hằng năm, tháng nhuận hay thiếu tháng khi không phải hằng tháng', async () => {
      await insert(owner, 'day, repeats_yearly, repeats_monthly', '1, false, true');
      await expect(insert(owner, 'month, day, repeats_yearly, repeats_monthly', '1, 1, true, true')).rejects.toThrow();
      await expect(insert(owner, "calendar, day, leap, repeats_yearly, repeats_monthly", "'am', 1, true, false, true")).rejects.toThrow();
      await expect(insert(owner, 'day', '1')).rejects.toThrow(); // hằng năm mà thiếu tháng
    });

    it('chọn đưa vào Dòng thời gian thì phải có năm; Phả ký không cần', async () => {
      await expect(insert(owner, 'month, day, show_in_timeline', '1, 1, true')).rejects.toThrow();
      await insert(owner, 'month, day, year, show_in_timeline', '1, 1, 2020, true');
      await insert(owner, 'month, day, show_in_pha_ky', '1, 1, true');
    });

    it('người chủ trì phải cùng gia phả; xoá người đó thì chỉ bỏ chủ trì, không mất sự kiện', async () => {
      const [mine] = await db.as(owner).query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Chủ trì') returning id", [treeId]);
      const [foreign] = await db.as(stranger).query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Người lạ') returning id", [otherTreeId]);
      await expect(insert(owner, 'month, day, host_person_id', '1, 1, $2', [foreign!.id])).rejects.toThrow(/EVENT_HOST_INVALID/);
      const [event] = await insert(owner, 'month, day, host_person_id', '1, 1, $2', [mine!.id]);
      await db.admin.query('delete from persons where id = $1', [mine!.id]);
      expect((await db.admin.query<{ host_person_id: string | null }>('select host_person_id from tree_events where id = $1', [event!.id])).rows[0]).toEqual({ host_person_id: null });
    });

    it('lịch đăng ký trả cả sự kiện hằng tháng', async () => {
      await insert(owner, 'day, repeats_yearly, repeats_monthly', '5, false, true');
      const token = await db.as(owner).rpc<string>('rotate_calendar_feed');
      const feed = await db.asAnon().rpc<{ events: { repeats_monthly: boolean; month: number | null }[] }>('calendar_feed', { token });
      expect(feed.events).toEqual([expect.objectContaining({ repeats_monthly: true, month: null })]);
    });
  });

  describe('ảnh sự kiện', () => {
    let editor: TestUser;
    const addPhoto = (user: TestUser, eventId: string, name: string, tree = treeId) =>
      db.as(user).query('insert into event_photos (event_id, storage_path) values ($1, $2)', [eventId, `${tree}/${name}`]);

    beforeEach(async () => {
      editor = await db.createUser(unique('bt'));
      await db.admin.query("insert into tree_roles (tree_id, account_id, role) values ($1, $2, 'editor')", [treeId, editor.id]);
    });

    it('tối đa 5 ảnh mỗi sự kiện; đường dẫn phải thuộc đúng gia phả', async () => {
      const [event] = await addEvent(owner, treeId, 'Họp họ');
      for (let index = 1; index <= 5; index += 1) await addPhoto(owner, event!.id, `anh${index}`);
      await expect(addPhoto(owner, event!.id, 'anh6')).rejects.toThrow(/EVENT_PHOTO_LIMIT_REACHED/);
      const [another] = await addEvent(owner, treeId, 'Họp khác');
      await expect(addPhoto(owner, another!.id, 'anh1', otherTreeId)).rejects.toThrow(/PHOTO_PATH_INVALID/);
      await addPhoto(owner, another!.id, 'anh1');
    });

    it('chỉ Chủ sở hữu hoặc Biên tập viên đã tạo sự kiện thêm/xoá ảnh; người xem chỉ xem; không sửa được đường dẫn', async () => {
      const [mine] = await addEvent(editor, treeId, 'Của biên tập viên');
      const [ownersEvent] = await addEvent(owner, treeId, 'Của chủ');
      await addPhoto(editor, mine!.id, 'a1');
      await expect(addPhoto(editor, ownersEvent!.id, 'b1')).rejects.toThrow();
      await expect(addPhoto(viewer, mine!.id, 'c1')).rejects.toThrow();
      await addPhoto(owner, mine!.id, 'a2'); // Chủ sở hữu thêm được vào sự kiện của người khác

      expect(await db.as(viewer).query('select 1 from event_photos where event_id = $1', [mine!.id])).toHaveLength(2);
      expect(await db.as(stranger).query('select 1 from event_photos where event_id = $1', [mine!.id])).toHaveLength(0);

      await expect(db.as(editor).query("update event_photos set storage_path = $1 where event_id = $2", [`${treeId}/x`, mine!.id])).rejects.toThrow();
      await db.as(viewer).query('delete from event_photos where event_id = $1', [mine!.id]);
      expect(await db.as(owner).query('select 1 from event_photos where event_id = $1', [mine!.id])).toHaveLength(2);
      await db.as(editor).query('delete from event_photos where event_id = $1', [mine!.id]);
      expect(await db.as(owner).query('select 1 from event_photos where event_id = $1', [mine!.id])).toHaveLength(0);
    });

    it('hàm can_edit_event khớp quyền sửa sự kiện; xoá sự kiện kéo theo xoá ảnh', async () => {
      const [mine] = await addEvent(editor, treeId, 'Của biên tập viên');
      await addPhoto(editor, mine!.id, 'a1');
      expect(await db.as(editor).rpc('can_edit_event', { target_event: mine!.id })).toBe(true);
      expect(await db.as(owner).rpc('can_edit_event', { target_event: mine!.id })).toBe(true);
      expect(await db.as(viewer).rpc('can_edit_event', { target_event: mine!.id })).toBe(false);
      expect(await db.as(stranger).rpc('can_edit_event', { target_event: mine!.id })).toBe(false);
      await db.as(editor).query('delete from tree_events where id = $1', [mine!.id]);
      expect((await db.admin.query('select 1 from event_photos where event_id = $1', [mine!.id])).rows).toHaveLength(0);
    });
  });
});
