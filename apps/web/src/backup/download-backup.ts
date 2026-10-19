import { loadPhaDoConfig } from '../data/pha-do';
import { listTreeEvents } from '../data/calendar';
import { loadFamily } from '../data/family';
import { fetchPhotoBlob } from '../data/photos';
import type { Tree } from '../data/trees';
import { fetchAll } from '../lib/fetch-all';
import { supabase } from '../lib/supabase';
import { exportFileName, downloadBlob } from '../lib/download';
import { buildBackupZip, type BackupImage } from './backup';
import { buildBackupData, planImageJobs } from './snapshot';

const IMAGE_CONCURRENCY = 4;

export type BackupProgress = { stage: 'data' | 'images' | 'zip'; done?: number; total?: number };

const extensionOf = (blob: Blob): string => (blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg');

/** Chạy `work` cho từng phần tử, tối đa `limit` việc cùng lúc. */
const mapLimited = async <Item>(items: readonly Item[], limit: number, work: (item: Item) => Promise<void>): Promise<void> => {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

/** Tải mọi dữ liệu + ảnh của Gia phả, đóng thành một file zip và đưa xuống máy người dùng. Trả số ảnh không tải được. */
export const downloadFullBackup = async (tree: Tree, today: string, onProgress: (progress: BackupProgress) => void): Promise<number> => {
  onProgress({ stage: 'data' });
  const [family, events, phaDo, photoRows] = await Promise.all([
    loadFamily(tree.id),
    listTreeEvents(tree.id),
    loadPhaDoConfig(tree.id),
    fetchAll((from, to) => supabase.from('person_photos').select('*').eq('tree_id', tree.id).order('created_at').order('id').range(from, to)),
  ]);
  if (photoRows.error) throw new Error(photoRows.error.message);
  const photos = photoRows.data ?? [];
  const personName = new Map(family.persons.map((person) => [person.id, person.full_name]));

  const jobs = planImageJobs(tree, photos, personName);

  const images: BackupImage[] = [];
  const zipPathByPhoto = new Map<string, string>();
  let coverFile: string | null = null;
  const failed: string[] = [];
  let done = 0;
  onProgress({ stage: 'images', done, total: jobs.length });
  await mapLimited(jobs, IMAGE_CONCURRENCY, async (job) => {
    try {
      const blob = await fetchPhotoBlob(job.path);
      const path = `${job.zipBase}.${extensionOf(blob)}`;
      images.push({ path, bytes: new Uint8Array(await blob.arrayBuffer()) });
      if (job.photoId) zipPathByPhoto.set(job.photoId, path);
      else coverFile = path;
    } catch {
      failed.push(job.zipBase);
    }
    done += 1;
    onProgress({ stage: 'images', done, total: jobs.length });
  });

  onProgress({ stage: 'zip' });
  const [{ default: writeXlsxFile }, { exportSheets, familyToRows }] = await Promise.all([
    import('write-excel-file/browser'),
    import('../excel/export'),
  ]);
  const xlsx = await writeXlsxFile(exportSheets(familyToRows(family))).toBlob();

  const zip = buildBackupZip({
    treeName: tree.name,
    exportedAt: new Date().toISOString(),
    xlsx: new Uint8Array(await xlsx.arrayBuffer()),
    images,
    failedImages: failed.sort(),
    data: buildBackupData({
      tree,
      coverFile,
      persons: family.persons,
      parentLinks: family.parentLinks,
      unions: family.unions,
      events,
      photos,
      zipPathByPhoto,
      phaDoConfig: phaDo,
    }),
  });
  downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), exportFileName('Sao-luu', tree.name, today, 'zip'));
  return failed.length;
};
