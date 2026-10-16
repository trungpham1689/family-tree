import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

type PersonRow = { id: string; full_name: string; version: number; is_progenitor: boolean };
type Position = { person_id: string; generation: number | null; kind: string };

describe('seam B: an toàn khi biên tập', () => {
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
    const [tree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
  });

  const insert = async (fullName: string, gender = 'nam') =>
    (await me.query<PersonRow>(
      'insert into persons (tree_id, full_name, gender) values ($1, $2, $3) returning id, full_name, version, is_progenitor',
      [treeId, fullName, gender],
    ))[0]!;

  const read = async (id: string) =>
    (await me.query<PersonRow>('select id, full_name, version, is_progenitor from persons where id = $1', [id]))[0]!;

  const positions = async () =>
    new Map((await me.rpcRows<Position>('tree_positions', { target_tree: treeId })).map((row) => [row.person_id, row]));

  describe('xung đột khi sửa', () => {
    it('lưu với version đúng thì thành công và version tăng', async () => {
      const person = await insert('Phạm Văn A');
      expect(person.version).toBe(1);

      const [saved] = await me.query<PersonRow>(
        'update persons set full_name = $2, version = $3 where id = $1 returning id, full_name, version',
        [person.id, 'Phạm Văn Ánh', 1],
      );
      expect(saved).toMatchObject({ full_name: 'Phạm Văn Ánh', version: 2 });
    });

    it('lưu với version cũ bị từ chối, bản hiện tại giữ nguyên để đọc lại', async () => {
      const person = await insert('Phạm Văn A');
      await me.query('update persons set full_name = $2, version = 1 where id = $1', [person.id, 'Bản của người thứ nhất']);

      await expect(
        me.query('update persons set full_name = $2, version = 1 where id = $1', [person.id, 'Bản của người thứ hai']),
      ).rejects.toThrow(/STALE_VERSION/);
      expect(await read(person.id)).toMatchObject({ full_name: 'Bản của người thứ nhất', version: 2 });
    });

    it('thao tác quan hệ không gửi version vẫn chạy và cũng làm tăng version', async () => {
      const root = await insert('Tổ');
      await me.rpc('add_parent', { child_id: root.id, link_kind: 'ruot', person: { full_name: 'Cha Tổ' } });
      expect((await read(root.id)).version).toBe(2);
    });
  });

  describe('Người chưa nối', () => {
    it('Người không có cha mẹ là chưa nối; gắn cha thì vào đúng Đời', async () => {
      const root = await insert('Tổ');
      const son = await me.rpc<string>('add_child', {
        parent_id: root.id,
        other_parent_id: null,
        link_kind: 'ruot',
        person: { full_name: 'Con' },
      });
      const lost = await insert('Cháu thất lạc');
      expect((await positions()).get(lost.id)).toMatchObject({ generation: null, kind: 'chua_noi' });

      await me.rpc('link_parent', { child_id: lost.id, parent_id: son, link_kind: 'ruot' });
      expect((await positions()).get(lost.id)).toMatchObject({ generation: 3, kind: 'dinh' });
    });

    it('gắn cha/mẹ ruột thứ hai thì hai người thành vợ chồng', async () => {
      const root = await insert('Tổ');
      const child = await me.rpc<string>('add_child', {
        parent_id: root.id,
        other_parent_id: null,
        link_kind: 'ruot',
        person: { full_name: 'Con' },
      });
      const mother = await insert('Mẹ', 'nu');
      await me.rpc('link_parent', { child_id: child, parent_id: mother.id, link_kind: 'ruot' });

      const unions = await me.query('select * from unions where $1 in (partner_a, partner_b)', [mother.id]);
      expect(unions).toHaveLength(1);
      expect((await positions()).get(mother.id)?.kind).toBe('dau_re');
    });

    it('gắn làm vợ/chồng thì thành dâu/rể', async () => {
      const root = await insert('Tổ');
      const wife = await insert('Vợ', 'nu');
      await me.rpc('link_spouse', { person_id: root.id, spouse_id: wife.id });
      expect((await positions()).get(wife.id)?.kind).toBe('dau_re');
      // Gắn lại lần nữa không tạo hôn phối trùng.
      await me.rpc('link_spouse', { person_id: wife.id, spouse_id: root.id });
      expect(await me.query('select * from unions where tree_id = $1', [treeId])).toHaveLength(1);
    });

    it('không gắn được thành vòng tổ tiên', async () => {
      const root = await insert('Tổ');
      const child = await me.rpc<string>('add_child', {
        parent_id: root.id,
        other_parent_id: null,
        link_kind: 'ruot',
        person: { full_name: 'Con' },
      });
      await expect(me.rpc('link_parent', { child_id: root.id, parent_id: child, link_kind: 'ruot' })).rejects.toThrow(
        /ANCESTOR_CYCLE/,
      );
    });

    it('người không có vai trò không gắn được', async () => {
      const root = await insert('Tổ');
      const lost = await insert('Lạc');
      const stranger = await db.createUser(`la-${crypto.randomUUID()}@example.com`);
      await expect(
        db.as(stranger).rpc('link_parent', { child_id: lost.id, parent_id: root.id, link_kind: 'ruot' }),
      ).rejects.toThrow();
      expect(await me.query('select * from parent_links where child_id = $1', [lost.id])).toEqual([]);
    });
  });

  describe('xoá Người', () => {
    it('xoá Người thì các liên kết của người đó mất theo, con cháu thành chưa nối', async () => {
      const root = await insert('Tổ');
      const son = await me.rpc<string>('add_child', {
        parent_id: root.id,
        other_parent_id: null,
        link_kind: 'ruot',
        person: { full_name: 'Con' },
      });
      const grandson = await me.rpc<string>('add_child', {
        parent_id: son,
        other_parent_id: null,
        link_kind: 'ruot',
        person: { full_name: 'Cháu' },
      });
      await me.query('delete from persons where id = $1', [son]);

      expect(await me.query('select * from parent_links where $1 in (child_id, parent_id)', [son])).toEqual([]);
      expect((await positions()).get(grandson)?.kind).toBe('chua_noi');
    });
  });
});
