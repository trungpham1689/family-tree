import type { Row } from './database.types';
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

export type PhotoKind = 'member' | 'tree';

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
};

/** Mục tiêu dung lượng sau nén (SPEC story 78): giảm dần chất lượng JPEG cho tới khi dưới mức này hoặc hết bậc. */
const TARGET_BYTES = 400 * 1024;
const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

export type PersonPhoto = Row<'person_photos'>;

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
const uploadToDrive = async (input: { treeId: string; kind: PhotoKind; personId?: string; file: File }): Promise<string> => {
  const blob = await optimizeImage(input.file, input.kind);
  const query = new URLSearchParams({ treeId: input.treeId, kind: input.kind });
  if (input.personId) query.set('personId', input.personId);
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

/** Xoá cả thư mục ảnh của gia phả trên Drive (gọi trước khi xoá gia phả). */
export const purgeTreePhotos = async (treeId: string): Promise<void> => {
  await photoRequest(`?${new URLSearchParams({ treeId })}`, { method: 'DELETE' });
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

/** Tải file ảnh gốc về dưới dạng Blob, từ kho nào cũng vậy. */
export const fetchPhotoBlob = (path: string): Promise<Blob> => storeFor(path).fetchBlob(path);

/** Tải ảnh về và đổi thành data URL (hiện trực tiếp, và nhúng được vào Phả đồ/PDF không cần CORS). */
export const fetchAvatarDataUrl = async (path: string): Promise<string> => blobToDataUrl(await fetchPhotoBlob(path));
