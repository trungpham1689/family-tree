import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Caller, type TestDb, type TestUser } from './harness';

type PersonRow = { id: string; full_name: string; created_by: string | null; pending_delete_by: string | null };
type Pending = { person_id: string; full_name: string; requested_by_email: string };

describe('seam B: phân quyền Biên tập viên trên Người', () => {
  let db: TestDb;
  let owner: TestUser;
  let me: Caller;
  let treeId: string;
  let rootId: string;

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
    const [root] = await me.query<PersonRow>(
      'insert into persons (tree_id, full_name) values ($1, $2) returning id, full_name, created_by, pending_delete_by',
      [treeId, 'Thuỷ tổ'],
    );
    rootId = root!.id;
  });

  const inviteEditor = async () => {
    const editor = await db.createUser(`bt-${crypto.randomUUID()}@example.com`);
    await me.rpc('invite_to_tree', { target_tree: treeId, invite_email: editor.email, new_role: 'editor' });
    return editor;
  };

  const readPerson = async (id: string) =>
    (await me.query<PersonRow>('select id, full_name, created_by, pending_delete_by from persons where id = $1', [id]))[0]!;

  it('Người mới tự ghi created_by là người tạo', async () => {
    const editor = await inviteEditor();
    const childId = await db.as(editor).rpc<string>('add_child', {
      parent_id: rootId,
      other_parent_id: null,
      link_kind: 'ruot',
      person: { full_name: 'Con của Biên tập viên' },
    });
    expect((await readPerson(childId)).created_by).toBe(editor.id);
  });

  it('Biên tập viên sửa được Người mình tạo, không sửa được Người người khác tạo', async () => {
    const editor = await inviteEditor();
    const asEditor = db.as(editor);
    const childId = await asEditor.rpc<string>('add_child', {
      parent_id: rootId,
      other_parent_id: null,
      link_kind: 'ruot',
      person: { full_name: 'Con' },
    });

    const [updated] = await asEditor.query<PersonRow>(
      "update persons set full_name = 'Con đã sửa' where id = $1 returning id, full_name, created_by, pending_delete_by",
      [childId],
    );
    expect(updated?.full_name).toBe('Con đã sửa');

    // RLS lọc theo using-clause: không khớp dòng nào thì không sửa được gì, không báo lỗi.
    expect(await asEditor.query("update persons set full_name = 'Chiếm quyền' where id = $1", [rootId])).toEqual([]);
    expect((await readPerson(rootId)).full_name).toBe('Thuỷ tổ');
  });

  it('Biên tập viên không xoá trực tiếp được, kể cả Người mình tạo', async () => {
    const editor = await inviteEditor();
    const asEditor = db.as(editor);
    const childId = await asEditor.rpc<string>('add_child', {
      parent_id: rootId,
      other_parent_id: null,
      link_kind: 'ruot',
      person: { full_name: 'Con' },
    });

    // RLS xoá chỉ cho Chủ sở hữu: không khớp dòng nào, không báo lỗi, Người vẫn còn.
    expect(await asEditor.query('delete from persons where id = $1', [childId])).toEqual([]);
    expect(await readPerson(childId)).toBeTruthy();
  });

  it('Biên tập viên gửi yêu cầu xoá Người mình tạo: chưa mất, chờ duyệt', async () => {
    const editor = await inviteEditor();
    const asEditor = db.as(editor);
    const childId = await asEditor.rpc<string>('add_child', {
      parent_id: rootId,
      other_parent_id: null,
      link_kind: 'ruot',
      person: { full_name: 'Con' },
    });

    await asEditor.rpc('request_delete_person', { target_person: childId });
    const row = await readPerson(childId);
    expect(row.pending_delete_by).toBe(editor.id);

    const pending = await me.rpcRows<Pending>('list_pending_deletions', { target_tree: treeId });
    expect(pending).toContainEqual(expect.objectContaining({ person_id: childId, full_name: 'Con', requested_by_email: editor.email }));
  });

  it('Biên tập viên không gửi được yêu cầu xoá Người người khác tạo', async () => {
    const editor = await inviteEditor();
    await expect(db.as(editor).rpc('request_delete_person', { target_person: rootId })).rejects.toThrow(/NOT_ALLOWED/);
  });

  it('Chủ sở hữu gọi request_delete_person thì xoá ngay, không qua hàng chờ', async () => {
    await me.rpc('request_delete_person', { target_person: rootId });
    expect(await me.query('select 1 from persons where id = $1', [rootId])).toEqual([]);
  });

  it('Chủ sở hữu duyệt: xoá hẳn Người đang chờ', async () => {
    const editor = await inviteEditor();
    const asEditor = db.as(editor);
    const childId = await asEditor.rpc<string>('add_child', {
      parent_id: rootId,
      other_parent_id: null,
      link_kind: 'ruot',
      person: { full_name: 'Con' },
    });
    await asEditor.rpc('request_delete_person', { target_person: childId });

    await me.rpc('approve_delete_person', { target_person: childId });
    expect(await me.query('select 1 from persons where id = $1', [childId])).toEqual([]);
  });

  it('Chủ sở hữu từ chối: Người hết chờ, vẫn còn', async () => {
    const editor = await inviteEditor();
    const asEditor = db.as(editor);
    const childId = await asEditor.rpc<string>('add_child', {
      parent_id: rootId,
      other_parent_id: null,
      link_kind: 'ruot',
      person: { full_name: 'Con' },
    });
    await asEditor.rpc('request_delete_person', { target_person: childId });

    await me.rpc('reject_delete_person', { target_person: childId });
    expect((await readPerson(childId)).pending_delete_by).toBeNull();
  });

  it('người không phải Chủ sở hữu không duyệt/từ chối/xem hàng chờ được', async () => {
    const editor = await inviteEditor();
    const asEditor = db.as(editor);
    const childId = await asEditor.rpc<string>('add_child', {
      parent_id: rootId,
      other_parent_id: null,
      link_kind: 'ruot',
      person: { full_name: 'Con' },
    });
    await asEditor.rpc('request_delete_person', { target_person: childId });

    await expect(asEditor.rpc('approve_delete_person', { target_person: childId })).rejects.toThrow(/NOT_ALLOWED/);
    await expect(asEditor.rpc('reject_delete_person', { target_person: childId })).rejects.toThrow(/NOT_ALLOWED/);
    await expect(asEditor.rpcRows('list_pending_deletions', { target_tree: treeId })).rejects.toThrow(/NOT_ALLOWED/);
  });

  it('Biên tập viên không mời được người khác nữa', async () => {
    const editor = await inviteEditor();
    const stranger = await db.createUser(`la-${crypto.randomUUID()}@example.com`);
    await expect(
      db.as(editor).rpc('invite_to_tree', { target_tree: treeId, invite_email: stranger.email, new_role: 'viewer' }),
    ).rejects.toThrow(/NOT_ALLOWED/);
  });
});
