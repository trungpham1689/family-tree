import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

type Position = { person_id: string; generation: number | null; branch_id: string | null; kind: string };

describe('seam B: quan hệ, Đời và Chi', () => {
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

  const person = (fields: Record<string, unknown>) => fields;

  const addFirst = async (fullName: string, gender = 'nam') => {
    const [row] = await me.query<{ id: string; is_progenitor: boolean }>(
      'insert into persons (tree_id, full_name, gender) values ($1, $2, $3) returning id, is_progenitor',
      [treeId, fullName, gender],
    );
    return row!;
  };

  const addChild = (parentId: string, fullName: string, extra: Record<string, unknown> = {}) =>
    me.rpc<string>('add_child', {
      parent_id: parentId,
      other_parent_id: extra.otherParentId ?? null,
      link_kind: extra.kind ?? 'ruot',
      person: person({ full_name: fullName, gender: extra.gender ?? 'nam', birth_order: extra.birthOrder ?? null }),
    });

  const addSpouse = (personId: string, fullName: string, order = 1, gender = 'nu') =>
    me.rpc<string>('add_spouse', {
      person_id: personId,
      union_order: order,
      person: person({ full_name: fullName, gender }),
    });

  const addParent = (childId: string, fullName: string, gender = 'nam') =>
    me.rpc<string>('add_parent', {
      child_id: childId,
      link_kind: 'ruot',
      person: person({ full_name: fullName, gender }),
    });

  const positions = async () => {
    const rows = await me.rpcRows<Position>('tree_positions', { target_tree: treeId });
    return new Map(rows.map((row) => [row.person_id, row]));
  };

  it('Người đầu tiên tự là Thuỷ tổ, Đời 1', async () => {
    const root = await addFirst('Phạm Văn Tổ');

    expect(root.is_progenitor).toBe(true);
    expect((await positions()).get(root.id)).toMatchObject({ generation: 1, kind: 'thuy_to' });
  });

  it('tính Đời qua 5 đời, Dâu cùng Đời với chồng', async () => {
    const g1 = await addFirst('Đời Một');
    const g1Wife = await addSpouse(g1.id, 'Vợ Đời Một');
    const g2 = await addChild(g1.id, 'Đời Hai', { otherParentId: g1Wife });
    const g2Wife = await addSpouse(g2, 'Dâu Đời Hai');
    const g3 = await addChild(g2, 'Đời Ba', { otherParentId: g2Wife });
    const g4 = await addChild(g3, 'Đời Bốn');
    const g5 = await addChild(g4, 'Đời Năm', { gender: 'nu' });
    const g5Husband = await addSpouse(g5, 'Rể Đời Năm', 1, 'nam');

    const pos = await positions();
    expect(pos.get(g1Wife)).toMatchObject({ generation: 1, kind: 'dau_re' });
    expect(pos.get(g2)).toMatchObject({ generation: 2, kind: 'dinh' });
    expect(pos.get(g2Wife)).toMatchObject({ generation: 2, kind: 'dau_re' });
    expect(pos.get(g3)?.generation).toBe(3);
    expect(pos.get(g4)?.generation).toBe(4);
    expect(pos.get(g5)?.generation).toBe(5);
    expect(pos.get(g5Husband)).toMatchObject({ generation: 5, kind: 'dau_re' });
  });

  it('con có đủ cha và mẹ khi chọn người mẹ', async () => {
    const father = await addFirst('Cha');
    const mother = await addSpouse(father.id, 'Mẹ');
    const child = await addChild(father.id, 'Con', { otherParentId: mother });

    const links = await me.query<{ parent_id: string; kind: string }>(
      'select parent_id, kind from parent_links where child_id = $1 order by parent_id',
      [child],
    );
    expect(links.map((link) => link.parent_id).sort()).toEqual([father.id, mother].sort());
    expect(links.every((link) => link.kind === 'ruot')).toBe(true);
  });

  it('một người có hai vợ với thứ tự đúng', async () => {
    const husband = await addFirst('Chồng');
    const second = await addSpouse(husband.id, 'Vợ hai', 2);
    const first = await addSpouse(husband.id, 'Vợ cả', 1);

    const unions = await me.query<{ spouse: string; spouse_order: number; status: string }>(
      `select case when partner_a = $1 then partner_b else partner_a end as spouse,
              case when partner_a = $1 then order_for_a else order_for_b end as spouse_order,
              status
       from unions where partner_a = $1 or partner_b = $1 order by spouse_order`,
      [husband.id],
    );
    expect(unions).toEqual([
      { spouse: first, spouse_order: 1, status: 'con' },
      { spouse: second, spouse_order: 2, status: 'con' },
    ]);
  });

  it('đổi trạng thái hôn phối và loại cha/mẹ', async () => {
    const father = await addFirst('Cha');
    const wife = await addSpouse(father.id, 'Vợ');
    const adopted = await addChild(father.id, 'Con nuôi', { kind: 'nuoi' });

    await me.query("update unions set status = 'ly_hon' where partner_a = $1 or partner_b = $1", [wife]);
    const [union] = await me.query<{ status: string }>('select status from unions where partner_a = $1 or partner_b = $1', [wife]);
    expect(union?.status).toBe('ly_hon');

    const [link] = await me.query<{ kind: string }>('select kind from parent_links where child_id = $1', [adopted]);
    expect(link?.kind).toBe('nuoi');
    await me.query("update parent_links set kind = 'ruot' where child_id = $1", [adopted]);
    const [changed] = await me.query<{ kind: string }>('select kind from parent_links where child_id = $1', [adopted]);
    expect(changed?.kind).toBe('ruot');
  });

  it('thêm cha cho Thuỷ tổ thì cha trở thành Thuỷ tổ và Đời dịch xuống', async () => {
    const oldRoot = await addFirst('Thuỷ tổ cũ');
    const son = await addChild(oldRoot.id, 'Con');
    const newRoot = await addParent(oldRoot.id, 'Cụ cao hơn');

    const pos = await positions();
    expect(pos.get(newRoot)).toMatchObject({ generation: 1, kind: 'thuy_to' });
    expect(pos.get(oldRoot.id)).toMatchObject({ generation: 2, kind: 'dinh' });
    expect(pos.get(son)?.generation).toBe(3);
  });

  it('thêm mẹ khi đã có cha thì mẹ thành vợ của cha', async () => {
    const root = await addFirst('Thuỷ tổ');
    const child = await addChild(root.id, 'Con');
    const mother = await addParent(child, 'Mẹ', 'nu');

    const unions = await me.query('select 1 from unions where (partner_a = $1 and partner_b = $2) or (partner_a = $2 and partner_b = $1)', [
      root.id,
      mother,
    ]);
    expect(unions).toHaveLength(1);
    expect((await positions()).get(mother)).toMatchObject({ generation: 1, kind: 'dau_re' });
  });

  it('Chi tính theo người con Đời 2 của Thuỷ tổ, Dâu theo chi của chồng', async () => {
    const root = await addFirst('Thuỷ tổ');
    const elder = await addChild(root.id, 'Con trưởng', { birthOrder: 1 });
    const younger = await addChild(root.id, 'Con thứ', { birthOrder: 2 });
    const grandchild = await addChild(younger, 'Cháu');
    const wife = await addSpouse(grandchild, 'Dâu');

    const pos = await positions();
    expect(pos.get(root.id)?.branch_id).toBeNull();
    expect(pos.get(elder)?.branch_id).toBe(elder);
    expect(pos.get(grandchild)?.branch_id).toBe(younger);
    expect(pos.get(wife)?.branch_id).toBe(younger);
  });

  it('Người không nối được về Thuỷ tổ không có Đời', async () => {
    await addFirst('Thuỷ tổ');
    const loose = await addFirst('Chưa rõ cha mẹ');

    expect(loose.is_progenitor).toBe(false);
    expect((await positions()).get(loose.id)).toMatchObject({ generation: null, kind: 'chua_noi' });
  });

  it('không tạo được vòng lặp tổ tiên', async () => {
    const root = await addFirst('A');
    const child = await addChild(root.id, 'B');

    await expect(
      me.query("insert into parent_links (child_id, parent_id, kind) values ($1, $2, 'ruot')", [root.id, child]),
    ).rejects.toThrow(/ANCESTOR_CYCLE/);
    await expect(
      me.query("insert into parent_links (child_id, parent_id, kind) values ($1, $1, 'ruot')", [root.id]),
    ).rejects.toThrow();
  });

  it('không nối quan hệ sang Người thuộc Gia phả khác', async () => {
    const root = await addFirst('Thuỷ tổ');
    const [otherTree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ khác') returning id");
    const [outsider] = await me.query<{ id: string }>(
      "insert into persons (tree_id, full_name) values ($1, 'Người họ khác') returning id",
      [otherTree!.id],
    );

    await expect(
      me.query("insert into parent_links (child_id, parent_id, kind) values ($1, $2, 'ruot')", [outsider!.id, root.id]),
    ).rejects.toThrow(/SAME_TREE_REQUIRED/);
    await expect(
      me.query('insert into unions (partner_a, partner_b, order_for_a, order_for_b) values ($1, $2, 1, 1)', [root.id, outsider!.id]),
    ).rejects.toThrow(/SAME_TREE_REQUIRED/);
  });

  it('tài khoản khác không thêm quan hệ vào gia phả không phải của mình', async () => {
    const root = await addFirst('Thuỷ tổ');
    const stranger = db.as(await db.createUser(`la-${crypto.randomUUID()}@example.com`));

    await expect(
      stranger.rpc('add_child', { parent_id: root.id, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'X' } }),
    ).rejects.toThrow();
    expect(await stranger.query('select * from parent_links')).toEqual([]);
    expect(await stranger.query('select * from unions')).toEqual([]);
  });

  it('từ chối khi Gia phả vượt giới hạn số Người', async () => {
    await db.admin.query("update app_settings set value = 2 where key = 'max_persons_per_tree'");
    try {
      const root = await addFirst('Một');
      await addChild(root.id, 'Hai');
      await expect(addChild(root.id, 'Ba')).rejects.toThrow(/PERSON_LIMIT_REACHED/);
    } finally {
      await db.admin.query("update app_settings set value = 2000 where key = 'max_persons_per_tree'");
    }
  });
});
