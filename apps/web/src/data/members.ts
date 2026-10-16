import { supabase } from '../lib/supabase';
import type { TreeRole } from './trees';
import { DataError } from './trees';

export type Member = {
  accountId: string;
  email: string;
  role: TreeRole;
  personId: string | null;
  isMe: boolean;
};

export type Invitation = { id: string; email: string; role: 'editor' | 'viewer'; createdAt: string };

const fail = (error: { code?: string; message?: string } | null) => {
  if (error) throw new DataError(error);
};

export const listMembers = async (treeId: string): Promise<Member[]> => {
  const { data, error } = await supabase.rpc('tree_members', { target_tree: treeId });
  fail(error);
  return (data ?? []).map((row) => ({
    accountId: row.account_id,
    email: row.email,
    role: row.role === 'owner' || row.role === 'editor' ? row.role : 'viewer',
    personId: row.person_id,
    isMe: row.is_me,
  }));
};

/** Lời mời đang chờ; chỉ Chủ sở hữu và Biên tập viên đọc được (RLS), người khác nhận danh sách rỗng. */
export const listInvitations = async (treeId: string): Promise<Invitation[]> => {
  const { data, error } = await supabase
    .from('tree_invitations')
    .select('id, email, role, created_at')
    .eq('tree_id', treeId)
    .order('created_at');
  fail(error);
  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role === 'editor' ? 'editor' : 'viewer',
    createdAt: row.created_at,
  }));
};

/** 'added' khi email đã có tài khoản; 'invited' khi lời mời chờ người đó đăng ký. */
export const inviteMember = async (input: { treeId: string; email: string; role: 'editor' | 'viewer' }) => {
  const { data, error } = await supabase.rpc('invite_member', {
    target_tree: input.treeId,
    invitee_email: input.email,
    new_role: input.role,
  });
  fail(error);
  return data === 'added' ? ('added' as const) : ('invited' as const);
};

export const setMemberRole = async (input: { treeId: string; accountId: string; role: 'editor' | 'viewer' }) =>
  fail((await supabase.rpc('set_member_role', { target_tree: input.treeId, member: input.accountId, new_role: input.role })).error);

export const removeMember = async (input: { treeId: string; accountId: string }) =>
  fail((await supabase.rpc('remove_member', { target_tree: input.treeId, member: input.accountId })).error);

export const setMemberPerson = async (input: { treeId: string; accountId: string; personId: string | null }) =>
  fail(
    (await supabase.rpc('set_member_person', { target_tree: input.treeId, member: input.accountId, target_person: input.personId }))
      .error,
  );

export const cancelInvitation = async (invitationId: string) =>
  fail((await supabase.from('tree_invitations').delete().eq('id', invitationId)).error);
