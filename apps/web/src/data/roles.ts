import { supabase } from '../lib/supabase';
import { DataError } from './trees';

/** Vai trò mời được; "owner" không mời/đổi/gỡ qua đây (ticket 11). */
export type InvitableRole = 'editor' | 'viewer';

export type TreeMember = {
  account_id: string;
  role: 'owner' | InvitableRole;
  email: string;
  created_at: string;
};

export const listTreeMembers = async (treeId: string): Promise<TreeMember[]> => {
  const { data, error } = await supabase.rpc('list_tree_members', { target_tree: treeId });
  if (error) throw new DataError(error);
  return (data ?? []) as TreeMember[];
};

export const inviteToTree = async (input: { treeId: string; email: string; role: InvitableRole }): Promise<void> => {
  const { error } = await supabase.rpc('invite_to_tree', {
    target_tree: input.treeId,
    invite_email: input.email,
    new_role: input.role,
  });
  if (error) throw new DataError(error);
};

export const updateTreeRole = async (input: { treeId: string; accountId: string; role: InvitableRole }): Promise<void> => {
  const { error } = await supabase.rpc('update_tree_role', {
    target_tree: input.treeId,
    target_account: input.accountId,
    new_role: input.role,
  });
  if (error) throw new DataError(error);
};

export const removeTreeRole = async (input: { treeId: string; accountId: string }): Promise<void> => {
  const { error } = await supabase.rpc('remove_tree_role', { target_tree: input.treeId, target_account: input.accountId });
  if (error) throw new DataError(error);
};
