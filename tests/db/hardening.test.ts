import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

describe('seam B: siết an toàn (rà soát)', () => {
  let db: TestDb;
  let owner: Caller;
  let ownerUser: TestUser;
  let treeId: string;
  let otherTreeId: string;
  let rootId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    ownerUser = await db.createUser(`chu-${crypto.randomUUID()}@example.com`);
    owner = db.as(ownerUser);
    const [tree] = await owner.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
    const [other] = await owner.query<{ id: string }>("insert into family_trees (name) values ('Họ Lê') returning id");
    otherTreeId = other!.id;
    const [root] = await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Tổ') returning id", [treeId]);
    rootId = root!.id;
  });

  const editor = async () => {
    const user = await db.createUser(`bt-${crypto.randomUUID()}@example.com`);
    await owner.rpc('invite_to_tree', { target_tree: treeId, invite_email: user.email, new_role: 'editor' });
    return db.as(user);
  };

  it('không chuyển Người sang gia phả khác', async () => {
    await expect(owner.query('update persons set tree_id = $2 where id = $1', [rootId, otherTreeId])).rejects.toThrow(/TREE_IMMUTABLE/);
  });

  it('Người phụ trách cúng giỗ phải cùng gia phả', async () => {
    const [stranger] = await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Lạ') returning id", [otherTreeId]);
    await expect(owner.query('update persons set worship_keeper_id = $2 where id = $1', [rootId, stranger!.id])).rejects.toThrow(/SAME_TREE_REQUIRED/);
    const [mine] = await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Con') returning id", [treeId]);
    await owner.query('update persons set worship_keeper_id = $2 where id = $1', [rootId, mine!.id]);
  });

  it('ảnh: đường dẫn phải thuộc gia phả của Người, và không đổi được người/gia phả của ảnh', async () => {
    const insert = (path: string) =>
      owner.query<{ id: string }>('insert into person_photos (person_id, storage_path) values ($1, $2) returning id', [rootId, path]);
    await expect(insert(`${otherTreeId}/abc`)).rejects.toThrow(/PHOTO_PATH_INVALID/);

    const [photo] = await insert(`${treeId}/abcdefghij`);
    await expect(owner.query('update person_photos set storage_path = $2 where id = $1', [photo!.id, `${otherTreeId}/x`])).rejects.toThrow(/PHOTO_PATH_INVALID/);
    const [other] = await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Khác') returning id", [treeId]);
    await expect(owner.query('update person_photos set person_id = $2 where id = $1', [photo!.id, other!.id])).rejects.toThrow(/PHOTO_IMMUTABLE/);
  });

  it('ảnh: Biên tập viên thêm/xoá được ảnh của mọi Người (đi theo quyền sửa Người); Người xem thì không', async () => {
    const asEditor = await editor();
    const [foreign] = await owner.query<{ id: string }>('insert into person_photos (person_id, storage_path) values ($1, $2) returning id', [rootId, `${treeId}/ownerphoto1`]);
    // Người do Chủ sở hữu tạo: Biên tập viên thêm và xoá được ảnh của họ.
    const [added] = await asEditor.query<{ id: string }>('insert into person_photos (person_id, storage_path) values ($1, $2) returning id', [rootId, `${treeId}/editorphoto0`]);
    expect(await asEditor.query('delete from person_photos where id = $1 returning id', [added!.id])).toHaveLength(1);
    expect(await asEditor.query('delete from person_photos where id = $1 returning id', [foreign!.id])).toHaveLength(1);

    const mineId = await asEditor.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Của BTV' } });
    const [mine] = await asEditor.query<{ id: string }>('insert into person_photos (person_id, storage_path) values ($1, $2) returning id', [mineId, `${treeId}/editorphoto`]);
    expect(await asEditor.query('delete from person_photos where id = $1 returning id', [mine!.id])).toHaveLength(1);
  });

  it('Biên tập viên không xoá được quan hệ cha mẹ / hôn phối; Chủ sở hữu thì được', async () => {
    const asEditor = await editor();
    const childId = await owner.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Con' } });
    await owner.rpc('add_spouse', { person_id: rootId, union_order: null, person: { full_name: 'Vợ' } });

    expect(await asEditor.query('delete from parent_links where child_id = $1 returning child_id', [childId])).toEqual([]);
    expect(await asEditor.query('delete from unions where partner_a = $1 returning id', [rootId])).toEqual([]);

    expect(await owner.query('delete from parent_links where child_id = $1 returning child_id', [childId])).toHaveLength(1);
    expect(await owner.query('delete from unions where partner_a = $1 returning id', [rootId])).toHaveLength(1);
  });
});
