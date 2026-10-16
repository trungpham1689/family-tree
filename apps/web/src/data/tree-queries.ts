import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import type { PersonFields } from '../people/person-form';
import {
  createPerson,
  createTree,
  deleteTree,
  getTree,
  listMyTrees,
  listPersons,
  renameTree,
  updatePerson,
} from './trees';

export const treeKeys = {
  mine: (accountId: string) => ['trees', 'mine', accountId] as const,
  detail: (treeId: string) => ['trees', treeId] as const,
  persons: (treeId: string) => ['trees', treeId, 'persons'] as const,
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

export const usePersons = (treeId: string) =>
  useQuery({ queryKey: treeKeys.persons(treeId), queryFn: () => listPersons(treeId) });

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.persons(treeId) }),
  });
};
