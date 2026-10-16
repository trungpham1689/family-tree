import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { buildFamilyGraph } from '../family/family-graph';
import type { ImportPayload } from '../excel/import-preview';
import type { PersonFields } from '../people/person-form';
import { listTreeEvents, loadMyCalendar, removeTreeEvent, saveTreeEvent } from './calendar';
import { importIntoTree, importNewTree } from './excel-import';
import { loadPhaDoConfig, savePhaDoConfig } from './pha-do';
import { disablePublicLink, fetchPublicTree, rotatePublicLink, setHiddenFromPublic } from './public-tree';
import {
  addChild,
  addParent,
  addSpouse,
  linkParent,
  linkSpouse,
  loadFamily,
  setProgenitor,
  updateParentLinkKind,
  updateUnion,
} from './family';
import {
  createPerson,
  createTree,
  deletePerson,
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

export const useCreatePerson = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fields: PersonFields) => createPerson(treeId, fields),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.family(treeId) }),
  });
};

/** Sửa hồ sơ có kiểm tra xung đột; khi xung đột vẫn tải lại để mọi màn hình thấy bản mới. */
export const useUpdatePerson = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ personId, fields, version }: { personId: string; fields: PersonFields; version: number }) =>
      updatePerson(personId, fields, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.family(treeId) }),
  });
};

export const useDeletePerson = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePerson,
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
export const useLinkParent = (treeId: string) => useFamilyMutation(treeId, linkParent);
export const useLinkSpouse = (treeId: string) => useFamilyMutation(treeId, linkSpouse);

/** Lưu gia phả từ Excel: vào gia phả trống `treeId`, hoặc tạo gia phả mới tên `name`. Trả về id gia phả. */
export const useImportExcel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { treeId: string | null; name: string; payload: ImportPayload }) => {
      if (input.treeId) {
        await importIntoTree(input.treeId, input.payload);
        return input.treeId;
      }
      return importNewTree(input.name, input.payload);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
};

// ---------------------------------------------------------------------------
// Link chia sẻ công khai
// ---------------------------------------------------------------------------
export const usePublicTree = (token: string) =>
  useQuery({ queryKey: ['public', token], queryFn: () => fetchPublicTree(token), retry: false });

export const useRotatePublicLink = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => rotatePublicLink(treeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.detail(treeId) }),
  });
};

export const useDisablePublicLink = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disablePublicLink(treeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.detail(treeId) }),
  });
};

export const useSetHiddenFromPublic = (treeId: string) => useFamilyMutation(treeId, setHiddenFromPublic);

// ---------------------------------------------------------------------------
// Lịch của tôi và Sự kiện
// ---------------------------------------------------------------------------
export const useMyCalendar = (enabled: boolean) => {
  const { state } = useAuth();
  const accountId = state.status === 'signed-in' ? state.session.user.id : '';
  return useQuery({
    queryKey: ['trees', 'calendar', accountId],
    queryFn: () => loadMyCalendar(accountId),
    enabled: enabled && accountId !== '',
  });
};

export const useTreeEvents = (treeId: string) =>
  useQuery({ queryKey: ['trees', treeId, 'events'], queryFn: () => listTreeEvents(treeId) });

const useEventMutation = <Input,>(treeId: string, mutationFn: (input: Input) => Promise<void>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trees', treeId, 'events'] }),
        queryClient.invalidateQueries({ queryKey: ['trees', 'calendar'] }),
      ]),
  });
};

export const useSaveTreeEvent = (treeId: string) => useEventMutation(treeId, saveTreeEvent);
export const useRemoveTreeEvent = (treeId: string) => useEventMutation(treeId, removeTreeEvent);

// ---------------------------------------------------------------------------
// Phả đồ
// ---------------------------------------------------------------------------
export const usePhaDoConfig = (treeId: string) =>
  useQuery({ queryKey: ['trees', treeId, 'pha-do'], queryFn: () => loadPhaDoConfig(treeId) });

export const useSavePhaDoConfig = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savePhaDoConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trees', treeId, 'pha-do'] }),
  });
};
