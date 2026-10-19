import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { isPersistedRoot } from '../data/query-roots';
import { idbStorage } from './idb-storage';

/** Dữ liệu giữ lại để xem khi mất mạng (cây, giỗ, lịch…) tối đa bấy lâu kể từ lần tải cuối. */
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_KEY = 'gia-pha-query-cache';

export const queryPersister = createAsyncStoragePersister({ storage: idbStorage, key: CACHE_KEY, throttleTime: 2000 });

/** Phiên bản định dạng dữ liệu đã lưu; đổi khi cấu trúc dữ liệu đổi để bỏ bộ nhớ đệm cũ. Service worker có VERSION riêng (public/sw.js). */
export const OFFLINE_CACHE_VERSION = 'v1';

/**
 * Dữ liệu có đi qua JSON mà không đổi nghĩa không? Map, Set, Date, hàm… khi lưu rồi đọc lại sẽ thành `{}` hoặc chuỗi và làm
 * hỏng trang (đã từng: Map nhắc nhở thành `{}` → "get is not a function"). Truy vấn nào trả những kiểu đó thì không được giữ offline;
 * đổi queryFn trả mảng/đối tượng thường rồi dùng `select` để dựng Map/Set.
 */
export const isJsonSafe = (value: unknown): boolean => {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonSafe);
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    return (proto === Object.prototype || proto === null) && Object.values(value as Record<string, unknown>).every(isJsonSafe);
  }
  return false;
};

/** Chỉ lưu truy vấn đã tải xong, gốc khoá được đánh dấu `persisted` trong data/query-roots.ts, và dữ liệu đi qua JSON an toàn. */
export const shouldPersistQuery = (query: { queryKey: readonly unknown[]; state: { status: string; data?: unknown } }): boolean =>
  query.state.status === 'success' && isPersistedRoot(query.queryKey[0]) && isJsonSafe(query.state.data);

/** Xoá bộ nhớ đệm khi đăng xuất, để người dùng sau trên cùng máy không thấy dữ liệu của người trước. */
export const clearOfflineCache = (): Promise<void> => idbStorage.removeItem(CACHE_KEY).catch(() => undefined);
