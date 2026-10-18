import { supabase } from '../lib/supabase';
import { DataError } from './trees';

/** Một ảnh đại diện mỗi Người, trong bucket Storage riêng; đường dẫn lưu ở persons.avatar_path. */
export const AVATAR_BUCKET = 'avatars';
/** Giới hạn trên file gốc, trước khi nén — chặn sớm ảnh quá khổ trước khi trình duyệt phải giải mã. */
export const MAX_AVATAR_BYTES = 15 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Cạnh dài nhất sau khi nén; đủ cho ảnh đại diện và ô Phả đồ, không cần hơn. */
const MAX_AVATAR_DIMENSION = 800;
const AVATAR_JPEG_QUALITY = 0.85;

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(blob);
  });

/** Co ảnh về tối đa 800px cạnh dài và nén lại thành JPEG trước khi tải lên — ảnh điện thoại cỡ chục MB chỉ còn vài trăm KB. */
const optimizeImage = async (file: File): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    const optimized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', AVATAR_JPEG_QUALITY));
    return optimized ?? file;
  } finally {
    bitmap.close();
  }
};

export const uploadAvatar = async (input: { treeId: string; personId: string; file: File }): Promise<string> => {
  const optimized = await optimizeImage(input.file);
  const path = `${input.treeId}/${input.personId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, optimized, { upsert: true, contentType: 'image/jpeg' });
  if (uploadError) throw new DataError(uploadError);
  const { error } = await supabase.from('persons').update({ avatar_path: path }).eq('id', input.personId);
  if (error) throw new DataError(error);
  return path;
};

export const removeAvatar = async (input: { personId: string; path: string }): Promise<void> => {
  const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([input.path]);
  if (removeError) throw new DataError(removeError);
  const { error } = await supabase.from('persons').update({ avatar_path: null }).eq('id', input.personId);
  if (error) throw new DataError(error);
};

/** Tải ảnh về và đổi thành data URL (hiện trực tiếp, và nhúng được vào Phả đồ không cần CORS). */
export const fetchAvatarDataUrl = async (path: string): Promise<string> => {
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).download(path);
  if (error) throw new DataError(error);
  return blobToDataUrl(data);
};
