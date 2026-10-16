import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb, type TestUser } from './harness';

type Tree = { id: string; name: string; description: string | null; owner_id: string };
type Person = { id: string; tree_id: string; full_name: string; gender: string | null; birth_year: number | null; death_year: number | null };

describe('seam B: Gia phả và Người', () => {
  let db: TestDb;
  let owner: TestUser;
  let stranger: TestUser;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  // Mỗi test dùng tài khoản mới nên không đụng dữ liệu của test khác.
  beforeEach(async () => {
    owner = await db.createUser(`chu-${crypto.randomUUID()}@example.com`);
    stranger = await db.createUser(`nguoi-la-${crypto.randomUUID()}@example.com`);
  });

  const createTree = async (user: TestUser, name = 'Gia phả họ Phạm') => {
    const [tree] = await db
      .as(user)
      .query<Tree>(
        'insert into family_trees (name, description) values ($1, $2) returning id, name, description, owner_id',
        [name, 'Chi trưởng'],
      );
    return tree!;
  };

  const addPerson = async (user: TestUser, treeId: string, fullName = 'Phạm Văn Tổ') => {
    const [person] = await db
      .as(user)
      .query<Person>(
        `insert into persons (tree_id, full_name, gender, birth_year, death_year)
         values ($1, $2, 'nam', 1850, 1920)
         returning id, tree_id, full_name, gender, birth_year, death_year`,
        [treeId, fullName],
      );
    return person!;
  };

  describe('Gia phả', () => {
    it('người tạo trở thành Chủ sở hữu và thấy gia phả của mình', async () => {
      const tree = await createTree(owner);

      expect(tree.owner_id).toBe(owner.id);
      const roles = await db
        .as(owner)
        .query<{ role: string }>('select role from tree_roles where tree_id = $1 and account_id = $2', [tree.id, owner.id]);
      expect(roles).toEqual([{ role: 'owner' }]);

      const mine = await db.as(owner).query<Tree>('select id, name from family_trees');
      expect(mine).toEqual([{ id: tree.id, name: 'Gia phả họ Phạm' }]);
    });

    it('không tạo được gia phả đứng tên người khác', async () => {
      await expect(
        db
          .as(stranger)
          .query('insert into family_trees (name, owner_id) values ($1, $2)', ['Giả mạo', owner.id]),
      ).rejects.toThrow();
    });

    it('Chủ sở hữu đổi tên và xoá được', async () => {
      const tree = await createTree(owner);

      await db.as(owner).query('update family_trees set name = $2 where id = $1', [tree.id, 'Họ Phạm Văn']);
      const [renamed] = await db.as(owner).query<Tree>('select name from family_trees where id = $1', [tree.id]);
      expect(renamed?.name).toBe('Họ Phạm Văn');

      await addPerson(owner, tree.id);
      await db.as(owner).query('delete from family_trees where id = $1', [tree.id]);
      const left = await db.admin.query('select count(*)::int as n from persons where tree_id = $1', [tree.id]);
      expect(left.rows).toEqual([{ n: 0 }]);
    });

    it('từ chối gia phả thứ 4 với mã lỗi rõ ràng', async () => {
      await createTree(owner, 'Một');
      await createTree(owner, 'Hai');
      await createTree(owner, 'Ba');

      await expect(createTree(owner, 'Bốn')).rejects.toThrow(/TREE_LIMIT_REACHED/);
    });

    it('giới hạn số gia phả là cấu hình', async () => {
      await db.admin.query("update app_settings set value = 1 where key = 'max_trees_per_account'");
      try {
        await createTree(owner, 'Một');
        await expect(createTree(owner, 'Hai')).rejects.toThrow(/TREE_LIMIT_REACHED/);
      } finally {
        await db.admin.query("update app_settings set value = 3 where key = 'max_trees_per_account'");
      }
    });

    it('tên gia phả không được để trống', async () => {
      await expect(createTree(owner, '   ')).rejects.toThrow();
    });
  });

  describe('Người', () => {
    it('Chủ sở hữu thêm, xem và sửa Người', async () => {
      const tree = await createTree(owner);
      const person = await addPerson(owner, tree.id);

      expect(person).toMatchObject({ full_name: 'Phạm Văn Tổ', gender: 'nam', birth_year: 1850, death_year: 1920 });

      await db.as(owner).query('update persons set full_name = $2 where id = $1', [person.id, 'Phạm Quý Công']);
      const [updated] = await db.as(owner).query<Person>('select full_name from persons where id = $1', [person.id]);
      expect(updated?.full_name).toBe('Phạm Quý Công');
    });

    it('họ tên không được để trống và năm mất không trước năm sinh', async () => {
      const tree = await createTree(owner);

      await expect(addPerson(owner, tree.id, '  ')).rejects.toThrow();
      await expect(
        db
          .as(owner)
          .query('insert into persons (tree_id, full_name, birth_year, death_year) values ($1, $2, 1900, 1890)', [
            tree.id,
            'Sai năm',
          ]),
      ).rejects.toThrow();
    });
  });

  describe('cách ly giữa các tài khoản', () => {
    it('tài khoản khác không đọc, sửa, xoá được gia phả và Người', async () => {
      const tree = await createTree(owner);
      const person = await addPerson(owner, tree.id);
      const asStranger = db.as(stranger);

      expect(await asStranger.query('select * from family_trees')).toEqual([]);
      expect(await asStranger.query('select * from persons')).toEqual([]);
      expect(await asStranger.query('select * from tree_roles')).toEqual([]);

      await asStranger.query('update family_trees set name = $2 where id = $1', [tree.id, 'Bị chiếm']);
      await asStranger.query('update persons set full_name = $2 where id = $1', [person.id, 'Bị sửa']);
      await asStranger.query('delete from persons where id = $1', [person.id]);
      await asStranger.query('delete from family_trees where id = $1', [tree.id]);

      const [treeRow] = await db.as(owner).query<Tree>('select name from family_trees where id = $1', [tree.id]);
      const [personRow] = await db.as(owner).query<Person>('select full_name from persons where id = $1', [person.id]);
      expect(treeRow?.name).toBe('Gia phả họ Phạm');
      expect(personRow?.full_name).toBe('Phạm Văn Tổ');
    });

    it('tài khoản khác không thêm được Người vào gia phả không phải của mình', async () => {
      const tree = await createTree(owner);

      await expect(addPerson(stranger, tree.id, 'Xâm nhập')).rejects.toThrow();
    });

    it('tài khoản khác không tự cấp vai trò cho mình', async () => {
      const tree = await createTree(owner);

      await expect(
        db
          .as(stranger)
          .query("insert into tree_roles (tree_id, account_id, role) values ($1, $2, 'editor')", [tree.id, stranger.id]),
      ).rejects.toThrow();
    });

    it('người chưa đăng nhập không đọc được gì', async () => {
      const tree = await createTree(owner);
      await addPerson(owner, tree.id);
      const anon = db.asAnon();

      expect(await anon.query('select * from family_trees')).toEqual([]);
      expect(await anon.query('select * from persons')).toEqual([]);
      expect(await anon.query('select * from tree_roles')).toEqual([]);
      await expect(anon.query("insert into family_trees (name) values ('x')")).rejects.toThrow();
    });

    it('hàm nội bộ không gọi được từ ngoài', async () => {
      const tree = await createTree(owner);

      await expect(db.asAnon().query('select private.tree_role($1)', [tree.id])).rejects.toThrow(/permission denied/);
      await expect(db.as(stranger).query('select private.grant_owner_role()')).rejects.toThrow();
      const [answer] = await db.as(stranger).query<{ can: boolean }>('select public.can_view_tree($1) as can', [tree.id]);
      expect(answer?.can).toBe(false);
    });
  });
});
