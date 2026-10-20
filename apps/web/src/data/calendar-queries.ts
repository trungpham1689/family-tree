import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { effects, queryKeys, useMutationWithEffects } from './query-keys';
import { useAuth } from '../auth/auth-context';
import { disableCalendarFeed, getCalendarFeedToken, rotateCalendarFeed } from './calendar-feed';
import { listTreeEvents, loadMyCalendar, removeTreeEvent, saveTreeEvent } from './calendar';
import { fetchAvatarDataUrl, listEventPhotos, removeEventPhoto, uploadEventPhoto, type EventPhoto } from './photos';

/** Hiện ảnh trong trang một lúc rồi bỏ khỏi bộ nhớ sớm, như ảnh đại diện (data URL nặng). */
const IMAGE_GC_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Lịch của tôi và Sự kiện
// ---------------------------------------------------------------------------
export const useMyCalendar = (enabled: boolean) => {
  const { state } = useAuth();
  const accountId = state.status === 'signed-in' ? state.session.user.id : '';
  return useQuery({
    queryKey: queryKeys.calendar(accountId),
    queryFn: () => loadMyCalendar(accountId),
    enabled: enabled && accountId !== '',
  });
};

export const useCalendarFeed = () => {
  const { state } = useAuth();
  const accountId = state.status === 'signed-in' ? state.session.user.id : '';
  return useQuery({ queryKey: [...queryKeys.calendarFeed, accountId], queryFn: getCalendarFeedToken, enabled: accountId !== '' });
};

const useCalendarFeedMutation = <Variables>(mutationFn: (variables: Variables) => Promise<unknown>) => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: [...queryKeys.calendarFeed] }) });
};
export const useRotateCalendarFeed = () => useCalendarFeedMutation(rotateCalendarFeed);
export const useDisableCalendarFeed = () => useCalendarFeedMutation(disableCalendarFeed);

export const useTreeEvents = (treeId: string) =>
  useQuery({ queryKey: queryKeys.events(treeId), queryFn: () => listTreeEvents(treeId) });

const useEventMutation = <Input, Output>(treeId: string, mutationFn: (input: Input) => Promise<Output>) =>
  useMutationWithEffects(mutationFn, () => effects.events(treeId));

export const useSaveTreeEvent = (treeId: string) => useEventMutation(treeId, saveTreeEvent);
export const useRemoveTreeEvent = (treeId: string) => useEventMutation(treeId, removeTreeEvent);

/** Ảnh (dòng dữ liệu, chưa tải file) của mọi sự kiện trong gia phả. */
export const useEventPhotos = (treeId: string) =>
  useQuery({ queryKey: queryKeys.eventPhotos(treeId), queryFn: () => listEventPhotos(treeId) });

export const useUploadEventPhoto = (treeId: string) => useEventMutation(treeId, uploadEventPhoto);
export const useRemoveEventPhoto = (treeId: string) => useEventMutation(treeId, removeEventPhoto);

/** Ảnh đầu tiên của từng sự kiện (ảnh đại diện trong Phả ký, Dòng thời gian), theo `eventId`. */
export const firstPhotoOfEvents = (photos: readonly EventPhoto[]): Map<string, EventPhoto> => {
  const first = new Map<string, EventPhoto>();
  for (const photo of photos) if (!first.has(photo.event_id)) first.set(photo.event_id, photo);
  return first;
};

/** Tải file ảnh của `photos` thành data URL, theo `photo.id`. Chỉ tải khi `enabled`. */
export const useEventPhotoImages = (photos: readonly EventPhoto[], enabled = true) =>
  useQuery({
    queryKey: queryKeys.avatars(photos.map((photo) => `event:${photo.id}:${photo.storage_path}`)),
    queryFn: async () => new Map(await Promise.all(photos.map(async (photo) => [photo.id, await fetchAvatarDataUrl(photo.storage_path)] as const))),
    enabled: enabled && photos.length > 0,
    staleTime: Infinity,
    gcTime: IMAGE_GC_MS,
  });
