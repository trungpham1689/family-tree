import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { idbStorage } from './idb-storage';

/** Dữ liệu giữ lại để xem khi mất mạng (cây, giỗ, lịch…) tối đa bấy lâu kể từ lần tải cuối. */
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'gia-pha-query-cache';

export const queryPersister = createAsyncStoragePersister({ storage: idbStorage, key: CACHE_KEY, throttleTime: 2000 });

/**
 * Chỉ lưu dữ liệu gia phả/nhắc nhở đã tải xong, cùng trạng thái duyệt (để mở app khi mất mạng không kẹt ở "Đang tải";
 * quyền thật vẫn do database kiểm mỗi lần có mạng). Không lưu link lịch, ảnh (data URL nặng), trang công khai.
 */
const PERSISTED_ROOTS = new Set(['trees', 'approval', 'reminder-watch', 'reminder-prefs', 'notification-reads']);
export const shouldPersistQuery = (query: { queryKey: readonly unknown[]; state: { status: string } }): boolean =>
  query.state.status === 'success' && PERSISTED_ROOTS.has(String(query.queryKey[0]));

/** Xoá bộ nhớ đệm khi đăng xuất, để người dùng sau trên cùng máy không thấy dữ liệu của người trước. */
export const clearOfflineCache = (): Promise<void> => idbStorage.removeItem(CACHE_KEY).catch(() => undefined);
