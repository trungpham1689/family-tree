import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildImportPreview } from '../../apps/web/src/excel/import-preview';
import { COLUMNS, EXAMPLE_ROWS } from '../../apps/web/src/excel/columns';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

type Position = { person_id: string; generation: number | null; kind: string };

const examplePayload = () => {
  const table = [COLUMNS.map((c) => c.header), ...EXAMPLE_ROWS.map((row) => COLUMNS.map((c) => row[c.key] ?? null))];
  return buildImportPreview(table).payload!;
};

describe('seam B: nhập Excel', () => {
  let db: TestDb;
  let owner: TestUser;
  let me: Caller;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    owner = await db.createUser(`chu-${crypto.randomUUID()}@example.com`);
    me = db.as(owner);
  });

  it('tạo gia phả mới và lưu đủ Người, quan hệ, Thuỷ tổ, Đời', async () => {
    const treeId = await me.rpc<string>('import_new_tree', { tree_name: 'Họ Phạm (Excel)', payload: examplePayload() });

    const persons = await me.query<{ id: string; full_name: string; is_progenitor: boolean }>(
      'select id, full_name, is_progenitor from persons where tree_id = $1',
      [treeId],
    );
    expect(persons).toHaveLength(EXAMPLE_ROWS.length);
    expect(persons.filter((p) => p.is_progenitor).map((p) => p.full_name)).toEqual(['Phạm Văn Tổ']);

    const positions = await me.rpcRows<Position>('tree_positions', { target_tree: treeId });
    const byName = new Map(persons.map((p) => [p.full_name, positions.find((pos) => pos.person_id === p.id)!]));
    expect(byName.get('Phạm Văn Bình')).toMatchObject({ generation: 4, kind: 'dinh' });
    expect(byName.get('Lê Văn Rể')?.kind).toBe('dau_re');
    expect(Math.max(...positions.map((p) => p.generation ?? 0))).toBe(4);
  });

  it('lưu cả tình trạng hôn phối, ngày cưới, người phụ trách cúng giỗ, cờ ẩn và lập chi', async () => {
    const rows: Record<string, string>[] = [
      { code: 'A', fullName: 'Ông A', gender: 'Nam', hiddenFromPublic: 'Có', worshipKeeperCode: 'B' },
      { code: 'B', fullName: 'Con B', gender: 'Nam', fatherCode: 'A', foundsBranch: 'Có' },
      { code: 'V', fullName: 'Bà V', gender: 'Nữ', spouseCode: 'A', spouseOrder: '1', spouseStatus: 'Goá', marriageDate: '15/8/1950' },
    ];
    const table = [COLUMNS.map((c) => c.header), ...rows.map((row) => COLUMNS.map((c) => row[c.key] ?? null))];
    const preview = buildImportPreview(table);
    expect(preview.errors).toEqual([]);
    const treeId = await me.rpc<string>('import_new_tree', { tree_name: 'Đủ trường', payload: preview.payload });

    const [a] = await me.query<{ hidden_from_public: boolean; worship_keeper_id: string | null }>(
      "select hidden_from_public, worship_keeper_id from persons where tree_id = $1 and full_name = 'Ông A'", [treeId]);
    const [b] = await me.query<{ id: string; founds_branch: boolean }>("select id, founds_branch from persons where tree_id = $1 and full_name = 'Con B'", [treeId]);
    expect(a).toMatchObject({ hidden_from_public: true, worship_keeper_id: b!.id });
    expect(b!.founds_branch).toBe(true);
    const [union] = await me.query<{ status: string; marriage_year: number; marriage_month: number; marriage_day: number }>(
      'select status, marriage_year, marriage_month, marriage_day from unions where tree_id = $1', [treeId]);
    expect(union).toEqual({ status: 'goa', marriage_year: 1950, marriage_month: 8, marriage_day: 15 });
  });

  it('800 người, 8 đời lưu trong vòng 1 phút', async () => {
    const rows = [{ code: 'P0', fullName: 'Tổ', gender: 'Nam' } as Record<string, string>];
    for (let index = 1; index < 800; index += 1) {
      rows.push({ code: `P${index}`, fullName: `Người ${index}`, gender: 'Nam', fatherCode: `P${Math.floor((index - 1) / 2.6)}` });
    }
    const table = [COLUMNS.map((c) => c.header), ...rows.map((row) => COLUMNS.map((c) => row[c.key] ?? null))];
    const preview = buildImportPreview(table);
    expect(preview.generations).toBeGreaterThanOrEqual(7);

    const started = Date.now();
    const treeId = await me.rpc<string>('import_new_tree', { tree_name: 'Đông', payload: preview.payload });
    expect(Date.now() - started).toBeLessThan(60_000);
    const [{ count }] = (await me.query<{ count: number }>('select count(*)::int as count from persons where tree_id = $1', [treeId])) as [
      { count: number },
    ];
    expect(count).toBe(800);
  }, 90_000);

  it('nhập vào gia phả trống của mình được, gia phả đã có người thì không', async () => {
    const [tree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Trống') returning id");
    expect(await me.rpc<number>('import_into_tree', { target_tree: tree!.id, payload: examplePayload() })).toBe(EXAMPLE_ROWS.length);
    await expect(me.rpc('import_into_tree', { target_tree: tree!.id, payload: examplePayload() })).rejects.toThrow(/TREE_NOT_EMPTY/);
  });

  it('người không phải Chủ sở hữu không nhập được', async () => {
    const [tree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Của tôi') returning id");
    const stranger = await db.createUser(`la-${crypto.randomUUID()}@example.com`);
    await expect(db.as(stranger).rpc('import_into_tree', { target_tree: tree!.id, payload: examplePayload() })).rejects.toThrow();
  });

  it('vẫn tôn trọng giới hạn 3 gia phả và số Người, và lỗi thì không lưu gì', async () => {
    for (const name of ['Một', 'Hai', 'Ba']) await me.query('insert into family_trees (name) values ($1)', [name]);
    await expect(me.rpc('import_new_tree', { tree_name: 'Bốn', payload: examplePayload() })).rejects.toThrow(/TREE_LIMIT_REACHED/);

    const other = db.as(await db.createUser(`khac-${crypto.randomUUID()}@example.com`));
    await db.admin.query("update app_settings set value = 5 where key = 'max_persons_per_tree'");
    try {
      await expect(other.rpc('import_new_tree', { tree_name: 'Quá đông', payload: examplePayload() })).rejects.toThrow(
        /PERSON_LIMIT_REACHED/,
      );
      expect(await other.query('select * from family_trees')).toEqual([]);
    } finally {
      await db.admin.query("update app_settings set value = 2000 where key = 'max_persons_per_tree'");
    }
  });
});
