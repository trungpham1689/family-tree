import {
  useMutation as useBaseMutation,
  type DefaultError,
  type UseMutateFunction,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Chạy `run` một lần tại một thời điểm theo `slot`: gọi lại khi lần trước chưa xong thì không gọi API nữa, trả về chính lời hứa đang chạy.
 * Khoá đặt ngay lúc gọi — React Query chỉ báo `isPending` sau một nhịp nên bấm đúp thật nhanh vẫn lọt hai lần nếu chỉ dựa vào `disabled={isPending}`.
 */
export const guardOnce =
  <Args extends unknown[], Result>(slot: { current: Promise<Result> | null }, run: (...args: Args) => Promise<Result>) =>
  (...args: Args): Promise<Result> => {
    if (!slot.current) {
      const promise: Promise<Result> = run(...args).finally(() => {
        if (slot.current === promise) slot.current = null;
      });
      slot.current = promise;
    }
    return slot.current;
  };

/**
 * `useMutation` của React Query, nhưng mỗi thao tác chỉ chạy một lần tại một thời điểm: `mutate`/`mutateAsync` gọi khi lần trước chưa xong
 * thì bị bỏ qua. Dùng thay cho `useMutation` gốc ở mọi nơi gọi API từ nút bấm.
 */
export const useMutation = <TData = unknown, TError = DefaultError, TVariables = void, TOnMutateResult = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> => {
  const base = useBaseMutation(options);
  // Hộp đựng lời hứa đang chạy: giữ bằng state (không phải ref) vì được đọc trong lúc vẽ, và không bao giờ thay đối tượng.
  const [slot] = useState<{ current: Promise<TData> | null }>(() => ({ current: null }));
  const mutateAsync = guardOnce(slot, base.mutateAsync);
  // Lỗi đã vào `error` của mutation và `onError`; `mutate` không ném lỗi ra ngoài.
  const mutate = ((...args: Parameters<typeof base.mutateAsync>) => {
    mutateAsync(...args).catch(() => {});
  }) as UseMutateFunction<TData, TError, TVariables, TOnMutateResult>;
  return { ...base, mutate, mutateAsync } as UseMutationResult<TData, TError, TVariables, TOnMutateResult>;
};
