import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from './use-mutation';
import { inviteToTree, listTreeMembers, removeTreeRole, updateTreeRole, type InvitableRole } from './roles';
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.members(treeId) }),
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
