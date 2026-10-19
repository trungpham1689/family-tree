import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inviteToTree, listTreeMembers, removeTreeRole, updateTreeRole, type InvitableRole } from './roles';
import { treeKeys } from './query-keys';

// ---------------------------------------------------------------------------
// Mời vai trò Biên tập viên / Người xem
// ---------------------------------------------------------------------------
export const useTreeMembers = (treeId: string) =>
  useQuery({ queryKey: treeKeys.members(treeId), queryFn: () => listTreeMembers(treeId) });

export const useInviteToTree = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: InvitableRole }) => inviteToTree({ treeId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.members(treeId) }),
  });
};

export const useUpdateTreeRole = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { accountId: string; role: InvitableRole }) => updateTreeRole({ treeId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.members(treeId) }),
  });
};

export const useRemoveTreeRole = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => removeTreeRole({ treeId, accountId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.members(treeId) }),
  });
};
