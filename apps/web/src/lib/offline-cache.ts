import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { isPersistedRoot } from '../data/query-roots';
import { idbStorage } from './idb-storage';

/** Dữ liệu giữ lại để xem khi mất mạng (cây, giỗ, lịch…) tối đa bấy lâu kể từ lần tải cuối. */
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'gia-pha-query-cache';

export const queryPersister = createAsyncStoragePersister({ storage: idbStorage, key: CACHE_KEY, throttleTime: 2000 });

/** Phiên bản định dạng dữ liệu đã lưu; đổi khi cấu trúc dữ liệu đổi để bỏ bộ nhớ đệm cũ. Service worker có VERSION riêng (public/sw.js). */
export const OFFLINE_CACHE_VERSION = 'v1';

/** Chỉ lưu truy vấn đã tải xong mà gốc khoá của nó được đánh dấu `persisted` trong data/query-roots.ts. */
export const shouldPersistQuery = (query: { queryKey: readonly unknown[]; state: { status: string } }): boolean =>
  query.state.status === 'success' && isPersistedRoot(query.queryKey[0]);

/** Xoá bộ nhớ đệm khi đăng xuất, để người dùng sau trên cùng máy không thấy dữ liệu của người trước. */
export const clearOfflineCache = (): Promise<void> => idbStorage.removeItem(CACHE_KEY).catch(() => undefined);
