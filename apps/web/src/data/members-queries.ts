import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from './use-mutation';
import { cancelTreeInvitation, inviteToTree, listTreeInvitations, sendInviteEmail, listTreeMembers, removeTreeRole, transferTreeOwnership, updateTreeRole, type InvitableRole } from './roles';
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

/**
 * Chuyển quyền đổi vai trò của chính mình: tải lại mọi thứ dưới `trees` (quyền, danh sách gia phả, thành viên),
 * trừ lời mời chờ và yêu cầu xoá — chỉ Chủ sở hữu xem được, nên bỏ khỏi bộ nhớ thay vì tải lại (sẽ bị từ chối).
 */
export const useTransferTreeOwnership = (treeId: string) => {
  const queryClient = useQueryClient();
  const ownerOnly = [queryKeys.invitations(treeId), queryKeys.pendingDeletions(treeId)];
  const isOwnerOnly = (key: readonly unknown[]) => ownerOnly.some((owned) => owned.every((part, index) => key[index] === part));
  return useMutation({
    mutationFn: (accountId: string) => transferTreeOwnership({ treeId, accountId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['trees'], predicate: (query) => !isOwnerOnly(query.queryKey) });
      for (const queryKey of ownerOnly) queryClient.removeQueries({ queryKey });
    },
  });
};

export const useRemoveTreeRole =(treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => removeTreeRole({ treeId, accountId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(treeId) }),
  });
};
