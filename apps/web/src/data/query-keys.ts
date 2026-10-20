import { useMutation, useQueryClient, type MutationFunction } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import type { QueryRoot } from './query-roots';

/**
 * Sổ đăng ký truy vấn: khoá của mọi truy vấn dữ liệu, và "thao tác nào làm đổi truy vấn nào" (`effects`).
 * Hook chỉ khai báo hiệu ứng của thao tác (`useMutationWithEffects`), không tự viết khoá chuỗi rải rác,
 * nên thêm một truy vấn mới chỉ phải nghĩ tới một nơi.
 */
export const queryKeys = {
  mine: (accountId: string) => ['trees', 'mine', accountId] as const,
  detail: (treeId: string) => ['trees', treeId] as const,
  family: (treeId: string) => ['trees', treeId, 'family'] as const,
  members: (treeId: string) => ['trees', treeId, 'members'] as const,
  pendingDeletions: (treeId: string) => ['trees', treeId, 'pending-deletions'] as const,
  events: (treeId: string) => ['trees', treeId, 'events'] as const,
  eventPhotos: (treeId: string) => ['trees', treeId, 'event-photos'] as const,
  phaDo: (treeId: string) => ['trees', treeId, 'pha-do'] as const,
  /** Không truyền tài khoản thì là tiền tố của mọi bản lịch đã tải. */
  calendar: (accountId?: string) => (accountId === undefined ? (['trees', 'calendar'] as const) : (['trees', 'calendar', accountId] as const)),
  /** Không truyền Người thì là tiền tố của mọi danh sách ảnh. */
  photos: (personId?: string) => (personId === undefined ? (['photos'] as const) : (['photos', personId] as const)),
  reminderWatch: ['reminder-watch'] as const,
  reminderPrefs: ['reminder-prefs'] as const,
  notificationReads: ['notification-reads'] as const,
  calendarFeed: ['calendar-feed'] as const,
  approval: (accountId: string) => ['approval', accountId] as const,
  superadmin: (accountId: string) => ['superadmin', accountId] as const,
  adminAccounts: ['admin', 'accounts'] as const,
  avatar: (path: string | null) => ['avatar', path] as const,
  avatars: (entries: readonly string[]) => ['avatars', entries] as const,
  publicCard: (token: string) => ['public-card', token] as const,
  publicTree: (token: string, password: string | null) => ['public', token, password] as const,
} satisfies Record<string, readonly unknown[] | ((...args: never[]) => readonly [QueryRoot, ...unknown[]])>;

export type QueryEffect = readonly (readonly unknown[])[];

/** Thao tác → các truy vấn cần tải lại. Mỗi dòng nói vì sao. */
export const effects = {
  /** Đổi hồ sơ hoặc quan hệ: Cây, Đời, Chi đổi, và lịch/nhắc nhở suy từ ngày sinh, ngày mất, giỗ, ngày cưới. */
  family: (treeId: string): QueryEffect => [queryKeys.family(treeId), queryKeys.calendar()],
  /** Xoá Người (hoặc duyệt/từ chối xoá): thêm hàng chờ duyệt và danh sách đã tắt nhắc giỗ. */
  deletion: (treeId: string): QueryEffect => [...effects.family(treeId), queryKeys.pendingDeletions(treeId), queryKeys.reminderWatch],
  /** Đổi ảnh tư liệu: trigger có thể đổi avatar_path của Người, nên tải lại cả gia phả. */
  photos: (treeId: string, personId: string): QueryEffect => [queryKeys.photos(personId), queryKeys.family(treeId)],
  /** Gộp người trùng: ảnh, danh sách tắt nhắc giỗ của người bị gộp cũng đổi. */
  merge: (treeId: string): QueryEffect => [...effects.family(treeId), queryKeys.photos(), queryKeys.reminderWatch],
  /** Sự kiện của gia phả cũng nằm trong lịch của mọi tài khoản. */
  events: (treeId: string): QueryEffect => [queryKeys.events(treeId), queryKeys.eventPhotos(treeId), queryKeys.calendar()],
  /** Duyệt/thu hồi/cấp quyền: danh sách tài khoản trên trang quản trị đổi theo. */
  admin: (): QueryEffect => [queryKeys.adminAccounts],
  /** Đổi tên, ảnh bìa, số đời cháu ngoại, danh sách gia phả: mọi thứ dưới `trees`. */
  treeMeta: (): QueryEffect => [['trees']],
};

export const useAccountId = (): string => {
  const { state } = useAuth();
  if (state.status !== 'signed-in') throw new Error('Cần đăng nhập để tải dữ liệu gia phả.');
  return state.session.user.id;
};

/** Mutation tự tải lại đúng những truy vấn mà `effectsOf` nêu sau khi thành công. */
export const useMutationWithEffects = <Input, Output>(mutationFn: MutationFunction<Output, Input>, effectsOf: () => QueryEffect) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all(effectsOf().map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] }))),
  });
};

/** Mọi thao tác thay đổi quan hệ đều tải lại cả Gia phả, vì Đời và Chi có thể đổi theo. */
export const useFamilyMutation = <Input, Output>(treeId: string, mutationFn: (input: Input) => Promise<Output>) =>
  useMutationWithEffects(mutationFn, () => effects.family(treeId));
