import { supabase } from '../lib/supabase';
import type { ParentLinkKind, UnionStatus } from '../family/family-graph';
import type { PersonFields } from '../people/person-form';
import type { Row } from './database.types';
import { DataError } from './trees';

export type FamilyData = {
  persons: Row<'persons'>[];
  parentLinks: Row<'parent_links'>[];
  unions: Row<'unions'>[];
  positions: { person_id: string; generation: number | null; branch_id: string | null; kind: string }[];
};

const check = <T>({ data, error }: { data: T | null; error: { code?: string; message?: string } | null }): T => {
  if (error) throw new DataError(error);
  return data as T;
};

/** Tải cả Gia phả một lần (vài trăm dòng), rồi dựng đồ thị trong bộ nhớ. */
export const loadFamily = async (treeId: string): Promise<FamilyData> => {
  const [persons, parentLinks, unions, positions] = await Promise.all([
    supabase.from('persons').select('*').eq('tree_id', treeId),
    supabase.from('parent_links').select('*').eq('tree_id', treeId),
    supabase.from('unions').select('*').eq('tree_id', treeId),
    supabase.rpc('tree_positions', { target_tree: treeId }),
  ]);
  return {
    persons: check(persons) ?? [],
    parentLinks: check(parentLinks) ?? [],
    unions: check(unions) ?? [],
    positions: check(positions) ?? [],
  };
};

export const addChild = async (input: {
  parentId: string;
  otherParentId: string | null;
  kind: ParentLinkKind;
  fields: PersonFields;
}): Promise<string> =>
  check(
    await supabase.rpc('add_child', {
      parent_id: input.parentId,
      other_parent_id: input.otherParentId,
      link_kind: input.kind,
      person: input.fields,
    }),
  );

export const addParent = async (input: { childId: string; kind: ParentLinkKind; fields: PersonFields }): Promise<string> =>
  check(await supabase.rpc('add_parent', { child_id: input.childId, link_kind: input.kind, person: input.fields }));

export const addSpouse = async (input: { personId: string; order: number | null; fields: PersonFields }): Promise<string> =>
  check(await supabase.rpc('add_spouse', { person_id: input.personId, union_order: input.order, person: input.fields }));

/** Đổi thứ tự hôn phối (nhìn từ phía `viewerId`) và/hoặc trạng thái của một cuộc hôn phối. */
export const updateUnion = async (input: {
  unionId: string;
  viewerId: string;
  order?: number;
  status?: UnionStatus;
}): Promise<void> => {
  const { data: union, error: readError } = await supabase
    .from('unions')
    .select('partner_a')
    .eq('id', input.unionId)
    .single();
  if (readError) throw new DataError(readError);
  const orderColumn = union.partner_a === input.viewerId ? 'order_for_a' : 'order_for_b';
  const { error } = await supabase
    .from('unions')
    .update({
      ...(input.order !== undefined ? { [orderColumn]: input.order } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .eq('id', input.unionId);
  if (error) throw new DataError(error);
};

/** Đổi Thứ tự hôn phối (nhìn từ phía viewerId) theo danh sách đã kéo thả. */
export const reorderUnions = async (input: { viewerId: string; orderedUnionIds: string[] }): Promise<void> => {
  await Promise.all(
    input.orderedUnionIds.map((unionId, index) => updateUnion({ unionId, viewerId: input.viewerId, order: index + 1 })),
  );
};

export const updateParentLinkKind = async (input: { childId: string; parentId: string; kind: ParentLinkKind }) => {
  const { error } = await supabase
    .from('parent_links')
    .update({ kind: input.kind })
    .eq('child_id', input.childId)
    .eq('parent_id', input.parentId);
  if (error) throw new DataError(error);
};

/** Đổi Thứ tự con: ghi lại liên tục 1..N theo danh sách đã kéo thả (gồm con của mọi vợ/chồng). */
export const reorderChildren = async (orderedChildIds: string[]): Promise<void> => {
  const results = await Promise.all(
    orderedChildIds.map((childId, index) => supabase.from('persons').update({ birth_order: index + 1 }).eq('id', childId)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new DataError(failed.error);
};

export const setProgenitor = async (personId: string): Promise<void> => {
  const { error } = await supabase.rpc('set_progenitor', { person_id: personId });
  if (error) throw new DataError(error);
};

/** Nối một Người đã có (thường là Người chưa nối) làm con của một Người đã có. */
export const linkParent = async (input: { childId: string; parentId: string; kind: ParentLinkKind }): Promise<void> => {
  check(await supabase.rpc('link_parent', { child_id: input.childId, parent_id: input.parentId, link_kind: input.kind }));
};

/** Nối hai Người đã có thành vợ chồng. */
export const linkSpouse = async (input: { personId: string; spouseId: string }): Promise<void> => {
  check(await supabase.rpc('link_spouse', { person_id: input.personId, spouse_id: input.spouseId }));
};
