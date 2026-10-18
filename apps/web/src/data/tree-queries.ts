import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { buildFamilyGraph } from '../family/family-graph';
import type { ImportPayload } from '../excel/import-preview';
import type { PersonFields } from '../people/person-form';
import { listTreeEvents, loadMyCalendar, removeTreeEvent, saveTreeEvent } from './calendar';
import { importIntoTree, importNewTree } from './excel-import';
import { loadPhaDoConfig, savePhaDoConfig } from './pha-do';
import { disablePublicLink, fetchPublicTree, rotatePublicLink, setHiddenFromPublic } from './public-tree';
import { inviteToTree, listTreeMembers, removeTreeRole, updateTreeRole, type InvitableRole } from './roles';
import {
  addChild,
  addParent,
  addSpouse,
  linkParent,
  linkSpouse,
  loadFamily,
  reorderChildren,
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
import {
  fetchAvatarDataUrl,
  listPersonPhotos,
  removePersonPhoto,
  setAvatarPhoto,
  updatePhotoCaption,
  uploadPersonPhoto,
} from './photos';

export const treeKeys = {
  mine: (accountId: string) => ['trees', 'mine', accountId] as const,
  detail: (treeId: string) => ['trees', treeId] as const,
  family: (treeId: string) => ['trees', treeId, 'family'] as const,
  members: (treeId: string) => ['trees', treeId, 'members'] as const,
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
export const useReorderChildren = (treeId: string) => useFamilyMutation(treeId, reorderChildren);
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
