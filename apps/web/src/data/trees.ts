import { supabase } from '../lib/supabase';
import type { Row } from './database.types';
import { dbErrorMessage, hasDbCode, type DbErrorLike } from './db-error-message';
import type { PersonFields } from '../people/person-form';

/**
 * Lớp truy cập dữ liệu mỏng: chỉ gọi bảng/RPC của database.
 * Mọi quyền và ràng buộc nằm trong database (seam B, ADR 0005).
 */

export type TreeRole = 'owner' | 'editor' | 'viewer';
export type Tree = Pick<Row<'family_trees'>, 'id' | 'name' | 'description' | 'owner_id' | 'created_at' | 'outside_generations' | 'public_token' | 'photo_path'>;
export type TreeWithRole = Tree & { role: TreeRole; linkedPersonId: string | null; /** Số người trong gia phả; chỉ có ở danh sách gia phả của tôi. */ personCount?: number | undefined };
export type Person = Row<'persons'>;

/** Lỗi đã có sẵn câu tiếng Việt để hiển thị. */
export class DataError extends Error {
  constructor(source: DbErrorLike) {
    super(dbErrorMessage(source));
    this.name = 'DataError';
  }
}

/** Ném DataError (đã có câu tiếng Việt) nếu truy vấn trả lỗi. */
export function failOn(error: DbErrorLike | null): asserts error is null {
  if (error) throw new DataError(error);
}

type QueryResult = { data: unknown; error: DbErrorLike | null };

const unwrap = <Result extends QueryResult>({ data, error }: Result): NonNullable<Result['data']> => {
  if (error) throw new DataError(error);
  if (data === null || data === undefined) throw new DataError({ code: 'PGRST116' });
  return data as NonNullable<Result['data']>;
};

const isTreeRole = (value: string): value is TreeRole => value === 'owner' || value === 'editor' || value === 'viewer';

const TREE_COLUMNS = 'id, name, description, owner_id, created_at, outside_generations, public_token, photo_path';

export const listMyTrees = async (accountId: string): Promise<TreeWithRole[]> => {
  const rows = unwrap(
    await supabase
      .from('tree_roles')
      .select(`role, linked_person_id, family_trees (${TREE_COLUMNS}, persons(count))`)
      .eq('account_id', accountId)
      .order('created_at', { ascending: true }),
  );
  return rows.flatMap(({ role, linked_person_id, family_trees: tree }) => {
    if (!tree || !isTreeRole(role)) return [];
    const { persons, ...columns } = tree;
    return [{ ...columns, role, linkedPersonId: linked_person_id, personCount: persons[0]?.count }];
  });
};

export const getTree = async (treeId: string, accountId: string): Promise<TreeWithRole> => {
  const [treeResult, roleResult] = await Promise.all([
    supabase.from('family_trees').select(TREE_COLUMNS).eq('id', treeId).single(),
    supabase.from('tree_roles').select('role, linked_person_id').eq('tree_id', treeId).eq('account_id', accountId).single(),
  ]);
  const tree = unwrap(treeResult);
  const { role, linked_person_id } = unwrap(roleResult);
  if (!isTreeRole(role)) throw new DataError({ code: 'PGRST116' });
  return { ...tree, role, linkedPersonId: linked_person_id };
};

export const createTree = async (input: { name: string; description: string | null }): Promise<Tree> =>
  unwrap(await supabase.from('family_trees').insert(input).select(TREE_COLUMNS).single());

export const renameTree = async (treeId: string, input: { name: string; description: string | null }): Promise<void> => {
  const { error } = await supabase.from('family_trees').update(input).eq('id', treeId);
  if (error) throw new DataError(error);
};

export const setTreeOutsideGenerations = async (treeId: string, outsideGenerations: number): Promise<void> => {
  const { error } = await supabase.from('family_trees').update({ outside_generations: outsideGenerations }).eq('id', treeId);
  if (error) throw new DataError(error);
};

export const deleteTree = async (treeId: string): Promise<void> => {
  const { error } = await supabase.from('family_trees').delete().eq('id', treeId);
  if (error) throw new DataError(error);
};

export const createPerson = async (treeId: string, fields: PersonFields): Promise<Person> =>
  unwrap(await supabase.from('persons').insert({ ...fields, tree_id: treeId }).select('*').single());

export type SaveResult = { status: 'saved'; person: Person } | { status: 'conflict'; current: Person };

/**
 * Lưu hồ sơ với version đã đọc khi mở form. Nếu đã có người lưu trước (database báo STALE_VERSION),
 * trả về bản mới nhất để người dùng chọn — không bao giờ ghi đè im lặng.
 */
export const updatePerson = async (personId: string, fields: PersonFields, version: number): Promise<SaveResult> => {
  const { data, error } = await supabase
    .from('persons')
    .update({ ...fields, version })
    .eq('id', personId)
    .select('*')
    .single();
  if (hasDbCode(error, 'STALE_VERSION')) {
    const current = unwrap(await supabase.from('persons').select('*').eq('id', personId).single());
    return { status: 'conflict', current };
  }
  return { status: 'saved', person: unwrap({ data, error }) };
};

export const deletePerson = async (personId: string): Promise<void> => {
  const { error, count } = await supabase.from('persons').delete({ count: 'exact' }).eq('id', personId);
  if (error) throw new DataError(error);
  if (count === 0) throw new DataError({ code: 'PGRST116' });
};

/** Biên tập viên gửi yêu cầu xoá Người; chờ Chủ sở hữu duyệt (không xoá ngay). */
export const requestDeletePerson = async (personId: string): Promise<void> => {
  const { error } = await supabase.rpc('request_delete_person', { target_person: personId });
  if (error) throw new DataError(error);
};

export const approveDeletePerson = async (personId: string): Promise<void> => {
  const { error } = await supabase.rpc('approve_delete_person', { target_person: personId });
  if (error) throw new DataError(error);
};

export const rejectDeletePerson = async (personId: string): Promise<void> => {
  const { error } = await supabase.rpc('reject_delete_person', { target_person: personId });
  if (error) throw new DataError(error);
};

export type PendingDeletion = { person_id: string; full_name: string; requested_by_email: string; requested_at: string };

/** Yêu cầu xoá đang chờ của một Gia phả; chỉ Chủ sở hữu xem được. */
export const listPendingDeletions = async (treeId: string): Promise<PendingDeletion[]> => {
  const { data, error } = await supabase.rpc('list_pending_deletions', { target_tree: treeId });
  if (error) throw new DataError(error);
  return (data ?? []) as PendingDeletion[];
};
