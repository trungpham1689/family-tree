import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb } from './harness';

describe('seam B: Ảnh tư liệu', () => {
  let db: TestDb;
  let owner: Caller;
  let treeId: string;
  let personId: string;

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
    const [person] = await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Tổ') returning id", [treeId]);
    personId = person!.id;
  });

  const addPhoto = (caller: Caller, fields: Record<string, unknown> = {}) =>
    caller.query<{ id: string; is_avatar: boolean; storage_path: string }>(
      `insert into person_photos (person_id, storage_path, caption, is_avatar)
       values ($1, $2, $3, $4) returning id, is_avatar, storage_path`,
      [personId, fields.storage_path ?? `${treeId}/${personId}/a.jpg`, fields.caption ?? null, fields.is_avatar ?? false],
    );

  it('thêm ảnh tự điền tree_id, chọn làm đại diện thì persons.avatar_path khớp theo', async () => {
    const [photo] = await addPhoto(owner, { is_avatar: true });
    expect(photo!.is_avatar).toBe(true);

    const [row] = await owner.query<{ tree_id: string }>('select tree_id from person_photos where id = $1', [photo!.id]);
    expect(row!.tree_id).toBe(treeId);

    const [person] = await owner.query<{ avatar_path: string | null }>('select avatar_path from persons where id = $1', [personId]);
    expect(person!.avatar_path).toBe(photo!.storage_path);
  });

  it('tải/đổi ảnh không làm form "Sửa thông tin" đang mở bị báo xung đột (version không tăng)', async () => {
    const [before] = await owner.query<{ version: number }>('select version from persons where id = $1', [personId]);
    await addPhoto(owner, { is_avatar: true });
    const [after] = await owner.query<{ version: number }>('select version from persons where id = $1', [personId]);
    expect(after!.version).toBe(before!.version);

    // Lưu với version đã đọc từ trước khi tải ảnh vẫn được, và lần sửa thật vẫn tăng version.
    const saved = await owner.query<{ version: number }>("update persons set full_name = 'Tổ Mới', version = $2 where id = $1 returning version", [
      personId,
      before!.version,
    ]);
    expect(saved[0]!.version).toBe(before!.version + 1);
  });

  it('mặc định mỗi Người tối đa 3 ảnh', async () => {
    const [row] = await owner.query<{ value: number }>("select value from app_settings where key = 'max_photos_per_person'");
    expect(row!.value).toBe(3);
  });

  it('xoá ảnh đại diện thì persons.avatar_path về null', async () => {
    const [photo] = await addPhoto(owner, { is_avatar: true });
    await owner.query('delete from person_photos where id = $1', [photo!.id]);
    const [person] = await owner.query<{ avatar_path: string | null }>('select avatar_path from persons where id = $1', [personId]);
    expect(person!.avatar_path).toBeNull();
  });

  it('set_avatar_photo đổi ảnh đại diện không đụng unique index', async () => {
    const [first] = await addPhoto(owner, { is_avatar: true });
    const [second] = await addPhoto(owner);

    await owner.rpc('set_avatar_photo', { photo_id: second!.id });

    const rows = await owner.query<{ id: string; is_avatar: boolean }>('select id, is_avatar from person_photos where person_id = $1 order by id', [
      personId,
    ]);
    expect(rows.find((row) => row.id === first!.id)!.is_avatar).toBe(false);
    expect(rows.find((row) => row.id === second!.id)!.is_avatar).toBe(true);

    const [person] = await owner.query<{ avatar_path: string | null }>('select avatar_path from persons where id = $1', [personId]);
    expect(person!.avatar_path).toBe(second!.storage_path);
  });

  it('quá giới hạn ảnh/người thì bị chặn', async () => {
    const [row] = await owner.query<{ value: number }>("select value from app_settings where key = 'max_photos_per_person'");
    const limit = row!.value;
    for (let index = 0; index < limit; index += 1) await addPhoto(owner, { storage_path: `${treeId}/${personId}/${index}.jpg` });
    await expect(addPhoto(owner, { storage_path: `${treeId}/${personId}/qua-han.jpg` })).rejects.toThrow();
  });

  it('Người xem không thêm/xoá được ảnh', async () => {
    const viewerUser = await db.createUser(`xem-${crypto.randomUUID()}@example.com`);
    await db.admin.query("insert into tree_roles (tree_id, account_id, role) values ($1, $2, 'viewer')", [treeId, viewerUser.id]);
    const viewer = db.as(viewerUser);

    await expect(addPhoto(viewer)).rejects.toThrow();

    const [photo] = await addPhoto(owner);
    await expect(viewer.query('delete from person_photos where id = $1', [photo!.id])).resolves.toEqual([]);
    const remaining = await owner.query('select id from person_photos where id = $1', [photo!.id]);
    expect(remaining).toHaveLength(1);
  });
});
