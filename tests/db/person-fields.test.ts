import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PERSON_SYSTEM_COLUMNS,
  PUBLIC_BASE_FIELDS,
  PUBLIC_NEVER_FIELDS,
  PUBLIC_WHEN_DECEASED_FIELDS,
} from '../../apps/web/src/people/person-columns';
import { PERSON_FIELD_KEYS } from '../../apps/web/src/people/person-form';
import { createTestDb, type Caller, type TestDb } from './harness';

/** Một giá trị hợp lệ cho từng trường hồ sơ; thiếu hoặc thừa trường so với PERSON_FIELD_KEYS thì test hỏng. */
const SAMPLE: Record<(typeof PERSON_FIELD_KEYS)[number], unknown> = {
  full_name: 'Phạm Văn Mẫu',
  gender: 'nam',
  birth_order: 2,
  common_name: 'Cu Mẫu',
  taboo_name: 'Huý Mẫu',
  courtesy_name: 'Tự Mẫu',
  han_name: '范文模',
  birth_calendar: 'am',
  birth_precision: 'ngay',
  birth_year: 1950,
  birth_month: 3,
  birth_day: 12,
  birth_leap: true,
  birth_approx: true,
  birth_solar_date: '1950-04-28',
  birth_place: 'Nam Định',
  hometown: 'Hà Nam',
  residence: 'Hà Nội',
  occupation: 'Thầy giáo',
  education: 'Đại học',
  title: 'Trưởng chi',
  phone: '0900000000',
  email: 'mau@example.com',
  biography: 'Tiểu sử',
  role_note: 'Trưởng chi 2',
  is_deceased: true,
  death_calendar: 'am',
  death_precision: 'ngay',
  death_year: 2010,
  death_month: 5,
  death_day: 7,
  death_leap: false,
  death_approx: true,
  death_solar_date: '2010-06-18',
  anniversary_day: 6,
  anniversary_month: 5,
  anniversary_manual: true,
  burial_place: 'Nghĩa trang X',
  burial_map_url: 'https://maps.example.com/x',
  worship_place: 'Nhà thờ họ',
  worship_keeper_id: null, // đặt lúc chạy: phải là một Người có thật trong cùng gia phả
};

describe('seam B: trường hồ sơ Người khớp giữa TS và SQL', () => {
  let db: TestDb;
  let owner: Caller;
  let treeId: string;
  let rootId: string;

  beforeAll(async () => {
    db = await createTestDb();
    owner = db.as(await db.createUser(`chu-${crypto.randomUUID()}@example.com`));
    const [tree] = await owner.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm') returning id");
    treeId = tree!.id;
    rootId = (await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Tổ') returning id", [treeId]))[0]!.id;
  });

  afterAll(async () => {
    await db.close();
  });

  it('mọi cột của bảng persons là trường hồ sơ hoặc cột hệ thống (thêm cột mà chưa phân loại thì hỏng)', async () => {
    const columns = (await db.admin.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema = 'public' and table_name = 'persons'")).rows.map((r) => r.column_name);
    expect([...columns].sort()).toEqual([...PERSON_FIELD_KEYS, ...PERSON_SYSTEM_COLUMNS].sort());
  });

  it('mẫu phủ đúng mọi trường hồ sơ', () => {
    expect(Object.keys(SAMPLE).sort()).toEqual([...PERSON_FIELD_KEYS].sort());
  });

  it('insert_person (qua add_child) lưu đủ mọi trường hồ sơ', async () => {
    const keeper = await owner.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { full_name: 'Phụ trách' } });
    const sample = { ...SAMPLE, worship_keeper_id: keeper };
    const id = await owner.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: sample });
    const [row] = await owner.query<Record<string, unknown>>('select * from persons where id = $1', [id]);
    for (const key of PERSON_FIELD_KEYS) {
      // birth_order do add_child đặt lại nếu để trống; ở đây có giá trị nên giữ nguyên.
      expect(row![key], key).toEqual(sample[key]);
    }
  });

  it('merge_persons điền được mọi trường hồ sơ còn trống từ người bị gộp', async () => {
    const keep = (await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Giữ') returning id", [treeId]))[0]!.id;
    const keeper = (await owner.query<{ id: string }>("insert into persons (tree_id, full_name) values ($1, 'Người cúng') returning id", [treeId]))[0]!.id;
    const drop = await owner.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { ...SAMPLE, worship_keeper_id: keeper } });
    await owner.rpc('merge_persons', { keep_person: keep, drop_person: drop });
    const [row] = await owner.query<Record<string, unknown>>('select * from persons where id = $1', [keep]);
    // worship_keeper_id không được điền tự động (tham chiếu), và full_name của người giữ được giữ nguyên.
    for (const key of PERSON_FIELD_KEYS) {
      if (key === 'full_name' || key === 'worship_keeper_id' || key === 'birth_order') continue;
      expect(row![key], key).toEqual(SAMPLE[key]);
    }
  });

  it('bản công khai: đúng các trường đã phân loại, không lộ trường riêng tư', async () => {
    const dead = await owner.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: SAMPLE });
    const alive = await owner.rpc<string>('add_child', { parent_id: rootId, other_parent_id: null, link_kind: 'ruot', person: { ...SAMPLE, is_deceased: false, death_year: null, death_precision: null, death_month: null, death_day: null, death_solar_date: null, death_approx: false, anniversary_day: null, anniversary_month: null, full_name: 'Còn sống' } });
    const token = await owner.rpc<string>('rotate_public_link', { target_tree: treeId, password: 'matkhau' });
    const payload = await db.asAnon().rpc<{ persons: Record<string, unknown>[] }>('public_tree', { token, password: 'matkhau' });
    const keys = (id: string) => Object.keys(payload.persons.find((p) => p.id === id)!);

    const publicFields = [...PUBLIC_BASE_FIELDS, ...PUBLIC_WHEN_DECEASED_FIELDS] as string[];
    for (const never of PUBLIC_NEVER_FIELDS) {
      expect(keys(dead), never).not.toContain(never);
      expect(keys(alive), never).not.toContain(never);
    }
    for (const field of PUBLIC_WHEN_DECEASED_FIELDS) {
      expect(keys(dead), field).toContain(field);
      expect(keys(alive), field).not.toContain(field);
    }
    for (const field of PUBLIC_BASE_FIELDS) expect(keys(alive), field).toContain(field);
    // Không có khoá lạ ngoài danh sách đã phân loại (và vài khoá cấu trúc).
    const structural = ['id', 'is_progenitor', 'anonymous', 'worship_keeper'];
    for (const key of [...keys(dead), ...keys(alive)]) expect([...publicFields, ...structural], key).toContain(key);
  });
});
