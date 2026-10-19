import { buildFamilyGraph, type FamilyGraph } from '../family/family-graph';
import { supabase } from '../lib/supabase';
import type { Row } from './database.types';
import { BLANK_PERSON } from './blank-person';
import type { Person, Tree } from './trees';
import { DataError } from './trees';

/**
 * Bản công khai của một Gia phả (ADR 0002). Database đã lọc sẵn thông tin riêng tư;
 * ở đây chỉ điền giá trị trống cho các trường không được gửi về, để dùng chung giao diện Cây.
 */


export type PublicPerson = Person & { anonymous: boolean };

export type PublicTree = {
  tree: Pick<Tree, 'name' | 'description' | 'outside_generations'>;
  graph: FamilyGraph<PublicPerson>;
};

type PublicPayload = {
  tree: PublicTree['tree'];
  persons: (Partial<Person> & { id: string; anonymous?: boolean })[];
  parentLinks: Pick<Row<'parent_links'>, 'child_id' | 'parent_id' | 'kind'>[];
  unions: Pick<Row<'unions'>, 'id' | 'partner_a' | 'partner_b' | 'order_for_a' | 'order_for_b' | 'status'>[];
  positions: { person_id: string; generation: number | null; branch_id: string | null; kind: string }[];
};

/** 'missing' khi link sai, đã tắt hoặc đã được tạo lại; 'wrong-password' khi link còn nhưng sai mật khẩu. */
export type PublicTreeResult = { status: 'ok'; data: PublicTree } | { status: 'missing' } | { status: 'wrong-password' };

export const fetchPublicTree = async (token: string, password: string | null): Promise<PublicTreeResult> => {
  const { data, error } = await supabase.rpc('public_tree', { token, password });
  if (error) throw new DataError(error);
  if (!data) return { status: 'missing' };
  if (typeof data === 'object' && 'wrong_password' in data) return { status: 'wrong-password' };
  const payload = data as unknown as PublicPayload;
  return {
    status: 'ok',
    data: {
      tree: payload.tree,
      graph: buildFamilyGraph({
        persons: payload.persons.map((person) => ({ ...BLANK_PERSON, ...person, anonymous: person.anonymous ?? false })),
        parentLinks: payload.parentLinks,
        unions: payload.unions,
        positions: payload.positions,
      }),
    },
  };
};

export type PublicTreeCard = { name: string; description: string | null; persons: number };

/** Thẻ xem trước nhẹ (tên, số người) — không cần mật khẩu, để hiện trên màn hình nhập mật khẩu. */
export const fetchPublicTreeCard = async (token: string): Promise<PublicTreeCard | null> => {
  const { data, error } = await supabase.rpc('public_tree_card', { token });
  if (error) throw new DataError(error);
  return (data as PublicTreeCard | null) ?? null;
};

export const rotatePublicLink = async (treeId: string, password: string): Promise<string> => {
  const { data, error } = await supabase.rpc('rotate_public_link', { target_tree: treeId, password });
  if (error) throw new DataError(error);
  return data;
};

export const setPublicLinkPassword = async (treeId: string, password: string): Promise<void> => {
  const { error } = await supabase.rpc('set_public_link_password', { target_tree: treeId, password });
  if (error) throw new DataError(error);
};

export const disablePublicLink = async (treeId: string): Promise<void> => {
  const { error } = await supabase.rpc('disable_public_link', { target_tree: treeId });
  if (error) throw new DataError(error);
};

export const setHiddenFromPublic = async (input: { personId: string; hidden: boolean }): Promise<void> => {
  const { error } = await supabase.from('persons').update({ hidden_from_public: input.hidden }).eq('id', input.personId);
  if (error) throw new DataError(error);
};

export const publicLinkUrl = (token: string, origin = window.location.origin) => `${origin}/p/${token}`;
