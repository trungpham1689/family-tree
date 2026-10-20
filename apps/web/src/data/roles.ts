import { supabase } from '../lib/supabase';
import { failOn } from './trees';

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
  failOn(error);
  return (data ?? []) as TreeMember[];
};

/** `added`: email đã có tài khoản, vai trò cấp ngay. `pending`: chưa có tài khoản, lời mời lưu chờ đến khi người đó đăng ký bằng email này. */
export type InviteOutcome = 'added' | 'pending';

export const inviteToTree = async (input: { treeId: string; email: string; role: InvitableRole }): Promise<InviteOutcome> => {
  const { data, error } = await supabase.rpc('invite_to_tree', {
    target_tree: input.treeId,
    invite_email: input.email,
    new_role: input.role,
  });
  failOn(error);
  return data === 'pending' ? 'pending' : 'added';
};

export type TreeInvitation = { email: string; role: InvitableRole; created_at: string; emailed_at: string | null };

export const listTreeInvitations = async (treeId: string): Promise<TreeInvitation[]> => {
  const { data, error } = await supabase.rpc('list_tree_invitations', { target_tree: treeId });
  failOn(error);
  return (data ?? []) as TreeInvitation[];
};

export const cancelTreeInvitation = async (input: { treeId: string; email: string }): Promise<void> => {
  const { error } = await supabase.rpc('cancel_tree_invitation', { target_tree: input.treeId, invite_email: input.email });
  failOn(error);
};

export const updateTreeRole = async (input: { treeId: string; accountId: string; role: InvitableRole }): Promise<void> => {
  const { error } = await supabase.rpc('update_tree_role', {
    target_tree: input.treeId,
    target_account: input.accountId,
    new_role: input.role,
  });
  failOn(error);
};

export const removeTreeRole = async (input: { treeId: string; accountId: string }): Promise<void> => {
  const { error } = await supabase.rpc('remove_tree_role', { target_tree: input.treeId, target_account: input.accountId });
  failOn(error);
};

/** Gửi (hoặc gửi lại) email mời cho lời mời chờ đăng ký, qua Pages Function /api/invite-email. Lời mời vẫn được lưu dù gửi thất bại. */
export const sendInviteEmail = async (input: { treeId: string; email: string }): Promise<void> => {
  const { data } = await supabase.auth.getSession();
  const response = await fetch('/api/invite-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(input),
  }).catch(() => null);
  const body = (await response?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (response?.ok && body?.ok === true) return;
  throw new Error(body?.error ?? 'Không kết nối được máy chủ gửi email. Hãy thử lại.');
};
