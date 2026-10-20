import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

describe('seam B: ghi cha/mẹ còn lại cho con (link_co_parent)', () => {
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

  const root = async () => (await me.query<{ id: string }>("insert into persons (tree_id, full_name, gender) values ($1, 'Cha', 'nam') returning id", [treeId]))[0]!.id;
  const addChild = (parent: string, name: string, other: string | null = null) =>
    me.rpc<string>('add_child', { parent_id: parent, other_parent_id: other, link_kind: 'ruot', person: { full_name: name, gender: 'nam' } });
  const addSpouse = (person: string, name: string) => me.rpc<string>('add_spouse', { person_id: person, union_order: null, person: { full_name: name, gender: 'nu' } });
  // Mảng uuid truyền dạng literal Postgres (harness gửi object thành JSON, PostgREST thật thì tự ép kiểu).
const call = (caller: Caller, parent: string, co: string, kids: string[]) =>
    caller.query<{ n: number }>('select public.link_co_parent($1, $2, $3::uuid[]) as n', [parent, co, `{${kids.join(',')}}`]).then((rows) => rows[0]!.n);
  const link = (parent: string, co: string, kids: string[]) => call(me, parent, co, kids);
  const parentsOf = async (child: string) =>
    (await me.query<{ parent_id: string }>('select parent_id from parent_links where child_id = $1 order by parent_id', [child])).map((row) => row.parent_id).sort();

  it('con chỉ có cha: ghi vợ làm mẹ → con có cả hai, hôn phối vẫn đúng một dòng; con khác không bị đụng', async () => {
    const cha = await root();
    const kid1 = await addChild(cha, 'Con 1');
    const kid2 = await addChild(cha, 'Con 2');
    const me1 = await addSpouse(cha, 'Mẹ');
    expect(await link(cha, me1, [kid1])).toBe(1);
    expect(await parentsOf(kid1)).toEqual([cha, me1].sort());
    expect(await parentsOf(kid2)).toEqual([cha]);
    expect(await me.query('select 1 from unions where partner_a = $1 or partner_b = $1', [cha])).toHaveLength(1);
    // Ghi lại lần nữa: không thêm gì.
    expect(await link(cha, me1, [kid1, kid2])).toBe(1);
    expect(await parentsOf(kid2)).toEqual([cha, me1].sort());
    expect(await link(cha, me1, [kid1, kid2])).toBe(0);
  });

  it('cha nhiều vợ: ghi đúng vợ cho đúng con; con đã có mẹ khác thì bỏ qua, con nuôi và con của người khác bị bỏ qua', async () => {
    const cha = await root();
    const wife1 = await addSpouse(cha, 'Vợ cả');
    const wife2 = await addSpouse(cha, 'Vợ hai');
    const kidA = await addChild(cha, 'Con A');
    const kidB = await addChild(cha, 'Con B');
    const kidWithMother = await addChild(cha, 'Con có mẹ', wife1);
    const stranger = await root();
    const strangerKid = await addChild(stranger, 'Con người khác');

    expect(await link(cha, wife1, [kidA])).toBe(1);
    expect(await link(cha, wife2, [kidB, kidWithMother, strangerKid])).toBe(1);
    expect(await parentsOf(kidA)).toEqual([cha, wife1].sort());
    expect(await parentsOf(kidB)).toEqual([cha, wife2].sort());
    expect(await parentsOf(kidWithMother)).toEqual([cha, wife1].sort());
    expect(await parentsOf(strangerKid)).toEqual([stranger]);
  });

  it('nối chưa có hôn phối thì tạo; hai người trùng nhau, khác gia phả, Người xem đều bị từ chối', async () => {
    const cha = await root();
    const kid = await addChild(cha, 'Con');
    const [lone] = await me.query<{ id: string }>("insert into persons (tree_id, full_name, gender) values ($1, 'Người chưa nối', 'nu') returning id", [treeId]);
    expect(await link(cha, lone!.id, [kid])).toBe(1);
    expect(await me.query('select 1 from unions where (partner_a = $1 and partner_b = $2) or (partner_a = $2 and partner_b = $1)', [cha, lone!.id])).toHaveLength(1);

    await expect(link(cha, cha, [kid])).rejects.toThrow(/SAME_PERSON/);
    const [otherTree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ Lê') returning id");
    const [foreign] = await me.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Lạ') returning id", [otherTree!.id]);
    await expect(link(cha, foreign!.id, [kid])).rejects.toThrow(/SAME_TREE_REQUIRED/);

    const viewer = await db.createUser(`xem-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: viewer.email, new_role: 'viewer' });
    const kid2 = await addChild(cha, 'Con 2');
    const third = await addSpouse(cha, 'Vợ ba');
    await expect(call(db.as(viewer), cha, third, [kid2])).rejects.toThrow();
    expect(await parentsOf(kid2)).toEqual([cha]);
  });
});
