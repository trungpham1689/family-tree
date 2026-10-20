import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EVENT_MATRIX, PERSON_MATRIX, type Actor, type Creator } from '../../apps/web/src/data/permission-matrix';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

/**
 * Seam B: mỗi dòng của bảng quyền chung (`permission-matrix.ts`, cũng là thứ `permissions.test.ts` kiểm tra bên giao diện)
 * được chạy thật với RLS/RPC — để luật ở TypeScript và ở SQL không thể lệch nhau mà không ai biết.
 */
describe('seam B: bảng quyền chung TS/SQL', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  const unique = (name: string) => `${name}-${crypto.randomUUID()}@example.com`;

  /** Một gia phả mới có Chủ sở hữu, một Biên tập viên, một Người xem, một người ngoài; trả về người đóng vai `actor` và người "khác" tạo dữ liệu. */
  const scene = async (actor: Actor, creator: Creator) => {
    const owner = await db.createUser(unique('chu'));
    const asOwner = db.as(owner);
    const [tree] = await asOwner.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    const treeId = tree!.id;
    const invite = async (role: 'editor' | 'viewer'): Promise<TestUser> => {
      const user = await db.createUser(unique(role));
      await asOwner.rpc('invite_to_tree', { target_tree: treeId, invite_email: user.email, new_role: role });
      return user;
    };
    const editor = await invite('editor');
    const users: Record<Actor, TestUser> = { owner, editor, viewer: await invite('viewer'), none: await db.createUser(unique('la')) };
    const [root] = await asOwner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Thuỷ tổ') returning id", [treeId]);
    // `self`: chính người thao tác tạo; `other`: người khác (Chủ sở hữu tạo cho Biên tập viên, Biên tập viên tạo cho Chủ sở hữu).
    const author: TestUser = creator === 'self' ? users[actor] : actor === 'owner' ? editor : owner;
    return { treeId, rootId: root!.id, actor: db.as(users[actor]), actorUser: users[actor], author: db.as(author) };
  };

  const newPerson = async (author: Caller, rootId: string) =>
    author.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Con' } });

  const personRow = async (id: string) =>
    (await db.admin.query<{ pending_delete_by: string | null }>('select pending_delete_by from persons where id = $1', [id])).rows[0];

  describe.each(PERSON_MATRIX)('Người: $actor, do $creator tạo', ({ actor, creator, edit, deleteNow, requestDelete }) => {
    it('sửa hồ sơ', async () => {
      const s = await scene(actor, creator);
      const id = await newPerson(s.author, s.rootId);
      const rows = await s.actor.query("update persons set full_name = 'Đã sửa' where id = $1 returning id", [id]);
      expect(rows.length > 0).toBe(edit);
    });

    it('xoá ngay', async () => {
      const s = await scene(actor, creator);
      const id = await newPerson(s.author, s.rootId);
      const rows = await s.actor.query('delete from persons where id = $1 returning id', [id]);
      expect(rows.length > 0).toBe(deleteNow);
    });

    it('gửi yêu cầu xoá chờ duyệt', async () => {
      const s = await scene(actor, creator);
      const id = await newPerson(s.author, s.rootId);
      const outcome = await s.actor.rpc('request_delete_person', { target_person: id }).then(
        () => 'ok',
        () => 'refused',
      );
      const row = await personRow(id);
      // Gửi được = lệnh không bị từ chối VÀ Người còn đó, đang chờ duyệt bởi chính người gửi (Chủ sở hữu thì xoá luôn nên không tính).
      expect(outcome === 'ok' && row?.pending_delete_by === s.actorUser.id).toBe(requestDelete);
    });
  });

  describe.each(EVENT_MATRIX)('Sự kiện: $actor, do $creator tạo', ({ actor, creator, edit }) => {
    it('sửa', async () => {
      const s = await scene(actor, creator);
      const [event] = await s.author.query<{ id: string }>(
        "insert into tree_events (tree_id, title, calendar, month, day) values ($1, 'Giỗ', 'am', 1, 10) returning id",
        [s.treeId],
      );
      const rows = await s.actor.query("update tree_events set title = 'Đã sửa' where id = $1 returning id", [event!.id]);
      expect(rows.length > 0).toBe(edit);
    });
  });
});
