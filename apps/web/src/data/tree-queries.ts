import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from './use-mutation';
import { buildFamilyGraph } from '../family/family-graph';
import type { ImportPayload } from '../excel/import-preview';
import type { PersonFields } from '../people/person-form';
import { importIntoTree, importNewTree } from './excel-import';
import {
  addChild,
  addParent,
  addSpouse,
  linkParent,
  linkCoParent,
  linkSpouse,
  loadFamily,
  type FamilyData,
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
  discardStoredFiles,
  listPersonPhotoPaths,
  deleteTreeWithPhotos,
  removePersonPhoto,
  removeTreePhoto,
  setAvatarPhoto,
  setTreePhoto,
  updatePhotoCaption,
  uploadPersonPhoto,
} from './photos';
import { effects, queryKeys, useAccountId, useFamilyMutation, useMutationWithEffects } from './query-keys';

export const useMyTrees = () => {
  const accountId = useAccountId();
  return useQuery({ queryKey: queryKeys.mine(accountId), queryFn: () => listMyTrees(accountId) });
};

export const useTree = (treeId: string) => {
  const accountId = useAccountId();
  return useQuery({ queryKey: queryKeys.detail(treeId), queryFn: () => getTree(treeId, accountId) });
};

/** Ảnh dạng data URL rất nặng: không giữ lâu như dữ liệu offline (mặc định 7 ngày, xem main.tsx). */
const SHORT_GC_MS = 5 * 60_000;

// Hàm `select` phải có tham chiếu cố định: React Query chỉ nhớ kết quả khi select không đổi, nếu không đồ thị dựng lại mỗi lần render.
const toFamilyGraph = (data: FamilyData) => buildFamilyGraph(data);

/** Cả Gia phả dưới dạng đồ thị: Người, quan hệ, Đời, Chi. */
export const useFamily = (treeId: string) =>
  useQuery({
    queryKey: queryKeys.family(treeId),
    queryFn: () => loadFamily(treeId),
    select: toFamilyGraph,
  });

export const useCreateTree = () => useMutationWithEffects(createTree, effects.treeMeta);

export const useRenameTree = (treeId: string) =>
  useMutationWithEffects((input: { name: string; description: string | null }) => renameTree(treeId, input), effects.treeMeta);

export const useSetOutsideGenerations = (treeId: string) =>
  useMutationWithEffects((outsideGenerations: number) => setTreeOutsideGenerations(treeId, outsideGenerations), effects.treeMeta);

export const useDeleteTree = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    // Server xoá gia phả rồi mới dọn ảnh trên Drive (xem handleDeleteTree).
    mutationFn: () => deleteTreeWithPhotos(treeId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.detail(treeId) });
      return queryClient.invalidateQueries({ queryKey: ['trees'] });
    },
  });
};

export const useCreatePerson = (treeId: string) =>
  useMutationWithEffects((fields: PersonFields) => createPerson(treeId, fields), () => effects.family(treeId));

/** Sửa hồ sơ có kiểm tra xung đột; khi xung đột vẫn tải lại để mọi màn hình thấy bản mới. */
export const useUpdatePerson = (treeId: string) =>
  useMutationWithEffects(
    ({ personId, fields, version }: { personId: string; fields: PersonFields; version: number }) => updatePerson(personId, fields, version),
    () => effects.family(treeId),
  );

/**
 * Xoá Người rồi dọn file ảnh của họ: database quyết định trước (RLS / quyền Chủ sở hữu), file chỉ bị xoá khi việc đó đã thành.
 * Danh sách file phải lấy trước vì xoá Người kéo theo xoá dòng ảnh.
 */
const withPhotoCleanup = (remove: (personId: string) => Promise<void>) => async (personId: string) => {
  const paths = await listPersonPhotoPaths(personId);
  await remove(personId);
  await discardStoredFiles(paths);
};

export const useDeletePerson = (treeId: string) => useMutationWithEffects(withPhotoCleanup(deletePerson), () => effects.deletion(treeId));

/** Biên tập viên gửi yêu cầu xoá một Người, chờ Chủ sở hữu duyệt. */
export const useRequestDeletePerson = (treeId: string) => useMutationWithEffects(requestDeletePerson, () => effects.deletion(treeId));

export const useApproveDeletePerson = (treeId: string) =>
  useMutationWithEffects(withPhotoCleanup(approveDeletePerson), () => effects.deletion(treeId));

export const useRejectDeletePerson = (treeId: string) => useMutationWithEffects(rejectDeletePerson, () => effects.deletion(treeId));

/** Yêu cầu xoá đang chờ của Gia phả; chỉ Chủ sở hữu gọi được. */
export const usePendingDeletions = (treeId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.pendingDeletions(treeId),
    queryFn: () => listPendingDeletions(treeId),
    enabled,
  });

/** Ảnh tư liệu của một Người. */
export const usePersonPhotos = (personId: string) =>
  useQuery({ queryKey: queryKeys.photos(personId), queryFn: () => listPersonPhotos(personId) });

const usePhotoMutation = <Input, Output>(treeId: string, personId: string, mutationFn: (input: Input) => Promise<Output>) =>
  useMutationWithEffects(mutationFn, () => effects.photos(treeId, personId));

export const useUploadPhoto = (treeId: string, personId: string) => usePhotoMutation(treeId, personId, uploadPersonPhoto);
export const useSetAvatarPhoto = (treeId: string, personId: string) => usePhotoMutation(treeId, personId, setAvatarPhoto);
export const useUpdatePhotoCaption = (treeId: string, personId: string) => usePhotoMutation(treeId, personId, updatePhotoCaption);
export const useRemovePhoto = (treeId: string, personId: string) => usePhotoMutation(treeId, personId, removePersonPhoto);

export const useSetTreePhoto = () => useMutationWithEffects(setTreePhoto, effects.treeMeta);
export const useRemoveTreePhoto = () => useMutationWithEffects(removeTreePhoto, effects.treeMeta);

/** Ảnh đại diện của một Người, tải về và chuyển sẵn thành data URL; null khi chưa có ảnh. */
export const useAvatarDataUrl = (avatarPath: string | null) =>
  useQuery({
    queryKey: queryKeys.avatar(avatarPath),
    queryFn: () => fetchAvatarDataUrl(avatarPath!),
    enabled: avatarPath !== null,
    staleTime: Infinity,
    gcTime: SHORT_GC_MS,
  });

/** Ảnh đại diện của nhiều Người cùng lúc (Phả đồ), gom theo personId; chỉ tải khi `enabled`. */
export const usePersonAvatars = (persons: readonly { id: string; avatar_path: string | null }[], enabled: boolean) => {
  const withAvatar = persons.filter((person) => person.avatar_path !== null);
  return useQuery({
    queryKey: queryKeys.avatars(withAvatar.map((person) => `${person.id}:${person.avatar_path}`)),
    queryFn: async () => {
      const entries = await Promise.all(
        withAvatar.map(async (person) => [person.id, await fetchAvatarDataUrl(person.avatar_path!)] as const),
      );
      return new Map(entries);
    },
    enabled: enabled && withAvatar.length > 0,
    staleTime: Infinity,
    gcTime: SHORT_GC_MS,
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
export const useLinkCoParent = (treeId: string) => useFamilyMutation(treeId, linkCoParent);
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

export { queryKeys } from './query-keys';
export * from './public-link-queries';
export * from './members-queries';
export * from './calendar-queries';
export * from './reminder-queries';
export * from './pha-do-queries';
