import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb } from './harness';

describe('seam B: ngày cưới, lịch đăng ký, gộp người trùng', () => {
  let db: TestDb;
  let owner: Caller;
  let treeId: string;
  let rootId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    owner = db.as(await db.createUser(`chu-${crypto.randomUUID()}@example.com`));
    const [tree] = await owner.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
    const [root] = await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Tổ') returning id", [treeId]);
    rootId = root!.id;
  });

  const person = async (name: string, extra = '') =>
    (await owner.query<{ id: string }>(`insert into persons (tree_id, full_name${extra ? ', ' + extra.split('=')[0] : ''}) values ($1, $2${extra ? ', ' + extra.split('=')[1] : ''}) returning id`, [treeId, name]))[0]!.id;

  describe('ngày cưới', () => {
    it('lưu năm / năm-tháng / đủ ngày; tháng không có năm bị từ chối', async () => {
      const spouseId = await owner.rpc<string>('add_spouse', { person_id: rootId, union_order: null, person: { full_name: 'Vợ' } });
      await owner.query('update unions set marriage_year = 1950 where partner_b = $1', [spouseId]);
      await owner.query('update unions set marriage_month = 5, marriage_day = 20 where partner_b = $1', [spouseId]);
      await expect(owner.query('update unions set marriage_year = null where partner_b = $1', [spouseId])).rejects.toThrow();
    });
  });

  describe('lịch đăng ký', () => {
    it('tạo link, đọc lại, link cũ hết hiệu lực khi tạo lại, khách đọc được qua token', async () => {
      await owner.query("update persons set is_deceased = true, anniversary_day = 12, anniversary_month = 3 where id = $1", [rootId]);
      const first = await owner.rpc<string>('rotate_calendar_feed');
      expect(first).toMatch(/^[0-9a-f]{32}$/);
      expect(await owner.rpc<string>('my_calendar_feed')).toBe(first);

      const feed = await db.asAnon().rpc<{ trees: { id: string }[]; persons: { id: string }[]; marriages: unknown[] }>('calendar_feed', { token: first });
      expect(feed.trees.map((t) => t.id)).toEqual([treeId]);
      expect(feed.persons.map((p) => p.id)).toEqual([rootId]);

      const second = await owner.rpc<string>('rotate_calendar_feed');
      expect(second).not.toBe(first);
      expect(await db.asAnon().rpc('calendar_feed', { token: first })).toBeNull();
      expect(await db.asAnon().rpc('calendar_feed', { token: second })).not.toBeNull();

      await owner.rpc('disable_calendar_feed');
      expect(await db.asAnon().rpc('calendar_feed', { token: second })).toBeNull();
    });

    it('chỉ trả gia phả của đúng tài khoản; token sai/chưa duyệt trả null; không đọc thẳng bảng', async () => {
      const stranger = db.as(await db.createUser(`la-${crypto.randomUUID()}@example.com`));
      const token = await stranger.rpc<string>('rotate_calendar_feed');
      const feed = await db.asAnon().rpc<{ trees: unknown[]; persons: unknown[] }>('calendar_feed', { token });
      expect(feed.trees).toEqual([]);
      expect(feed.persons).toEqual([]);
      expect(await db.asAnon().rpc('calendar_feed', { token: 'x' })).toBeNull();
      await expect(owner.query('select * from calendar_feeds')).rejects.toThrow();

      const pending = db.as(await db.createUser(`cho-${crypto.randomUUID()}@example.com`, { approved: false }));
      await expect(pending.rpc('rotate_calendar_feed')).rejects.toThrow();
    });
  });

  describe('gộp người trùng', () => {
    it('chuyển con, vợ/chồng, ảnh sang người giữ; điền trường còn trống; xoá người trùng', async () => {
      const keep = await person('Phạm Văn A');
      const dup = await person('Phạm Văn A');
      await owner.query("update persons set birth_year = 1950, birth_precision = 'nam', birth_place = 'Hà Nam', phone = '0900' where id = $1", [dup]);
      await owner.query("update persons set phone = '0911' where id = $1", [keep]);
      const childId = await owner.rpc<string>('add_child', { parent_id: dup, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Con' } });
      const spouseId = await owner.rpc<string>('add_spouse', { person_id: dup, union_order: null, person: { full_name: 'Vợ' } });
      await owner.query('update unions set marriage_year = 1975, marriage_month = 4, marriage_day = 30 where partner_b = $1', [spouseId]);
      await owner.query('insert into person_photos (person_id, storage_path, is_avatar) values ($1, $2, true)', [dup, `${treeId}/file1234567`]);

      await owner.rpc('merge_persons', { keep_person: keep, drop_person: dup });

      expect(await owner.query('select id from persons where id = $1', [dup])).toEqual([]);
      const [merged] = await owner.query<{ birth_year: number; birth_place: string; phone: string }>('select birth_year, birth_place, phone from persons where id = $1', [keep]);
      expect(merged).toMatchObject({ birth_year: 1950, birth_place: 'Hà Nam', phone: '0911' }); // trường đã có thì giữ nguyên
      expect(await owner.query('select 1 from parent_links where child_id = $1 and parent_id = $2', [childId, keep])).toHaveLength(1);
      const [union] = await owner.query<{ marriage_year: number }>('select marriage_year from unions where partner_a = $1 and partner_b = $2', [keep, spouseId]);
      expect(union!.marriage_year).toBe(1975);
      const photos = await owner.query<{ person_id: string }>('select person_id from person_photos');
      expect(photos.map((p) => p.person_id)).toEqual([keep]);
      const [after] = await owner.query<{ avatar_path: string }>('select avatar_path from persons where id = $1', [keep]);
      expect(after!.avatar_path).toBe(`${treeId}/file1234567`);
    });

    it('cha/mẹ trùng hợp nhất, không tạo vòng; Thuỷ tổ chuyển sang người giữ', async () => {
      const dup = await person('Trùng');
      await owner.query('update persons set is_progenitor = false where id = $1', [rootId]);
      await owner.query('update persons set is_progenitor = true where id = $1', [dup]);
      await owner.rpc('merge_persons', { keep_person: rootId, drop_person: dup });
      const [row] = await owner.query<{ is_progenitor: boolean }>('select is_progenitor from persons where id = $1', [rootId]);
      expect(row!.is_progenitor).toBe(true);
    });

    it('chỉ Chủ sở hữu gộp; không gộp người ở gia phả khác; không gộp với chính mình', async () => {
      const a = await person('A');
      const b = await person('B');
      const user = await db.createUser(`bt-${crypto.randomUUID()}@example.com`);
      await owner.rpc('invite_to_tree', { target_tree: treeId, invite_email: user.email, new_role: 'editor' });
      await expect(db.as(user).rpc('merge_persons', { keep_person: a, drop_person: b })).rejects.toThrow();
      await expect(owner.rpc('merge_persons', { keep_person: a, drop_person: a })).rejects.toThrow(/SAME_PERSON/);
      const [other] = await owner.query<{ id: string }>("insert into family_trees (name) values ('Khác') returning id");
      const [foreign] = await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Lạ') returning id", [other!.id]);
      await expect(owner.rpc('merge_persons', { keep_person: a, drop_person: foreign!.id })).rejects.toThrow(/SAME_TREE_REQUIRED/);
    });
  });

  describe('đổi thứ tự con', () => {
    it('Biên tập viên đổi được thứ tự cả con của người họ không tạo; không tăng version; Người xem bị từ chối', async () => {
      const first = await owner.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Cả' } });
      const second = await owner.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Hai' } });
      const editorUser = await db.createUser(`bt-${crypto.randomUUID()}@example.com`);
      const viewerUser = await db.createUser(`xem-${crypto.randomUUID()}@example.com`);
      await owner.rpc('invite_to_tree', { target_tree: treeId, invite_email: editorUser.email, new_role: 'editor' });
      await owner.rpc('invite_to_tree', { target_tree: treeId, invite_email: viewerUser.email, new_role: 'viewer' });

      const [before] = await owner.query<{ version: number }>('select version from persons where id = $1', [first]);
      await db.as(editorUser).query('select public.reorder_children($1::uuid[])', [`{${second},${first}}`]);
      const rows = await owner.query<{ id: string; birth_order: number; version: number }>('select id, birth_order, version from persons where id in ($1, $2)', [first, second]);
      expect(rows.find((r) => r.id === second)!.birth_order).toBe(1);
      expect(rows.find((r) => r.id === first)).toMatchObject({ birth_order: 2, version: before!.version });
      await expect(db.as(viewerUser).query('select public.reorder_children($1::uuid[])', [`{${first},${second}}`])).rejects.toThrow();
    });
  });
});
