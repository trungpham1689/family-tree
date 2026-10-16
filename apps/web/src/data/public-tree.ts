import { buildFamilyGraph, type FamilyGraph } from '../family/family-graph';
import { supabase } from '../lib/supabase';
import type { Row } from './database.types';
import type { Person, Tree } from './trees';
import { DataError } from './trees';

/**
 * Bản công khai của một Gia phả (ADR 0002). Database đã lọc sẵn thông tin riêng tư;
 * ở đây chỉ điền giá trị trống cho các trường không được gửi về, để dùng chung giao diện Cây.
 */

const BLANK_PERSON: Person = {
  id: '',
  tree_id: '',
  full_name: '',
  gender: null,
  is_progenitor: false,
  is_deceased: false,
  hidden_from_public: false,
  birth_order: null,
  common_name: null,
  taboo_name: null,
  courtesy_name: null,
  han_name: null,
  birth_calendar: 'duong',
  birth_precision: null,
  birth_year: null,
  birth_month: null,
  birth_day: null,
  birth_leap: false,
  birth_approx: false,
  birth_solar_date: null,
  birth_place: null,
  hometown: null,
  residence: null,
  occupation: null,
  education: null,
  title: null,
  phone: null,
  email: null,
  biography: null,
  role_note: null,
  death_calendar: 'duong',
  death_precision: null,
  death_year: null,
  death_month: null,
  death_day: null,
  death_leap: false,
  death_approx: false,
  death_solar_date: null,
  anniversary_day: null,
  anniversary_month: null,
  anniversary_manual: false,
  burial_place: null,
  burial_map_url: null,
  worship_place: null,
  worship_keeper: null,
  created_at: '',
  updated_at: '',
  version: 0,
};

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
