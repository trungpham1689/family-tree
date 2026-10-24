import type { Row } from './database.types';
import { IMAGE_HEADER_BYTES, isRasterImage } from '../lib/image-format';
import { supabase } from '../lib/supabase';
import { DataError, failOn } from './trees';

/**
 * Ảnh nằm trên Google Drive, qua Pages Function /api/photos (khoá Drive giữ phía server).
 * Đường dẫn lưu trong database: "{tree_id}/{id file Drive}". Đường dẫn 3 đoạn cũ ("{tree_id}/{person_id}/{file}")
 * là ảnh trên Supabase Storage chưa chuyển — vẫn đọc/xoá được cho tới khi chạy scripts/migrate-photos-to-drive.mjs.
 */
export const AVATAR_BUCKET = 'avatars';
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/** Giới hạn trên file gốc, trước khi nén — chặn sớm ảnh quá khổ trước khi trình duyệt phải giải mã. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
/** Phải khớp app_settings.max_photos_per_person trong database (nơi chặn thật); dùng để báo sớm và ẩn nút thêm. */
export const MAX_PHOTOS_PER_PERSON = 3;

/** Phải khớp app_settings.max_photos_per_event trong database (nơi chặn thật). */
export const MAX_PHOTOS_PER_EVENT = 5;

export type PhotoKind = 'member' | 'tree' | 'event';

/**
 * Khuyến nghị cho người tải ảnh. Trình duyệt tự thu nhỏ về `maxEdge` và nén JPEG nên ảnh điện thoại
 * 5–10MB chỉ còn khoảng 100–300KB trên Drive; ảnh nhỏ hơn `minEdge` bị từ chối vì sẽ vỡ khi phóng.
 */
export const PHOTO_SPECS: Record<PhotoKind, { maxEdge: number; minEdge: number; hint: string }> = {
  member: {
    maxEdge: 1000,
    minEdge: 300,
    hint: 'Ảnh chân dung vuông hoặc dọc, mặt ở giữa khung (ảnh đại diện được cắt tròn). Tối thiểu 300×300px, nên từ 800px trở lên; tối đa 5MB, JPEG/PNG/WEBP. Hệ thống tự thu nhỏ về 1000px.',
  },
  tree: {
    maxEdge: 1600,
    minEdge: 600,
    hint: 'Ảnh ngang (tỉ lệ 3:2 hoặc 16:9) như ảnh nhà thờ họ, ảnh cả họ. Tối thiểu 1200×800px; tối đa 5MB, JPEG/PNG/WEBP. Hệ thống tự thu nhỏ về 1600px.',
  },
  event: {
    maxEdge: 1600,
    minEdge: 400,
    hint: 'Ảnh ngang hoặc dọc đều được. Tối đa 5 ảnh mỗi sự kiện, mỗi ảnh tối đa 5MB, JPEG/PNG/WEBP, cạnh dài từ 400px. Hệ thống tự thu nhỏ về 1600px. Ảnh đầu tiên là ảnh đại diện trong Phả ký và Dòng thời gian.',
  },
};

/** Mục tiêu dung lượng sau nén (SPEC story 78): giảm dần chất lượng JPEG cho tới khi dưới mức này hoặc hết bậc. */
const TARGET_BYTES = 400 * 1024;
const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

export type PersonPhoto = Row<'person_photos'>;
export type EventPhoto = Row<'event_photos'>;

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(blob);
  });

/** Kiểm file trước khi nén; trả câu báo lỗi tiếng Việt, hoặc null nếu dùng được. */
export const checkImageFile = (file: File): string | null => {
  if (!IMAGE_MIME_TYPES.includes(file.type)) return 'Chỉ nhận ảnh JPEG, PNG hoặc WEBP.';
  if (file.size > MAX_AVATAR_BYTES) return `Ảnh tối đa ${Math.floor(MAX_AVATAR_BYTES / (1024 * 1024))}MB.`;
  return null;
};

/** Co ảnh về tối đa `maxEdge` px cạnh dài và nén lại thành JPEG trước khi tải lên. */
const optimizeImage = async (file: File, kind: PhotoKind): Promise<Blob> => {
  const { maxEdge, minEdge } = PHOTO_SPECS[kind];
  const bitmap = await createImageBitmap(file);
  try {
    if (Math.max(bitmap.width, bitmap.height) < minEdge) {
      throw new Error(`Ảnh quá nhỏ (${bitmap.width}×${bitmap.height}px). Cạnh dài nhất cần từ ${minEdge}px.`);
    }
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không xử lý được ảnh.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let optimized: Blob | null = null;
    for (const quality of JPEG_QUALITIES) {
      optimized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!optimized) throw new Error('Trình duyệt không nén được ảnh.');
      if (optimized.size <= TARGET_BYTES) break;
    }
    return optimized!;
  } finally {
    bitmap.close();
  }
};

class PhotoRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Gọi Pages Function kèm phiên đăng nhập Supabase hiện tại. */
const photoRequest = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`/api/photos${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${data.session?.access_token ?? ''}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new PhotoRequestError(response.status, body?.error ?? 'Không kết nối được kho ảnh. Hãy thử lại.');
  }
  return response;
};

const drivePathOf = (path: string): { treeId: string; fileId: string } | null => {
  const parts = path.split('/');
  return parts.length === 2 ? { treeId: parts[0]!, fileId: parts[1]! } : null;
};

/**
 * Kho ảnh sau một đường dẫn đã lưu trong database. Hai adapter thật: Google Drive (đường dẫn "{tree_id}/{id file}",
 * qua Pages Function /api/photos) và Supabase Storage (ảnh cũ, đường dẫn 3 đoạn, chưa chuyển). Phần còn lại của app
 * không biết dạng đường dẫn nào là kho nào.
 */
type PhotoStore = { remove: (path: string) => Promise<void>; fetchBlob: (path: string) => Promise<Blob> };

const driveStore: PhotoStore = {
  remove: async (path) => {
    const { treeId, fileId } = drivePathOf(path)!;
    try {
      await photoRequest(`/${fileId}?treeId=${treeId}`, { method: 'DELETE' });
    } catch (error) {
      // Ảnh đã không còn trên Drive (404) thì coi như đã xoá.
      if (!(error instanceof PhotoRequestError && error.status === 404)) throw error;
    }
  },
  fetchBlob: async (path) => {
    const { treeId, fileId } = drivePathOf(path)!;
    return (await photoRequest(`/${fileId}?treeId=${treeId}`)).blob();
  },
};

const legacyStorageStore: PhotoStore = {
  remove: async (path) => {
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    failOn(error);
  },
  fetchBlob: async (path) => {
    const { data, error } = await supabase.storage.from(AVATAR_BUCKET).download(path);
    failOn(error);
    return data;
  },
};

const storeFor = (path: string): PhotoStore => (drivePathOf(path) ? driveStore : legacyStorageStore);

/** Nén rồi đưa ảnh lên Drive, trả đường dẫn "{tree_id}/{id file Drive}". */
const uploadToDrive = async (input: { treeId: string; kind: PhotoKind; personId?: string; eventId?: string; file: File }): Promise<string> => {
  const blob = await optimizeImage(input.file, input.kind);
  const query = new URLSearchParams({ treeId: input.treeId, kind: input.kind });
  if (input.personId) query.set('personId', input.personId);
  if (input.eventId) query.set('eventId', input.eventId);
  const response = await photoRequest(`?${query}`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
  return `${input.treeId}/${((await response.json()) as { fileId: string }).fileId}`;
};

const removeStored = (path: string): Promise<void> => storeFor(path).remove(path);

export const listPersonPhotos = async (personId: string): Promise<PersonPhoto[]> => {
  const { data, error } = await supabase
    .from('person_photos')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: true });
  failOn(error);
  return data;
};

/** Thêm một ảnh tư liệu; `setAsAvatar` thường là true khi đây là ảnh đầu tiên của người đó. */
export const uploadPersonPhoto = async (input: {
  treeId: string;
  personId: string;
  file: File;
  caption: string | null;
  setAsAvatar: boolean;
}): Promise<PersonPhoto> => {
  const path = await uploadToDrive({ treeId: input.treeId, kind: 'member', personId: input.personId, file: input.file });
  const { data, error } = await supabase
    .from('person_photos')
    .insert({ person_id: input.personId, storage_path: path, caption: input.caption, is_avatar: input.setAsAvatar })
    .select('*')
    .single();
  if (error) {
    await removeStored(path).catch(() => undefined); // không để file mồ côi trên Drive
    throw new DataError(error);
  }
  return data;
};

/** Ảnh của mọi sự kiện trong một gia phả, theo thứ tự tải lên (ảnh đầu của mỗi sự kiện là ảnh đại diện). */
export const listEventPhotos = async (treeId: string): Promise<EventPhoto[]> => {
  const { data, error } = await supabase.from('event_photos').select('*').eq('tree_id', treeId).order('created_at').order('id');
  failOn(error);
  return data;
};

/** Thêm một ảnh cho sự kiện (tối đa MAX_PHOTOS_PER_EVENT, chặn thật ở database). */
export const uploadEventPhoto = async (input: { treeId: string; eventId: string; file: File }): Promise<EventPhoto> => {
  const path = await uploadToDrive({ treeId: input.treeId, kind: 'event', eventId: input.eventId, file: input.file });
  const { data, error } = await supabase.from('event_photos').insert({ event_id: input.eventId, storage_path: path }).select('*').single();
  if (error) {
    await removeStored(path).catch(() => undefined); // không để file mồ côi trên Drive
    throw new DataError(error);
  }
  return data;
};

/** Xoá dòng dữ liệu trước (RLS quyết định quyền), rồi mới xoá file, như ảnh Người. */
export const removeEventPhoto = async (input: { photoId: string; path: string }): Promise<void> => {
  const { error } = await supabase.from('event_photos').delete().eq('id', input.photoId);
  failOn(error);
  await removeStored(input.path).catch(() => undefined);
};

/** Đường dẫn file ảnh của một sự kiện, lấy trước khi xoá sự kiện (xoá sự kiện kéo theo xoá dòng ảnh). */
export const listEventPhotoPaths = async (eventId: string): Promise<string[]> => {
  const { data, error } = await supabase.from('event_photos').select('storage_path').eq('event_id', eventId);
  failOn(error);
  return data.map((row) => row.storage_path);
};

export const setAvatarPhoto = async (photoId: string): Promise<void> => {
  const { error } = await supabase.rpc('set_avatar_photo', { photo_id: photoId });
  failOn(error);
};

export const updatePhotoCaption = async (input: { photoId: string; caption: string | null }): Promise<void> => {
  const { error } = await supabase.from('person_photos').update({ caption: input.caption }).eq('id', input.photoId);
  failOn(error);
};

/**
 * Xoá dòng dữ liệu trước: quyền do database quyết định (RLS), nên người không có quyền bị từ chối khi chưa mất gì.
 * Rồi mới xoá file; xoá file lỗi chỉ để lại một file mồ côi vô hình, không để lại dòng trỏ vào file đã mất.
 */
export const removePersonPhoto = async (input: { photoId: string; path: string }): Promise<void> => {
  const { error } = await supabase.from('person_photos').delete().eq('id', input.photoId);
  failOn(error);
  await removeStored(input.path).catch(() => undefined);
};

/** Đường dẫn các file ảnh của một Người, lấy trước khi xoá Người (xoá Người kéo theo xoá dòng ảnh). */
export const listPersonPhotoPaths = async (personId: string): Promise<string[]> =>
  (await listPersonPhotos(personId)).map((photo) => photo.storage_path);

/** Xoá các file ảnh khỏi kho sau khi dòng dữ liệu đã xoá; lỗi lẻ tẻ chỉ để lại file mồ côi. */
export const discardStoredFiles = async (paths: readonly string[]): Promise<void> => {
  await Promise.allSettled(paths.map(removeStored));
};

/** Xoá gia phả: server xoá dòng trong database (quyền Chủ sở hữu) rồi mới dọn thư mục ảnh trên Drive. */
export const deleteTreeWithPhotos = async (treeId: string): Promise<void> => {
  await photoRequest(`?${new URLSearchParams({ treeId })}`, { method: 'DELETE' });
};

/** Dọn file ảnh mồ côi trên Drive của một gia phả; trả số file đã xoá. */
export const sweepOrphanPhotos = async (treeId: string): Promise<number> => {
  const response = await photoRequest(`/sweep?${new URLSearchParams({ treeId })}`, { method: 'POST' });
  return ((await response.json()) as { deleted: number }).deleted;
};

/** Đặt (hoặc thay) ảnh đại diện của cả gia phả; ảnh cũ trên Drive được xoá sau khi ảnh mới đã lưu. */
export const setTreePhoto = async (input: { treeId: string; file: File; previousPath: string | null }): Promise<void> => {
  const path = await uploadToDrive({ treeId: input.treeId, kind: 'tree', file: input.file });
  const { error } = await supabase.from('family_trees').update({ photo_path: path }).eq('id', input.treeId);
  if (error) {
    await removeStored(path).catch(() => undefined);
    throw new DataError(error);
  }
  if (input.previousPath) await removeStored(input.previousPath).catch(() => undefined);
};

export const removeTreePhoto = async (input: { treeId: string; path: string }): Promise<void> => {
  const { error } = await supabase.from('family_trees').update({ photo_path: null }).eq('id', input.treeId);
  failOn(error);
  await removeStored(input.path).catch(() => undefined);
};

/**
 * Tải file ảnh gốc về dưới dạng Blob, từ kho nào cũng vậy. Dữ liệu không phải ảnh (vd. `pnpm dev` không có /api/photos nên Vite
 * trả index.html kèm mã 200) bị coi là ảnh lỗi: nếu lọt vào Phả đồ/Phả ký/Dòng thời gian, jsPDF ném lỗi và cả file PDF hỏng.
 */
export const fetchPhotoBlob = async (path: string): Promise<Blob> => {
  const blob = await storeFor(path).fetchBlob(path);
  if (!isRasterImage(new Uint8Array(await blob.slice(0, IMAGE_HEADER_BYTES).arrayBuffer()))) {
    throw new Error('Kho ảnh trả về dữ liệu không phải ảnh.');
  }
  return blob;
};

/** Tải ảnh về và đổi thành data URL (hiện trực tiếp, và nhúng được vào Phả đồ/PDF không cần CORS). */
export const fetchAvatarDataUrl = async (path: string): Promise<string> => blobToDataUrl(await fetchPhotoBlob(path));

/** Số ảnh tải cùng lúc và số ảnh nhớ tối đa; ảnh đổi thì đường dẫn đổi theo nên bản nhớ cũ không bao giờ bị dùng sai. */
const AVATAR_CONCURRENCY = 6;
const AVATAR_CACHE_LIMIT = 3000;
const avatarCache = new Map<string, string>();

/**
 * Tải nhiều ảnh thành data URL, tối đa `AVATAR_CONCURRENCY` ảnh cùng lúc, mỗi ảnh nhớ theo đường dẫn (đổi một ảnh chỉ tải lại ảnh đó).
 * Ảnh nào lỗi (đã xoá, mất mạng) thì bị bỏ qua, không làm mất các ảnh còn lại.
 */
export const fetchAvatarDataUrls = async <Key>(items: readonly { key: Key; path: string }[]): Promise<Map<Key, string>> => {
  const result = new Map<Key, string>();
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const { key, path } = items[next++]!;
      let url = avatarCache.get(path);
      if (url === undefined) {
        try {
          url = await fetchAvatarDataUrl(path);
        } catch {
          continue;
        }
        avatarCache.set(path, url);
        if (avatarCache.size > AVATAR_CACHE_LIMIT) avatarCache.delete(avatarCache.keys().next().value!);
      }
      result.set(key, url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AVATAR_CONCURRENCY, items.length) }, worker));
  return result;
};
