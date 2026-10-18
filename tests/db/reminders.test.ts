import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb } from './harness';

describe('seam B: Nhắc nhở (liên kết tài khoản, Danh sách nhắc giỗ)', () => {
  let db: TestDb;
  let me: Caller;
  let treeId: string;
  /** to ─ con ─ chau ─ chat (4 đời tổ tiên của chat) */
  let toId: string;
  let conId: string;
  let chauId: string;
  let chatId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    me = db.as(await db.createUser(`chu-${crypto.randomUUID()}@example.com`));
    const [tree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;

    const person = async (name: string) => {
      const [row] = await me.query<{ id: string }>('insert into persons (tree_id, full_name) values ($1, $2) returning id', [treeId, name]);
      return row!.id;
    };
    toId = await person('Tổ');
    conId = await person('Con');
    chauId = await person('Cháu');
    chatId = await person('Chắt');
    for (const [child, parent] of [
      [conId, toId],
      [chauId, conId],
      [chatId, chauId],
    ]) {
      await me.query('insert into parent_links (child_id, parent_id) values ($1, $2)', [child, parent]);
    }
  });

  it('liên kết Người là chính mình, mồi Danh sách nhắc giỗ bằng tổ tiên 4 đời', async () => {
    await me.rpc('link_account_to_person', { target_tree: treeId, person_id: chatId });

    const [role] = await me.query<{ linked_person_id: string }>(
      'select linked_person_id from tree_roles where tree_id = $1',
      [treeId],
    );
    expect(role!.linked_person_id).toBe(chatId);

    const watched = (await me.query<{ person_id: string }>('select person_id from reminder_watch where account_id = auth.uid()')).map(
      (row) => row.person_id,
    );
    expect(watched.sort()).toEqual([chauId, conId, toId].sort());
  });

  it('liên kết lần sau không ghi đè Danh sách đã tự chỉnh', async () => {
    await me.rpc('link_account_to_person', { target_tree: treeId, person_id: chatId });
    await me.query('delete from reminder_watch where person_id = $1', [toId]);
    await me.query("insert into persons (tree_id, full_name) values ($1, 'Người khác') returning id", [treeId]);

    await me.rpc('link_account_to_person', { target_tree: treeId, person_id: chatId });

    const watched = await me.query('select person_id from reminder_watch where account_id = auth.uid()');
    expect(watched).toHaveLength(2); // con, chau — không mồi lại 'to' đã xoá
  });

  it('không liên kết được Người ở gia phả khác', async () => {
    const [other] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ khác') returning id");
    const [person] = await me.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Lạ') returning id", [other!.id]);
    await expect(me.rpc('link_account_to_person', { target_tree: treeId, person_id: person!.id })).rejects.toThrow();
  });

  it('chỉ xem/xoá được Danh sách nhắc giỗ của chính mình', async () => {
    await me.query('insert into reminder_watch (person_id) values ($1)', [toId]);
    const stranger = db.as(await db.createUser(`khac-${crypto.randomUUID()}@example.com`));
    expect(await stranger.query('select * from reminder_watch')).toEqual([]);
    await stranger.query('delete from reminder_watch where person_id = $1', [toId]);
    expect(await me.query('select * from reminder_watch')).toHaveLength(1);
  });

  it('đặt độ sớm nhắc theo gia phả, mỗi tài khoản-gia phả một dòng', async () => {
    await me.query(
      `insert into reminder_prefs (account_id, tree_id, offset_days) values (auth.uid(), $1, 3)
       on conflict (account_id, tree_id) do update set offset_days = excluded.offset_days`,
      [treeId],
    );
    const [pref] = await me.query<{ offset_days: number }>('select offset_days from reminder_prefs where tree_id = $1', [treeId]);
    expect(pref!.offset_days).toBe(3);
  });

  it('đánh dấu đã đọc một nhắc nhở, chỉ thấy của chính mình', async () => {
    await me.query("insert into notification_reads (account_id, notification_key) values (auth.uid(), 'gio:x:2026-3-12')");
    const stranger = db.as(await db.createUser(`khac2-${crypto.randomUUID()}@example.com`));
    expect(await stranger.query('select * from notification_reads')).toEqual([]);
    expect(await me.query('select * from notification_reads')).toHaveLength(1);
  });
});
