import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb } from './harness';

describe('seam B: hồ sơ Người và Ngày không đầy đủ', () => {
  let db: TestDb;
  let me: Caller;
  let treeId: string;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    me = db.as(await db.createUser(`chu-${crypto.randomUUID()}@example.com`));
    const [tree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
  });

  const insert = async (fields: Record<string, unknown>) => {
    const columns = Object.keys(fields);
    const [row] = await me.query<Record<string, unknown>>(
      `insert into persons (tree_id, full_name, ${columns.join(', ')})
       values ($1, 'Thử', ${columns.map((_, index) => `$${index + 2}`).join(', ')})
       returning *`,
      [treeId, ...Object.values(fields)],
    );
    return row!;
  };

  it.each([
    ['duong', 'nam', { birth_year: 1890, birth_approx: true }],
    ['duong', 'thang', { birth_year: 1925, birth_month: 3 }],
    ['duong', 'ngay', { birth_year: 1945, birth_month: 9, birth_day: 2, birth_solar_date: '1945-09-02' }],
    ['am', 'nam', { birth_year: 1890 }],
    ['am', 'thang', { birth_year: 2025, birth_month: 6, birth_leap: true }],
    ['am', 'ngay', { birth_year: 2026, birth_month: 1, birth_day: 1, birth_solar_date: '2026-02-17' }],
  ])('lưu và đọc lại ngày sinh %s, độ chính xác %s', async (calendar, precision, fields) => {
    const row = await insert({ birth_calendar: calendar, birth_precision: precision, ...fields });

    expect(row).toMatchObject({
      birth_calendar: calendar,
      birth_precision: precision,
      birth_month: null,
      birth_day: null,
      birth_leap: false,
      birth_approx: false,
      ...fields,
    });
  });

  it('chỉ ghi năm thì độ chính xác tự là "năm"', async () => {
    expect(await insert({ birth_year: 1925, death_year: 1990 })).toMatchObject({ birth_precision: 'nam', death_precision: 'nam' });
  });

  it('độ chính xác không có năm đi kèm thì bị bỏ', async () => {
    expect(await insert({ birth_precision: 'nam' })).toMatchObject({ birth_precision: null });
  });

  it('xoá năm thì xoá luôn độ chính xác', async () => {
    const row = await insert({ birth_year: 1925 });
    const [updated] = await me.query<Record<string, unknown>>(
      'update persons set birth_year = null where id = $1 returning birth_precision',
      [row.id],
    );
    expect(updated).toEqual({ birth_precision: null });
  });

  it('lưu ngày mất, ngày giỗ và đánh dấu giỗ sửa tay', async () => {
    const row = await insert({
      is_deceased: true,
      death_calendar: 'duong',
      death_precision: 'ngay',
      death_year: 2020,
      death_month: 8,
      death_day: 10,
      death_solar_date: '2020-08-10',
      anniversary_day: 21,
      anniversary_month: 6,
      anniversary_manual: true,
    });

    expect(row).toMatchObject({ anniversary_day: 21, anniversary_month: 6, anniversary_manual: true, death_precision: 'ngay' });
  });

  it('lưu các trường văn bản của hồ sơ', async () => {
    const fields = {
      common_name: 'Cả Tổ',
      taboo_name: 'Phạm Công',
      courtesy_name: 'Minh Đức',
      han_name: '范公',
      birth_place: 'Làng Đông',
      hometown: 'Nam Định',
      residence: 'Hà Nội',
      occupation: 'Thầy đồ',
      education: 'Tú tài',
      title: 'Lý trưởng',
      phone: '0912 345 678',
      email: 'to@example.com',
      biography: 'Dạy học ở làng.',
      role_note: 'Trưởng chi 2',
      burial_place: 'Nghĩa trang làng Đông',
      burial_map_url: 'https://maps.app.goo.gl/abc123',
      worship_place: 'Nhà thờ họ',
      worship_keeper: 'Phạm Văn Long',
    };

    expect(await insert(fields)).toMatchObject(fields);
  });

  it.each([
    ['thiếu tháng khi chọn tháng-năm', { birth_year: 1925, birth_precision: 'thang' }],
    ['có ngày khi chỉ chọn năm', { birth_year: 1925, birth_precision: 'nam', birth_month: 3, birth_day: 1 }],
    ['thiếu ngày khi chọn đủ ngày', { birth_year: 1925, birth_precision: 'ngay', birth_month: 3 }],
    ['tháng nhuận ở dương lịch', { birth_year: 2025, birth_precision: 'thang', birth_month: 6, birth_leap: true }],
    ['có tháng mà không ghi độ chính xác', { birth_year: 1925, birth_month: 3, birth_precision: null }],
    ['ngày giỗ thiếu tháng', { anniversary_day: 7 }],
    ['link mộ không phải https', { burial_map_url: 'javascript:alert(1)' }],
  ])('từ chối dữ liệu không nhất quán: %s', async (_name, fields) => {
    await expect(insert(fields)).rejects.toThrow();
  });

  it('các thao tác thêm quan hệ nhận đủ trường hồ sơ', async () => {
    const [root] = await me.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Tổ') returning id", [treeId]);
    const childId = await me.rpc<string>('add_child', {
      parent_id: root!.id,
      other_parent_id: null,
      link_kind: 'ruot',
      person: {
        full_name: 'Con',
        hometown: 'Nam Định',
        birth_calendar: 'am',
        birth_precision: 'ngay',
        birth_year: 2026,
        birth_month: 1,
        birth_day: 1,
        birth_solar_date: '2026-02-17',
        is_progenitor: true,
        tree_id: '00000000-0000-0000-0000-000000000000',
      },
    });

    const [child] = await me.query<Record<string, unknown>>('select * from persons where id = $1', [childId]);
    expect(child).toMatchObject({
      tree_id: treeId,
      is_progenitor: false,
      hometown: 'Nam Định',
      birth_calendar: 'am',
      birth_precision: 'ngay',
      birth_solar_date: '2026-02-17',
    });
  });
});
