import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

type PublicPerson = Record<string, unknown> & { id: string; full_name: string };
type PublicTree = {
  tree: { name: string };
  persons: PublicPerson[];
  parentLinks: { child_id: string; parent_id: string }[];
  unions: { partner_a: string; partner_b: string }[];
  positions: { person_id: string; generation: number | null }[];
};

/** Các trường riêng tư của người còn sống: không được xuất hiện trên link công khai (ADR 0002). */
const LIVING_PRIVATE_FIELDS = [
  'birth_month',
  'birth_day',
  'birth_solar_date',
  'birth_place',
  'phone',
  'email',
  'residence',
  'biography',
  'hometown',
  'occupation',
  'common_name',
  'burial_place',
  'burial_map_url',
];
const SECRET_VALUES = ['0912345678', 'song@example.com', 'Số 1 Hàng Bông', 'Tiểu sử riêng', 'Nghĩa trang', 'maps.app.goo.gl'];

describe('seam B: link chia sẻ công khai', () => {
  let db: TestDb;
  let owner: TestUser;
  let me: Caller;
  let treeId: string;
  let ids: Record<string, string>;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  const child = (parentId: string, person: Record<string, unknown>) =>
    me.rpc<string>('add_child', { parent_id: parentId, other_parent_id: null, link_kind: 'ruot', person });

  beforeEach(async () => {
    owner = await db.createUser(`chu-${crypto.randomUUID()}@example.com`);
    me = db.as(owner);
    const [tree] = await me.query<{ id: string }>("insert into family_trees (name) values ('Họ Phạm làng Đông') returning id");
    treeId = tree!.id;

    const [root] = await me.query<{ id: string }>(
      `insert into persons (tree_id, full_name, gender, is_deceased, birth_year, death_year, death_precision,
         biography, burial_place, burial_map_url, occupation)
       values ($1, 'Phạm Văn Tổ', 'nam', true, 1850, 1920, 'nam', 'Khai khẩn làng', 'Nghĩa trang làng',
         'https://maps.app.goo.gl/abc', 'Lý trưởng') returning id`,
      [treeId],
    );
    const living = await child(root!.id, {
      full_name: 'Phạm Văn Sống',
      gender: 'nam',
      birth_precision: 'ngay',
      birth_year: 1960,
      birth_month: 5,
      birth_day: 20,
      phone: '0912345678',
      email: 'song@example.com',
      residence: 'Số 1 Hàng Bông',
      biography: 'Tiểu sử riêng',
      birth_place: 'Hà Nội',
      occupation: 'Kỹ sư',
      common_name: 'Cu Tý',
    });
    const hiddenParent = await child(root!.id, { full_name: 'Phạm Văn Kín', gender: 'nam' });
    const grandchild = await child(hiddenParent, { full_name: 'Phạm Văn Cháu', gender: 'nam', birth_year: 1990 });
    const hiddenLeaf = await child(root!.id, { full_name: 'Phạm Thị Giấu', gender: 'nu' });
    await me.query('update persons set hidden_from_public = true where id = any($1)', [[hiddenParent, hiddenLeaf]]);
    ids = { root: root!.id, living, hiddenParent, grandchild, hiddenLeaf };
  });

  const enable = () => me.rpc<string>('rotate_public_link', { target_tree: treeId });
  const fetchPublic = (token: string | null) => db.asAnon().rpc<PublicTree | null>('public_tree', { token });

  it('Chủ sở hữu bật link; khách không đăng nhập xem được cây', async () => {
    const token = await enable();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    const result = (await fetchPublic(token))!;
    expect(result.tree.name).toBe('Họ Phạm làng Đông');
    expect(result.persons.find((p) => p.id === ids.grandchild)?.full_name).toBe('Phạm Văn Cháu');
    expect(result.positions.find((p) => p.person_id === ids.grandchild)?.generation).toBe(3);
  });

  it('không chứa trường riêng tư nào của người còn sống', async () => {
    const result = (await fetchPublic(await enable()))!;
    const living = result.persons.find((p) => p.id === ids.living)!;
    expect(living).toMatchObject({ full_name: 'Phạm Văn Sống', birth_year: 1960, is_deceased: false });
    for (const field of LIVING_PRIVATE_FIELDS) expect(living, field).not.toHaveProperty(field);

    const raw = JSON.stringify(result);
    for (const secret of SECRET_VALUES) expect(raw, secret).not.toContain(secret);
    expect(raw).not.toContain('Cu Tý');
  });

  it('người đã mất hiện đầy đủ trừ Mộ phần', async () => {
    const result = (await fetchPublic(await enable()))!;
    const root = result.persons.find((p) => p.id === ids.root)!;
    expect(root).toMatchObject({ biography: 'Khai khẩn làng', occupation: 'Lý trưởng', death_year: 1920 });
    expect(root).not.toHaveProperty('burial_place');
    expect(root).not.toHaveProperty('burial_map_url');
  });

  it('người bị ẩn không xuất hiện; con cháu vẫn nối qua ô ẩn danh', async () => {
    const result = (await fetchPublic(await enable()))!;
    const raw = JSON.stringify(result);
    expect(raw).not.toContain('Phạm Văn Kín');
    expect(raw).not.toContain('Phạm Thị Giấu');
    expect(result.persons.some((p) => p.id === ids.hiddenLeaf)).toBe(false);

    const placeholder = result.persons.find((p) => p.id === ids.hiddenParent)!;
    expect(placeholder).toMatchObject({ full_name: 'Ẩn danh', anonymous: true, gender: null, birth_year: null });
    expect(result.parentLinks).toContainEqual(expect.objectContaining({ child_id: ids.grandchild, parent_id: ids.hiddenParent }));
  });

  it('token sai, link đã tắt hoặc đã tạo lại thì không trả về dữ liệu', async () => {
    const first = await enable();
    expect(await fetchPublic('0'.repeat(32))).toBeNull();
    expect(await fetchPublic('không-phải-token')).toBeNull();
    expect(await fetchPublic(null)).toBeNull();

    const second = await enable();
    expect(second).not.toBe(first);
    expect(await fetchPublic(first)).toBeNull();
    expect(await fetchPublic(second)).not.toBeNull();

    await me.rpc('disable_public_link', { target_tree: treeId });
    expect(await fetchPublic(second)).toBeNull();
  });

  it('khách công khai không đọc trực tiếp được bảng nào', async () => {
    await enable();
    const anon = db.asAnon();
    for (const table of [
      'family_trees',
      'persons',
      'parent_links',
      'unions',
      'tree_roles',
      'app_settings',
      'person_photos',
      'reminder_watch',
      'reminder_prefs',
      'notification_reads',
    ]) {
      const rows = await anon.query(`select * from ${table}`).catch(() => []);
      if (table === 'app_settings') continue; // cấu hình chung, không có dữ liệu gia phả
      expect(rows, table).toEqual([]);
    }
    await expect(anon.rpc('tree_positions', { target_tree: treeId })).rejects.toThrow();
  });

  it('chỉ Chủ sở hữu bật/tắt được link', async () => {
    const editor = await db.createUser(`bt-${crypto.randomUUID()}@example.com`);
    await db.admin.query("insert into tree_roles (tree_id, account_id, role) values ($1, $2, 'editor')", [treeId, editor.id]);
    await expect(db.as(editor).rpc('rotate_public_link', { target_tree: treeId })).rejects.toThrow(/NOT_ALLOWED/);
    await expect(db.asAnon().rpc('rotate_public_link', { target_tree: treeId })).rejects.toThrow();
  });

  it('thẻ xem trước chỉ có tên gia phả và số người', async () => {
    const token = await enable();
    expect(await db.asAnon().rpc('public_tree_card', { token })).toEqual({
      name: 'Họ Phạm làng Đông',
      description: null,
      persons: 3,
    });
    expect(await db.asAnon().rpc('public_tree_card', { token: '1'.repeat(32) })).toBeNull();
  });
});
