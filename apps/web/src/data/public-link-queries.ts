import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  disablePublicLink,
  fetchPublicTree,
  fetchPublicTreeCard,
  rotatePublicLink,
  setHiddenFromPublic,
  setPublicLinkPassword,
} from './public-tree';
import { treeKeys, useFamilyMutation } from './query-keys';

// ---------------------------------------------------------------------------
// Link chia sẻ công khai
// ---------------------------------------------------------------------------
/** Thẻ xem trước nhẹ, không cần mật khẩu — hiện tên gia phả trên màn hình nhập mật khẩu. */
export const usePublicTreeCard = (token: string) =>
  useQuery({ queryKey: ['public-card', token], queryFn: () => fetchPublicTreeCard(token), retry: false });

/** `password` null khi chưa nhập (ví dụ vừa mở trang) — chỉ gọi khi có để tránh dò mật khẩu không cần thiết. */
export const usePublicTree = (token: string, password: string | null) =>
  useQuery({
    queryKey: ['public', token, password],
    queryFn: () => fetchPublicTree(token, password),
    enabled: password !== null,
    retry: false,
  });

export const useRotatePublicLink = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => rotatePublicLink(treeId, password),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.detail(treeId) }),
  });
};

export const useSetPublicLinkPassword = (treeId: string) =>
  useMutation({
    mutationFn: (password: string) => setPublicLinkPassword(treeId, password),
  });

export const useDisablePublicLink = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disablePublicLink(treeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKeys.detail(treeId) }),
  });
};

export const useSetHiddenFromPublic = (treeId: string) => useFamilyMutation(treeId, setHiddenFromPublic);
