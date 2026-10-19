// Chuyển ảnh cũ trên Supabase Storage (bucket 'avatars') sang Google Drive. Chạy một lần, chạy lại an toàn
// (chỉ động vào ảnh còn đường dẫn 3 đoạn cũ). Dùng chung mã Drive với Pages Function nên cùng cấu trúc thư mục.
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… GOOGLE_REFRESH_TOKEN=… \
//   node --experimental-strip-types apps/web/scripts/migrate-photos-to-drive.mjs [--dry-run]
import { createClient } from '@supabase/supabase-js';
import { ensureTreeFolders, getAccessToken, uploadImage } from '../src/drive/drive-api.ts';

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Thiếu biến môi trường: ${missing.join(', ')}`);
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const token = await getAccessToken(process.env);

const { data: photos, error } = await supabase.from('person_photos').select('id, tree_id, person_id, storage_path').order('created_at');
if (error) throw error;
const legacy = photos.filter((photo) => photo.storage_path.split('/').length === 3);
console.log(`${legacy.length}/${photos.length} ảnh còn ở Supabase Storage.${dryRun ? ' (chạy thử, không ghi gì)' : ''}`);

const folders = new Map();
let moved = 0;
for (const photo of legacy) {
  try {
    if (dryRun) continue;
    if (!folders.has(photo.tree_id)) {
      const { data: tree, error: treeError } = await supabase.from('family_trees').select('name').eq('id', photo.tree_id).single();
      if (treeError) throw treeError;
      folders.set(photo.tree_id, await ensureTreeFolders(token, photo.tree_id, tree.name));
    }
    const { data: blob, error: downloadError } = await supabase.storage.from('avatars').download(photo.storage_path);
    if (downloadError) throw downloadError;
    const fileId = await uploadImage(token, {
      name: `${photo.person_id}-${crypto.randomUUID()}.jpg`,
      parent: folders.get(photo.tree_id).memberPhotos,
      treeId: photo.tree_id,
      mimeType: blob.type || 'image/jpeg',
      bytes: await blob.arrayBuffer(),
    });
    // Cập nhật đường dẫn trước, xoá file cũ sau: lỗi giữa chừng chỉ để lại file thừa, không mất ảnh.
    const { error: updateError } = await supabase.from('person_photos').update({ storage_path: `${photo.tree_id}/${fileId}` }).eq('id', photo.id);
    if (updateError) throw updateError;
    await supabase.storage.from('avatars').remove([photo.storage_path]);
    moved += 1;
    console.log(`✓ ${photo.storage_path} → Drive ${fileId}`);
  } catch (failure) {
    console.error(`✗ ${photo.storage_path}: ${failure instanceof Error ? failure.message : JSON.stringify(failure)}`);
  }
}
console.log(`Đã chuyển ${moved}/${legacy.length} ảnh.`);
