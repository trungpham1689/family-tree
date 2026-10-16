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

/** null khi link sai, đã tắt hoặc đã được tạo lại. */
export const fetchPublicTree = async (token: string): Promise<PublicTree | null> => {
  const { data, error } = await supabase.rpc('public_tree', { token });
  if (error) throw new DataError(error);
  if (!data) return null;
  const payload = data as unknown as PublicPayload;
  return {
    tree: payload.tree,
    graph: buildFamilyGraph({
      persons: payload.persons.map((person) => ({ ...BLANK_PERSON, ...person, anonymous: person.anonymous ?? false })),
      parentLinks: payload.parentLinks,
      unions: payload.unions,
      positions: payload.positions,
    }),
  };
};

export const rotatePublicLink = async (treeId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('rotate_public_link', { target_tree: treeId });
  if (error) throw new DataError(error);
  return data;
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
