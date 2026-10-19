import type { Row } from './database.types';
import { supabase } from '../lib/supabase';
import { DataError } from './trees';

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

const JPEG_QUALITY = 0.85;

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
    const optimized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!optimized) throw new Error('Trình duyệt không nén được ảnh.');
    return optimized;
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

/** Nén rồi đưa ảnh lên Drive, trả đường dẫn "{tree_id}/{id file Drive}". */
const uploadToDrive = async (input: { treeId: string; kind: PhotoKind; personId?: string; file: File }): Promise<string> => {
  const blob = await optimizeImage(input.file, input.kind);
  const query = new URLSearchParams({ treeId: input.treeId, kind: input.kind });
  if (input.personId) query.set('personId', input.personId);
  const response = await photoRequest(`?${query}`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob });
  return `${input.treeId}/${((await response.json()) as { fileId: string }).fileId}`;
};

/** Xoá file ảnh khỏi kho (Drive, hoặc Supabase Storage với ảnh cũ). Ảnh đã không còn trên kho (404) thì coi như đã xoá; lỗi khác thì ném ra. */
const removeStored = async (path: string): Promise<void> => {
  const drive = drivePathOf(path);
  if (drive) {
    try {
      await photoRequest(`/${drive.fileId}?treeId=${drive.treeId}`, { method: 'DELETE' });
    } catch (error) {
      if (!(error instanceof PhotoRequestError && error.status === 404)) throw error;
    }
    return;
  }
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw new DataError(error);
};

export const listPersonPhotos = async (personId: string): Promise<PersonPhoto[]> => {
  const { data, error } = await supabase
    .from('person_photos')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: true });
  if (error) throw new DataError(error);
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
  if (error) throw new DataError(error);
};

export const updatePhotoCaption = async (input: { photoId: string; caption: string | null }): Promise<void> => {
  const { error } = await supabase.from('person_photos').update({ caption: input.caption }).eq('id', input.photoId);
  if (error) throw new DataError(error);
};

/** Xoá file trên Drive trước, thành công rồi mới xoá dòng dữ liệu — lỗi Drive thì ảnh còn nguyên, báo cho người dùng thử lại. */
export const removePersonPhoto = async (input: { photoId: string; path: string }): Promise<void> => {
  await removeStored(input.path);
  const { error } = await supabase.from('person_photos').delete().eq('id', input.photoId);
  if (error) throw new DataError(error);
};

/** Xoá mọi file ảnh của một Người khỏi Drive (gọi trước khi xoá Người, vì xoá Người kéo theo xoá dòng ảnh). */
export const purgePersonPhotos = async (personId: string): Promise<void> => {
  const photos = await listPersonPhotos(personId);
  const results = await Promise.allSettled(photos.map((photo) => removeStored(photo.storage_path)));
  const failed = results.filter((result) => result.status === 'rejected').length;
  if (failed > 0) throw new Error(`Không xoá được ${failed} ảnh của Người này trên Google Drive. Hãy thử lại.`);
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
  if (input.previousPath) await removeStored(input.previousPath);
};

export const removeTreePhoto = async (input: { treeId: string; path: string }): Promise<void> => {
  await removeStored(input.path);
  const { error } = await supabase.from('family_trees').update({ photo_path: null }).eq('id', input.treeId);
  if (error) throw new DataError(error);
};

/** Tải file ảnh gốc về dưới dạng Blob (Drive qua /api/photos, hoặc Supabase Storage với ảnh cũ). */
export const fetchPhotoBlob = async (path: string): Promise<Blob> => {
  const drive = drivePathOf(path);
  if (drive) return (await photoRequest(`/${drive.fileId}?treeId=${drive.treeId}`)).blob();
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).download(path);
  if (error) throw new DataError(error);
  return data;
};

/** Tải ảnh về và đổi thành data URL (hiện trực tiếp, và nhúng được vào Phả đồ/PDF không cần CORS). */
export const fetchAvatarDataUrl = async (path: string): Promise<string> => blobToDataUrl(await fetchPhotoBlob(path));
