/** Kho khoá–giá trị nhỏ trên IndexedDB (không bị giới hạn ~5MB như localStorage), đủ cho bộ nhớ đệm xem offline. */
const DB_NAME = 'gia-pha';
const STORE = 'kv';

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

export const idbStorage = {
  getItem: async (key: string): Promise<string | null> => ((await run('readonly', (store) => store.get(key))) as string | undefined) ?? null,
  setItem: async (key: string, value: string): Promise<void> => void (await run('readwrite', (store) => store.put(value, key))),
  removeItem: async (key: string): Promise<void> => void (await run('readwrite', (store) => store.delete(key))),
};
