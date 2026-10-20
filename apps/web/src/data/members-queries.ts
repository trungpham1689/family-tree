import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from './use-mutation';
import { cancelTreeInvitation, inviteToTree, listTreeInvitations, sendInviteEmail, listTreeMembers, removeTreeRole, updateTreeRole, type InvitableRole } from './roles';
import { queryKeys } from './query-keys';

// ---------------------------------------------------------------------------
// Mời vai trò Biên tập viên / Người xem
// ---------------------------------------------------------------------------
export const useTreeMembers = (treeId: string) =>
  useQuery({ queryKey: queryKeys.members(treeId), queryFn: () => listTreeMembers(treeId) });

export const useInviteToTree = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: InvitableRole }) => inviteToTree({ treeId, ...input }),
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.members(treeId) }), queryClient.invalidateQueries({ queryKey: queryKeys.invitations(treeId) })]),
  });
};

/** Lời mời đang chờ người chưa có tài khoản đăng ký (chỉ Chủ sở hữu xem được). */
export const useTreeInvitations = (treeId: string, enabled: boolean) =>
  useQuery({ queryKey: queryKeys.invitations(treeId), queryFn: () => listTreeInvitations(treeId), enabled });

/** Gửi/gửi lại email mời; xong thì tải lại danh sách để thấy "đã gửi lúc …". */
export const useSendInviteEmail = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => sendInviteEmail({ treeId, email }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.invitations(treeId) }),
  });
};

export const useCancelTreeInvitation = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => cancelTreeInvitation({ treeId, email }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invitations(treeId) }),
  });
};

export const useUpdateTreeRole = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; role: InvitableRole }) => updateTreeRole({ treeId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(treeId) }),
  });
};

export const useRemoveTreeRole = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => removeTreeRole({ treeId, accountId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(treeId) }),
  });
};
