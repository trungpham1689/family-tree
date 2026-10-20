import { fetchAll } from '../lib/fetch-all';
import { supabase } from '../lib/supabase';
import { compareSiblings, orderWithNewChild, type ParentLinkKind, type UnionStatus } from '../family/family-graph';
import type { PersonFields } from '../people/person-form';
import type { Row } from './database.types';
import { failOn } from './trees';

export type FamilyData = {
  persons: Row<'persons'>[];
  parentLinks: Row<'parent_links'>[];
  unions: Row<'unions'>[];
  positions: { person_id: string; generation: number | null; branch_id: string | null; kind: string }[];
};

const check = <T>({ data, error }: { data: T | null; error: { code?: string; message?: string } | null }): T => {
  failOn(error);
  return data as T;
};

/** Tải cả Gia phả (đọc từng trang 1000 dòng), rồi dựng đồ thị trong bộ nhớ. */
export const loadFamily = async (treeId: string): Promise<FamilyData> => {
  const [persons, parentLinks, unions, positions] = await Promise.all([
    fetchAll((from, to) => supabase.from('persons').select('*').eq('tree_id', treeId).order('id').range(from, to)),
    fetchAll((from, to) =>
      supabase.from('parent_links').select('*').eq('tree_id', treeId).order('child_id').order('parent_id').range(from, to),
    ),
    fetchAll((from, to) => supabase.from('unions').select('*').eq('tree_id', treeId).order('id').range(from, to)),
    fetchAll((from, to) => supabase.rpc('tree_positions', { target_tree: treeId }).order('person_id').range(from, to)),
  ]);
  return {
    persons: check(persons) ?? [],
    parentLinks: check(parentLinks) ?? [],
    unions: check(unions) ?? [],
    positions: check(positions) ?? [],
  };
};

/** Thêm con. Không ghi Thứ tự con thì con mới tự vào đúng chỗ theo ngày sinh giữa các anh chị em (database chỉ xếp cuối). */
export const addChild = async (input: {
  parentId: string;
  otherParentId: string | null;
  kind: ParentLinkKind;
  fields: PersonFields;
}): Promise<string> => {
  const id = check(
    await supabase.rpc('add_child', {
      parent_id: input.parentId,
      other_parent_id: input.otherParentId,
      link_kind: input.kind,
      person: input.fields,
    }),
  );
  if (input.fields.birth_order === null) await placeByBirthDate(input.parentId, id);
  return id;
};

/** Đã thêm xong thì việc xếp chỗ chỉ là tiện ích: lỗi ở đây không được làm hỏng lần thêm (vẫn xếp tay hoặc bấm "Tự xếp" được). */
const placeByBirthDate = async (parentId: string, childId: string): Promise<void> => {
  try {
    const links = check(await supabase.from('parent_links').select('child_id').eq('parent_id', parentId));
    const children = check(await supabase.from('persons').select('*').in('id', links.map((link) => link.child_id)));
    const added = children.find((child) => child.id === childId);
    if (!added) return;
    const siblings = children.filter((child) => child.id !== childId).sort(compareSiblings);
    const ordered = orderWithNewChild(siblings, added);
    // Chỗ cuối là chỗ database đã xếp sẵn.
    if (ordered[ordered.length - 1] !== childId) await reorderChildren(ordered);
  } catch {
    // xem chú thích trên
  }
};

export const addParent = async (input: { childId: string; kind: ParentLinkKind; fields: PersonFields }): Promise<string> =>
  check(await supabase.rpc('add_parent', { child_id: input.childId, link_kind: input.kind, person: input.fields }));

export const addSpouse = async (input: { personId: string; order: number | null; fields: PersonFields }): Promise<string> =>
  check(await supabase.rpc('add_spouse', { person_id: input.personId, union_order: input.order, person: input.fields }));

/** Đổi thứ tự hôn phối (nhìn từ phía `viewerId`), trạng thái và/hoặc ngày cưới của một cuộc hôn phối, một lần gọi. */
export const updateUnion = async (input: {
  unionId: string;
  viewerId: string;
  order?: number;
  status?: UnionStatus;
  /** Ngày cưới (dương); `null` ở từng phần = chưa biết. Truyền cả ba cùng lúc. */
  marriage?: { year: number | null; month: number | null; day: number | null };
}): Promise<void> => {
  const { error } = await supabase.rpc('update_union', {
    target_union: input.unionId,
    viewer: input.viewerId,
    ...(input.order !== undefined ? { new_order: input.order } : {}),
    ...(input.status !== undefined ? { new_status: input.status } : {}),
    ...(input.marriage
      ? { set_marriage: true, new_marriage_year: input.marriage.year, new_marriage_month: input.marriage.month, new_marriage_day: input.marriage.day }
      : {}),
  });
  failOn(error);
};

/** Đổi Thứ tự hôn phối (nhìn từ phía viewerId) theo danh sách đã kéo thả, một lần gọi. */
export const reorderUnions = async (input: { viewerId: string; orderedUnionIds: string[] }): Promise<void> => {
  const { error } = await supabase.rpc('reorder_unions', { viewer_id: input.viewerId, ordered_union_ids: input.orderedUnionIds });
  failOn(error);
};

export const updateParentLinkKind = async (input: { childId: string; parentId: string; kind: ParentLinkKind }) => {
  const { error } = await supabase
    .from('parent_links')
    .update({ kind: input.kind })
    .eq('child_id', input.childId)
    .eq('parent_id', input.parentId);
  failOn(error);
};

/** Đổi Thứ tự con: ghi lại liên tục 1..N theo danh sách đã kéo thả (gồm con của mọi vợ/chồng), một lần, qua hàm của database. */
export const reorderChildren = async (orderedChildIds: string[]): Promise<void> => {
  const { error } = await supabase.rpc('reorder_children', { ordered_ids: orderedChildIds });
  failOn(error);
};

export const setProgenitor = async (personId: string): Promise<void> => {
  const { error } = await supabase.rpc('set_progenitor', { person_id: personId });
  failOn(error);
};

/** Đánh dấu/bỏ đánh dấu một Người làm tổ của một chi mới (Đời, Chi của mọi người được tính lại). */
export const setFoundsBranch = async (input: { personId: string; foundsBranch: boolean }): Promise<void> => {
  const { error } = await supabase.from('persons').update({ founds_branch: input.foundsBranch }).eq('id', input.personId);
  failOn(error);
};

/** Nối một Người đã có (thường là Người chưa nối) làm con của một Người đã có. */
export const linkParent = async (input: { childId: string; parentId: string; kind: ParentLinkKind }): Promise<void> => {
  check(await supabase.rpc('link_parent', { child_id: input.childId, parent_id: input.parentId, link_kind: input.kind }));
};

/** Nối hai Người đã có thành vợ chồng. */
export const linkSpouse = async (input: { personId: string; spouseId: string }): Promise<void> => {
  check(await supabase.rpc('link_spouse', { person_id: input.personId, spouse_id: input.spouseId }));
};

/** Gộp các người trùng `dropIds` vào `keepId` (chỉ Chủ sở hữu); một transaction nên lỗi thì không gộp gì. Không hoàn tác được. */
export const mergePersons = async (input: { keepId: string; dropIds: string[] }): Promise<void> => {
  const { error } = await supabase.rpc('merge_persons_group', { keep_person: input.keepId, drop_persons: input.dropIds });
  failOn(error);
};
