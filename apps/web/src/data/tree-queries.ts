import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { buildFamilyGraph } from '../family/family-graph';
import type { PersonFields } from '../people/person-form';
import { addChild, addParent, addSpouse, loadFamily, setProgenitor, updateParentLinkKind, updateUnion } from './family';
import {
  createPerson,
  createTree,
  deleteTree,
  getTree,
  listMyTrees,
  renameTree,
  setTreeOutsideGenerations,
  updatePerson,
} from './trees';

export const treeKeys = {
  mine: (accountId: string) => ['trees', 'mine', accountId] as const,
  detail: (treeId: string) => ['trees', treeId] as const,
  family: (treeId: string) => ['trees', treeId, 'family'] as const,
};

const useAccountId = (): string => {
  const { state } = useAuth();
  if (state.status !== 'signed-in') throw new Error('Cần đăng nhập để tải dữ liệu gia phả.');
  return state.session.user.id;
};

export const useMyTrees = () => {
  const accountId = useAccountId();
  return useQuery({ queryKey: treeKeys.mine(accountId), queryFn: () => listMyTrees(accountId) });
};

export const useTree = (treeId: string) => {
  const accountId = useAccountId();
  return useQuery({ queryKey: treeKeys.detail(treeId), queryFn: () => getTree(treeId, accountId) });
};

/** Cả Gia phả dưới dạng đồ thị: Người, quan hệ, Đời, Chi. */
export const useFamily = (treeId: string) =>
  useQuery({
    queryKey: treeKeys.family(treeId),
    queryFn: () => loadFamily(treeId),
    select: (data) => buildFamilyGraph(data),
  });

export const useCreateTree = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTree,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trees', 'mine'] }),
  });
};

export const useRenameTree = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => renameTree(treeId, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trees'] }),
  });
};

export const useSetOutsideGenerations = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (outsideGenerations: number) => setTreeOutsideGenerations(treeId, outsideGenerations),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trees'] }),
  });
};

export const useDeleteTree = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteTree(treeId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: treeKeys.detail(treeId) });
      return queryClient.invalidateQueries({ queryKey: ['trees', 'mine'] });
    },
  });
};

export const useSavePerson = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, fields }: { personId: string | null; fields: PersonFields }) =>
      personId ? updatePerson(personId, fields) : createPerson(treeId, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.family(treeId) }),
  });
};

/** Mọi thao tác thay đổi quan hệ đều tải lại cả Gia phả, vì Đời và Chi có thể đổi theo. */
const useFamilyMutation = <Input, Output>(treeId: string, mutationFn: (input: Input) => Promise<Output>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.family(treeId) }),
  });
};

export const useAddChild = (treeId: string) => useFamilyMutation(treeId, addChild);
export const useAddParent = (treeId: string) => useFamilyMutation(treeId, addParent);
export const useAddSpouse = (treeId: string) => useFamilyMutation(treeId, addSpouse);
export const useUpdateUnion = (treeId: string) => useFamilyMutation(treeId, updateUnion);
export const useUpdateParentLinkKind = (treeId: string) => useFamilyMutation(treeId, updateParentLinkKind);
export const useSetProgenitor = (treeId: string) => useFamilyMutation(treeId, setProgenitor);
