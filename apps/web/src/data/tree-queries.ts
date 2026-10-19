import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildFamilyGraph } from '../family/family-graph';
import type { ImportPayload } from '../excel/import-preview';
import type { PersonFields } from '../people/person-form';
import { importIntoTree, importNewTree } from './excel-import';
import {
  addChild,
  addParent,
  addSpouse,
  linkParent,
  linkSpouse,
  loadFamily,
  mergePersons,
  reorderChildren,
  reorderUnions,
  setFoundsBranch,
  setProgenitor,
  updateParentLinkKind,
  updateUnion,
} from './family';
import {
  approveDeletePerson,
  createPerson,
  createTree,
  deletePerson,
  deleteTree,
  getTree,
  listMyTrees,
  listPendingDeletions,
  rejectDeletePerson,
  renameTree,
  requestDeletePerson,
  setTreeOutsideGenerations,
  updatePerson,
} from './trees';
import {
  fetchAvatarDataUrl,
  listPersonPhotos,
  purgePersonPhotos,
  purgeTreePhotos,
  removePersonPhoto,
  removeTreePhoto,
  setAvatarPhoto,
  setTreePhoto,
  updatePhotoCaption,
  uploadPersonPhoto,
} from './photos';
import { treeKeys, useAccountId, useFamilyMutation } from './query-keys';

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
    mutationFn: (input: { name: string; description: string | null }) => renameTree(treeId, input),
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
    mutationFn: async () => {
      await purgeTreePhotos(treeId);
      return deleteTree(treeId);
    },
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
    // Ảnh trên Drive không tự mất khi xoá Người (dòng ảnh trong database mới tự xoá theo), nên xoá file trước.
    mutationFn: async (personId: string) => {
      await purgePersonPhotos(personId);
      return deletePerson(personId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.family(treeId) }),
  });
};

/** Biên tập viên gửi yêu cầu xoá (Người mình tạo), chờ Chủ sở hữu duyệt. */
export const useRequestDeletePerson = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestDeletePerson,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.family(treeId) }),
  });
};

export const useApproveDeletePerson = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (personId: string) => {
      await purgePersonPhotos(personId);
      return approveDeletePerson(personId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeKeys.family(treeId) });
      queryClient.invalidateQueries({ queryKey: treeKeys.pendingDeletions(treeId) });
    },
  });
};

export const useRejectDeletePerson = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: rejectDeletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treeKeys.family(treeId) });
      queryClient.invalidateQueries({ queryKey: treeKeys.pendingDeletions(treeId) });
    },
  });
};

/** Yêu cầu xoá đang chờ của Gia phả; chỉ Chủ sở hữu gọi được. */
export const usePendingDeletions = (treeId: string, enabled: boolean) =>
  useQuery({
    queryKey: treeKeys.pendingDeletions(treeId),
    queryFn: () => listPendingDeletions(treeId),
    enabled,
  });

const photosKey = (personId: string) => ['photos', personId] as const;

/** Ảnh tư liệu của một Người. */
export const usePersonPhotos = (personId: string) =>
  useQuery({ queryKey: photosKey(personId), queryFn: () => listPersonPhotos(personId) });

/** Mọi thao tác đổi ảnh tư liệu đều có thể đổi avatar_path (trigger), nên tải lại cả hai. */
const usePhotoMutation = <Input, Output>(treeId: string, personId: string, mutationFn: (input: Input) => Promise<Output>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: photosKey(personId) }),
        queryClient.invalidateQueries({ queryKey: treeKeys.family(treeId) }),
      ]),
  });
};

export const useUploadPhoto = (treeId: string, personId: string) => usePhotoMutation(treeId, personId, uploadPersonPhoto);
export const useSetAvatarPhoto = (treeId: string, personId: string) => usePhotoMutation(treeId, personId, setAvatarPhoto);
export const useUpdatePhotoCaption = (treeId: string, personId: string) => usePhotoMutation(treeId, personId, updatePhotoCaption);
export const useRemovePhoto = (treeId: string, personId: string) => usePhotoMutation(treeId, personId, removePersonPhoto);

const useTreePhotoMutation = <Input, Output>(mutationFn: (input: Input) => Promise<Output>) => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trees'] }) });
};

export const useSetTreePhoto = () => useTreePhotoMutation(setTreePhoto);
export const useRemoveTreePhoto = () => useTreePhotoMutation(removeTreePhoto);

/** Ảnh đại diện của một Người, tải về và chuyển sẵn thành data URL; null khi chưa có ảnh. */
export const useAvatarDataUrl = (avatarPath: string | null) =>
  useQuery({
    queryKey: ['avatar', avatarPath],
    queryFn: () => fetchAvatarDataUrl(avatarPath!),
    enabled: avatarPath !== null,
    staleTime: Infinity,
  });

/** Ảnh đại diện của nhiều Người cùng lúc (Phả đồ), gom theo personId; chỉ tải khi `enabled`. */
export const usePersonAvatars = (persons: readonly { id: string; avatar_path: string | null }[], enabled: boolean) => {
  const withAvatar = persons.filter((person) => person.avatar_path !== null);
  return useQuery({
    queryKey: ['avatars', withAvatar.map((person) => `${person.id}:${person.avatar_path}`)],
    queryFn: async () => {
      const entries = await Promise.all(
        withAvatar.map(async (person) => [person.id, await fetchAvatarDataUrl(person.avatar_path!)] as const),
      );
      return new Map(entries);
    },
    enabled: enabled && withAvatar.length > 0,
    staleTime: Infinity,
  });
};



export const useAddChild = (treeId: string) => useFamilyMutation(treeId, addChild);
export const useAddParent = (treeId: string) => useFamilyMutation(treeId, addParent);
export const useAddSpouse = (treeId: string) => useFamilyMutation(treeId, addSpouse);
export const useUpdateUnion = (treeId: string) => useFamilyMutation(treeId, updateUnion);
export const useReorderChildren = (treeId: string) => useFamilyMutation(treeId, reorderChildren);
export const useReorderUnions = (treeId: string) => useFamilyMutation(treeId, reorderUnions);
export const useUpdateParentLinkKind = (treeId: string) => useFamilyMutation(treeId, updateParentLinkKind);
export const useSetProgenitor = (treeId: string) => useFamilyMutation(treeId, setProgenitor);
export const useSetFoundsBranch = (treeId: string) => useFamilyMutation(treeId, setFoundsBranch);
export const useLinkParent = (treeId: string) => useFamilyMutation(treeId, linkParent);
export const useLinkSpouse = (treeId: string) => useFamilyMutation(treeId, linkSpouse);
export const useMergePersons = (treeId: string) => useFamilyMutation(treeId, mergePersons);

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

export { treeKeys } from './query-keys';
export * from './public-link-queries';
export * from './members-queries';
export * from './calendar-queries';
export * from './reminder-queries';
export * from './pha-do-queries';
