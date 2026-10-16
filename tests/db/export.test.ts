import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import readXlsxFile from 'read-excel-file/node';
import writeXlsxFile from 'write-excel-file/node';
import { exportSheets, familyToRows, rowsToTable, type ExportData, type ExportPerson } from '../../apps/web/src/excel/export';
import { buildImportPreview, type CellValue } from '../../apps/web/src/excel/import-preview';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

describe('seam B: xuất Excel', () => {
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

  const load = async (caller: Caller, id: string): Promise<ExportData> => ({
    persons: await caller.query<ExportPerson>('select * from persons where tree_id = $1', [id]),
    parentLinks: await caller.query('select child_id, parent_id, kind from parent_links where tree_id = $1', [id]),
    unions: await caller.query('select partner_a, partner_b, order_for_a, order_for_b from unions where tree_id = $1', [id]),
  });

  const child = (parentId: string, otherParentId: string | null, person: Record<string, unknown>, kind = 'ruot') =>
    me.rpc<string>('add_child', { parent_id: parentId, other_parent_id: otherParentId, link_kind: kind, person });
  const spouse = (personId: string, order: number, person: Record<string, unknown>) =>
    me.rpc<string>('add_spouse', { person_id: personId, union_order: order, person });

  /** File .xlsx thật: ghi ra rồi đọc lại, trả về các ô của sheet dữ liệu. */
  const roundTripFile = async (data: ExportData) => {
    const buffer = await writeXlsxFile(exportSheets(familyToRows(data))).toBuffer();
    const [sheet] = await readXlsxFile(buffer);
    return sheet!.data as CellValue[][];
  };

  const buildSampleTree = async () => {
    const [root] = await me.query<{ id: string }>(
      `insert into persons (tree_id, full_name, gender, birth_year, birth_precision, birth_approx, is_deceased,
         death_calendar, death_precision, death_year, death_month, death_day, anniversary_day, anniversary_month)
       values ($1, 'Phạm Văn Tổ', 'nam', 1850, 'nam', true, true, 'am', 'ngay', 1920, 3, 12, 12, 3) returning id`,
      [treeId],
    );
    const rootId = root!.id;
    const wife1 = await spouse(rootId, 1, {
      full_name: 'Nguyễn Thị Cả',
      gender: 'nu',
      birth_calendar: 'am',
      birth_precision: 'ngay',
      birth_year: 1855,
      birth_month: 4,
      birth_day: 15,
      birth_leap: false,
    });
    const wife2 = await spouse(rootId, 2, {
      full_name: 'Lê Thị Hai',
      gender: 'nu',
      is_deceased: true,
      death_precision: 'thang',
      death_year: 1930,
      death_month: 7,
      anniversary_day: 5,
      anniversary_month: 6,
      anniversary_manual: true,
    });
    await child(rootId, wife1, { full_name: 'Phạm Văn Trưởng', gender: 'nam', birth_order: 1, birth_year: 1880 });
    const daughter = await child(rootId, wife1, { full_name: 'Phạm Thị Gái', gender: 'nu', birth_order: 2 });
    await child(rootId, wife2, { full_name: 'Phạm Văn Thứ', gender: 'nam', birth_order: 3, occupation: 'Thầy đồ' });
    await child(rootId, null, { full_name: 'Phạm Văn Nuôi', gender: 'nam', birth_order: 4 }, 'nuoi');
    const sonInLaw = await spouse(daughter, 1, { full_name: 'Trần Văn Rể', gender: 'nam', hometown: 'Hà Nam' });
    await child(daughter, sonInLaw, { full_name: 'Trần Văn Ngoại', gender: 'nam', birth_year: 1905 });

    // Một nhánh chưa nối: hai cha con chưa biết nối vào đâu.
    const [lost] = await me.query<{ id: string }>(
      "insert into persons (tree_id, full_name, gender, birth_year) values ($1, 'Phạm Văn Lạc', 'nam', 1890) returning id",
      [treeId],
    );
    await child(lost!.id, null, { full_name: 'Phạm Văn Lạc Con', gender: 'nam', birth_order: 1 });
  };

  it('xuất → nhập lại → xuất lần hai: hai file khớp nhau từng ô', async () => {
    await buildSampleTree();
    const first = await load(me, treeId);
    const firstFile = await roundTripFile(first);

    const preview = buildImportPreview(firstFile);
    expect(preview.errors).toEqual([]);
    expect(preview.total).toBe(first.persons.length);
    expect(preview.unconnected).toBe(2);

    const copyId = await me.rpc<string>('import_new_tree', { tree_name: 'Bản sao', payload: preview.payload });
    const second = await load(me, copyId);
    expect(second.persons).toHaveLength(first.persons.length);
    expect(second.parentLinks).toHaveLength(first.parentLinks.length);
    expect(second.unions).toHaveLength(first.unions.length);

    const secondFile = await roundTripFile(second);
    expect(secondFile).toEqual(firstFile);
  });

  it('file xuất giữ đúng hôn phối, con nuôi, Ngày không đầy đủ và tiếng Việt', async () => {
    await buildSampleTree();
    const table = rowsToTable(familyToRows(await load(me, treeId)));
    const [header, ...rows] = table;
    const column = (name: string) => header!.indexOf(name);
    const row = (name: string) => rows.find((cells) => cells[column('Họ và tên')] === name)!;

    expect(rows[0]![column('Họ và tên')]).toBe('Phạm Văn Tổ');
    expect(row('Phạm Văn Tổ')[column('Ngày sinh')]).toBe('khoảng 1850');
    expect(row('Phạm Văn Tổ')[column('Ngày mất')]).toBe('12/3/1920');
    expect(row('Phạm Văn Tổ')[column('Lịch ngày mất')]).toBe('Âm');
    expect(row('Lê Thị Hai')[column('Thứ tự hôn phối')]).toBe('2');
    expect(row('Lê Thị Hai')[column('Ngày giỗ (âm)')]).toBe('5/6');
    expect(row('Lê Thị Hai')[column('Ngày mất')]).toBe('7/1930');
    expect(row('Phạm Văn Nuôi')[column('Con ruột/nuôi')]).toBe('Nuôi');
    expect(row('Trần Văn Rể')[column('Mã vợ/chồng')]).toBe(row('Phạm Thị Gái')[column('Mã')]);
    expect(row('Phạm Văn Lạc Con')[column('Mã cha')]).toBe(row('Phạm Văn Lạc')[column('Mã')]);
  });

  it('Người xem xuất được; người không có vai trò không đọc được dữ liệu để xuất', async () => {
    await buildSampleTree();
    const viewer = await db.createUser(`xem-${crypto.randomUUID()}@example.com`);
    await db.admin.query("insert into tree_roles (tree_id, account_id, role) values ($1, $2, 'viewer')", [treeId, viewer.id]);
    expect(familyToRows(await load(db.as(viewer), treeId))).toHaveLength(11);

    const stranger = await db.createUser(`la-${crypto.randomUUID()}@example.com`);
    expect(familyToRows(await load(db.as(stranger), treeId))).toEqual([]);
  });
});
