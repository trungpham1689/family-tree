import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CALENDAR_PERSON_COLUMNS, isCalendarPerson, parseCalendarSource } from '../../packages/reminders/src/calendar-source';
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

    it.each([
      ['giữ người có đủ hai cha mẹ', 2, 1],
      ['giữ người có một cha', 1, 2],
      ['hai người cùng đủ hai cha mẹ', 2, 2],
    ])('con trùng cùng cha mẹ: %s', async (_name, keepParents, dropParents) => {
      const father = await person('Cha');
      const mother = await owner.rpc<string>('add_spouse', { person_id: father, union_order: null, person: { full_name: 'Mẹ' } });
      const addChild = (parents: number) =>
        owner.rpc<string>('add_child', { parent_id: father, other_parent_id: parents === 2 ? mother : null, link_kind: 'ruot', person: { full_name: 'Phạm Văn Con' } });
      const keep = await addChild(keepParents);
      const dup = await addChild(dropParents);
      await owner.rpc('merge_persons', { keep_person: keep, drop_person: dup });
      const links = await owner.query<{ parent_id: string }>('select parent_id from parent_links where child_id = $1', [keep]);
      expect(links.map((link) => link.parent_id).sort()).toEqual((keepParents === 2 || dropParents === 2 ? [father, mother] : [father]).sort());
    });

    it('người bị gộp có vợ và con: con vẫn đủ hai cha mẹ sau khi gộp', async () => {
      const father = await person('Cha');
      const mother = await owner.rpc<string>('add_spouse', { person_id: father, union_order: null, person: { full_name: 'Mẹ' } });
      const addSon = () => owner.rpc<string>('add_child', { parent_id: father, other_parent_id: mother, link_kind: 'ruot', person: { full_name: 'Phạm Văn Con' } });
      const keep = await addSon();
      const dup = await addSon();
      const wife = await owner.rpc<string>('add_spouse', { person_id: dup, union_order: null, person: { full_name: 'Dâu' } });
      const grandchild = await owner.rpc<string>('add_child', { parent_id: dup, other_parent_id: wife, link_kind: 'ruot', person: { full_name: 'Cháu' } });
      await owner.rpc('merge_persons', { keep_person: keep, drop_person: dup });
      const parents = await owner.query<{ parent_id: string }>('select parent_id from parent_links where child_id = $1', [grandchild]);
      expect(parents.map((link) => link.parent_id).sort()).toEqual([keep, wife].sort());
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

  describe('quyền sửa Người (dùng cho Pages Function ảnh)', () => {
    it('can_edit_person: Chủ sở hữu mọi Người; Biên tập viên chỉ Người mình tạo; Người xem không', async () => {
      const editorUser = await db.createUser(`bt-${crypto.randomUUID()}@example.com`);
      const viewerUser = await db.createUser(`xem-${crypto.randomUUID()}@example.com`);
      await owner.rpc('invite_to_tree', { target_tree: treeId, invite_email: editorUser.email, new_role: 'editor' });
      await owner.rpc('invite_to_tree', { target_tree: treeId, invite_email: viewerUser.email, new_role: 'viewer' });
      const editorsOwn = await db.as(editorUser).rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Của BTV' } });

      expect(await owner.rpc('can_edit_person', { target_person: rootId })).toBe(true);
      expect(await db.as(editorUser).rpc('can_edit_person', { target_person: rootId })).toBe(false);
      expect(await db.as(editorUser).rpc('can_edit_person', { target_person: editorsOwn })).toBe(true);
      expect(await db.as(viewerUser).rpc('can_edit_person', { target_person: editorsOwn })).toBe(false);
      expect(await db.asAnon().rpc('can_edit_person', { target_person: rootId }).catch(() => 'denied')).toBe('denied');
    });
  });

  describe('hợp đồng nguồn lịch', () => {
    it('hàm SQL calendar_feed khớp bộ cột, bộ lọc người và cách ghép tên của packages/reminders', async () => {
      const dead = await person('Cụ mất');
      await owner.query("update persons set is_deceased = true, anniversary_day = 3, anniversary_month = 4, death_solar_date = '1990-05-06', birth_solar_date = '1920-01-02' where id = $1", [dead]);
      const aliveWithDate = await person('Còn sống có ngày');
      await owner.query("update persons set birth_solar_date = '2000-07-08' where id = $1", [aliveWithDate]);
      await person('Còn sống không ngày');
      const spouseId = await owner.rpc<string>('add_spouse', { person_id: rootId, union_order: null, person: { full_name: 'Vợ Tổ' } });
      await owner.query('update unions set marriage_year = 1950, marriage_month = 8, marriage_day = 15 where partner_b = $1', [spouseId]);
      const divorced = await owner.rpc<string>('add_spouse', { person_id: rootId, union_order: null, person: { full_name: 'Vợ cũ' } });
      await owner.query("update unions set marriage_year = 1960, marriage_month = 1, marriage_day = 1, status = 'ly_hon' where partner_b = $1", [divorced]);

      const token = await owner.rpc<string>('rotate_calendar_feed');
      const feed = await db.asAnon().rpc<unknown>('calendar_feed', { token });
      const source = parseCalendarSource(feed);
      expect(source).not.toBeNull();

      // Cùng bộ cột: mỗi Người trong feed có đúng các khoá của CALENDAR_PERSON_COLUMNS, và giá trị bằng dòng thật.
      const columns = CALENDAR_PERSON_COLUMNS.split(',').map((c) => c.trim());
      const direct = await owner.query<Record<string, unknown>>(`select ${columns.join(', ')} from persons where tree_id = $1`, [treeId]);
      const expected = direct.filter((p) => isCalendarPerson(p as { is_deceased: boolean; birth_solar_date: string | null }));
      expect(source!.persons.map((p) => p.id).sort()).toEqual(expected.map((p) => p.id as string).sort());
      for (const p of source!.persons) {
        expect(Object.keys(p).sort()).toEqual([...columns].sort());
        expect(p).toEqual(expected.find((e) => e.id === p.id));
      }
      // Hôn phối: chỉ cuộc còn hiệu lực, đủ ngày; tên ghép "A & B".
      expect(source!.marriages).toHaveLength(1);
      expect(source!.marriages![0]).toMatchObject({ names: 'Tổ & Vợ Tổ', marriage_year: 1950, marriage_month: 8, marriage_day: 15 });
    });
  });

  describe('ghi nhiều bước trong một hàm', () => {
    it('merge_persons_group: gộp cả nhóm, hoặc lỗi thì không gộp gì', async () => {
      const keep = await person('Giữ');
      const d1 = await person('Trùng 1');
      const d2 = await person('Trùng 2');
      await owner.query('select public.merge_persons_group($1, $2::uuid[])', [keep, `{${d1},${d2}}`]);
      expect(await owner.query('select id from persons where id in ($1, $2)', [d1, d2])).toEqual([]);

      const keep2 = await person('Giữ 2');
      const ok = await person('Trùng ok');
      await expect(owner.query('select public.merge_persons_group($1, $2::uuid[])', [keep2, `{${ok},${keep2}}`])).rejects.toThrow(/SAME_PERSON/);
      expect(await owner.query('select id from persons where id = $1', [ok])).toHaveLength(1); // người đầu tiên không bị gộp dở
    });

    it('reorder_unions và update_union: đổi thứ tự theo phía người xem, trạng thái, ngày cưới trong một lần', async () => {
      const s1 = await owner.rpc<string>('add_spouse', { person_id: rootId, union_order: null, person: { full_name: 'Vợ 1' } });
      const s2 = await owner.rpc<string>('add_spouse', { person_id: rootId, union_order: null, person: { full_name: 'Vợ 2' } });
      const unions = await owner.query<{ id: string; partner_b: string }>('select id, partner_b from unions where partner_a = $1', [rootId]);
      const u1 = unions.find((u) => u.partner_b === s1)!.id;
      const u2 = unions.find((u) => u.partner_b === s2)!.id;

      await owner.query('select public.reorder_unions($1, $2::uuid[])', [rootId, `{${u2},${u1}}`]);
      const orders = await owner.query<{ id: string; order_for_a: number }>('select id, order_for_a from unions where partner_a = $1', [rootId]);
      expect(orders.find((u) => u.id === u2)!.order_for_a).toBe(1);
      expect(orders.find((u) => u.id === u1)!.order_for_a).toBe(2);
      await expect(owner.query('select public.reorder_unions($1, $2::uuid[])', [rootId, `{${u1},${crypto.randomUUID()}}`])).rejects.toThrow(/UNION_NOT_FOUND/);

      await owner.rpc('update_union', { target_union: u1, viewer: rootId, new_status: 'goa', set_marriage: true, new_marriage_year: 1950, new_marriage_month: 8, new_marriage_day: 15 });
      const [row] = await owner.query<{ status: string; marriage_year: number; marriage_day: number; order_for_a: number }>('select status, marriage_year, marriage_day, order_for_a from unions where id = $1', [u1]);
      expect(row).toEqual({ status: 'goa', marriage_year: 1950, marriage_day: 15, order_for_a: 2 }); // thứ tự không bị đụng tới
      await expect(owner.rpc('update_union', { target_union: crypto.randomUUID(), viewer: rootId, new_status: 'con' })).rejects.toThrow(/UNION_NOT_FOUND/);
    });
  });

  describe('gộp người trùng và giới hạn ảnh', () => {
    it('không vượt giới hạn ảnh mỗi Người; ảnh đại diện của người bị gộp đi trước', async () => {
      const [{ value: limit }] = await owner.query<{ value: number }>("select value from app_settings where key = 'max_photos_per_person'") as [{ value: number }];
      const keep = await person('Giữ');
      const dup = await person('Trùng');
      await owner.query('insert into person_photos (person_id, storage_path) values ($1, $2)', [keep, `${treeId}/keep-photo-1`]);
      for (let index = 0; index < limit; index += 1) {
        await owner.query('insert into person_photos (person_id, storage_path, is_avatar) values ($1, $2, $3)', [dup, `${treeId}/dup-photo-${index}`, index === limit - 1]);
      }
      await owner.rpc('merge_persons', { keep_person: keep, drop_person: dup });
      const photos = await owner.query<{ storage_path: string; is_avatar: boolean }>('select storage_path, is_avatar from person_photos where person_id = $1', [keep]);
      expect(photos).toHaveLength(limit);
      expect(photos.filter((p) => p.is_avatar).map((p) => p.storage_path)).toEqual([`${treeId}/dup-photo-${limit - 1}`]);
    });
  });

  describe('người nhận bản tin email', () => {
    it('digest_recipients: Chủ sở hữu + Biên tập viên đã duyệt, trừ Người xem, chưa duyệt, hoặc đã tắt email', async () => {
      const mk = async (role: 'editor' | 'viewer', options?: { approved?: boolean }) => {
        const user = await db.createUser(`${role}-${crypto.randomUUID()}@example.com`, options);
        await db.admin.query("insert into tree_roles (tree_id, account_id, role) values ($1, $2, $3)", [treeId, user.id, role]);
        return user;
      };
      const editor = await mk('editor');
      await mk('viewer');
      await mk('editor', { approved: false });
      const muted = await mk('editor');
      await db.admin.query("insert into reminder_prefs (account_id, tree_id, email_enabled) values ($1, $2, false)", [muted.id, treeId]);

      const rows = (await db.admin.query<{ tree_id: string; email: string }>("select tree_id, email from public.digest_recipients() where tree_id = $1", [treeId])).rows;
      const emails = rows.map((r) => r.email);
      expect(emails).toContain(editor.email);
      expect(emails.some((e) => e.startsWith('viewer-'))).toBe(false);
      expect(emails).not.toContain(muted.email);
      expect(emails.length).toBe(2); // chủ sở hữu + biên tập viên đã duyệt, chưa tắt
    });

    it('chỉ service_role gọi được digest_recipients', async () => {
      const [row] = (await db.admin.query<{ anon: boolean; authenticated: boolean; service: boolean }>(
        `select has_function_privilege('anon', 'public.digest_recipients()', 'execute') as anon,
                has_function_privilege('authenticated', 'public.digest_recipients()', 'execute') as authenticated,
                has_function_privilege('service_role', 'public.digest_recipients()', 'execute') as service`,
      )).rows;
      expect(row).toEqual({ anon: false, authenticated: false, service: true });
    });
  });

  describe('dọn Storage cũ', () => {
    it('còn ảnh đường dẫn cũ thì không gỡ policy; hết ảnh cũ thì gỡ', async () => {
      const policies = async () => (await db.admin.query<{ policyname: string }>("select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'")).rows.length;
      // Các migration đã chạy hàm một lần khi chưa có dữ liệu: policy đã được gỡ trong DB trống của test.
      expect(await policies()).toBe(0);
      const legacy = await owner.query<{ id: string }>('insert into person_photos (person_id, storage_path) values ($1, $2) returning id', [rootId, `${treeId}/${rootId}/cu.jpg`]);
      const [{ result }] = (await db.admin.query<{ result: string }>('select private.drop_legacy_photo_storage() as result')).rows as [{ result: string }];
      expect(result).toContain('Chưa gỡ');
      await owner.query('delete from person_photos where id = $1', [legacy[0]!.id]);
      expect(((await db.admin.query<{ result: string }>('select private.drop_legacy_photo_storage() as result')).rows[0]!.result)).toContain('Đã gỡ');
    });
  });
});
