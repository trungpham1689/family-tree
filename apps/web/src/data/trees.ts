import { supabase } from '../lib/supabase';
import type { Row } from './database.types';
import { dbErrorMessage, type DbErrorLike } from './db-error-message';
import type { PersonFields } from '../people/person-form';

/**
 * Lớp truy cập dữ liệu mỏng: chỉ gọi bảng/RPC của database.
 * Mọi quyền và ràng buộc nằm trong database (seam B, ADR 0005).
 */

export type TreeRole = 'owner' | 'editor' | 'viewer';
export type Tree = Pick<Row<'family_trees'>, 'id' | 'name' | 'description' | 'owner_id' | 'created_at' | 'outside_generations' | 'public_token'>;
export type TreeWithRole = Tree & { role: TreeRole };
export type Person = Row<'persons'>;

/** Lỗi đã có sẵn câu tiếng Việt để hiển thị. */
export class DataError extends Error {
  constructor(source: DbErrorLike) {
    super(dbErrorMessage(source));
    this.name = 'DataError';
  }
}

type QueryResult = { data: unknown; error: DbErrorLike | null };

const unwrap = <Result extends QueryResult>({ data, error }: Result): NonNullable<Result['data']> => {
  if (error) throw new DataError(error);
  if (data === null || data === undefined) throw new DataError({ code: 'PGRST116' });
  return data as NonNullable<Result['data']>;
};

const isTreeRole = (value: string): value is TreeRole => value === 'owner' || value === 'editor' || value === 'viewer';

const TREE_COLUMNS = 'id, name, description, owner_id, created_at, outside_generations, public_token';

export const listMyTrees = async (accountId: string): Promise<TreeWithRole[]> => {
  const rows = unwrap(
    await supabase
      .from('tree_roles')
      .select(`role, family_trees (${TREE_COLUMNS})`)
      .eq('account_id', accountId)
      .order('created_at', { ascending: true }),
  );
  return rows.flatMap(({ role, family_trees: tree }) =>
    tree && isTreeRole(role) ? [{ ...tree, role }] : [],
  );
};

export const getTree = async (treeId: string, accountId: string): Promise<TreeWithRole> => {
  const tree = unwrap(await supabase.from('family_trees').select(TREE_COLUMNS).eq('id', treeId).single());
  const { role } = unwrap(
    await supabase.from('tree_roles').select('role').eq('tree_id', treeId).eq('account_id', accountId).single(),
  );
  if (!isTreeRole(role)) throw new DataError({ code: 'PGRST116' });
  return { ...tree, role };
};

export const createTree = async (input: { name: string; description: string | null }): Promise<Tree> =>
  unwrap(await supabase.from('family_trees').insert(input).select(TREE_COLUMNS).single());

export const renameTree = async (treeId: string, name: string): Promise<void> => {
  const { error } = await supabase.from('family_trees').update({ name }).eq('id', treeId);
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
  if (error?.message?.includes('STALE_VERSION')) {
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
