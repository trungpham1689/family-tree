/** Kho khoá–giá trị nhỏ trên IndexedDB (không bị giới hạn ~5MB như localStorage), đủ cho bộ nhớ đệm xem offline. */
const DB_NAME = 'gia-pha';
const STORE = 'kv';

let connection: Promise<IDBDatabase> | null = null;

/** Một kết nối dùng lại cho mọi thao tác (mở/đóng mỗi lần rất tốn); mở lỗi thì lần sau thử lại. */
const open = (): Promise<IDBDatabase> => {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      // Trình duyệt đóng kết nối (nâng cấp phiên bản, xoá dữ liệu): mở lại ở lần dùng sau.
      request.result.onclose = request.result.onversionchange = () => {
        connection = null;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    connection = null;
    throw error;
  });
  return connection;
};

const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = work(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};
export const idbStorage = {
  getItem: async (key: string): Promise<string | null> => ((await run('readonly', (store) => store.get(key))) as string | undefined) ?? null,
  setItem: async (key: string, value: string): Promise<void> => void (await run('readwrite', (store) => store.put(value, key))),
  removeItem: async (key: string): Promise<void> => void (await run('readwrite', (store) => store.delete(key))),
};
