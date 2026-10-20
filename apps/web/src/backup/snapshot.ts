import type { Tree } from '../data/trees';
import { safeFileName } from './backup';

/**
 * Phần THUẦN của bản sao lưu: danh sách ảnh cần tải (và tên file trong zip), và nội dung du-lieu.json.
 * Việc tải dữ liệu, tải ảnh, đóng zip và tải xuống nằm ở download-backup.ts (rìa I/O); định dạng file sao lưu nằm ở đây và có test.
 */
export const BACKUP_FORMAT = 'gia-pha-sao-luu';
/** 2: thêm `eventPhotos` (ảnh sự kiện) và thư mục anh-su-kien/ trong zip. */
export const BACKUP_VERSION = 2;

export type ImageJob = {
  /** Đường dẫn lưu trong database ("{tree_id}/{id file}"). */
  path: string;
  /** Tên file trong zip, chưa có đuôi (đuôi theo loại ảnh tải về). */
  zipBase: string;
  /** Id dòng person_photos; null cho ảnh bìa của cả gia phả. */
  photoId: string | null;
};

/**
 * Ảnh bìa (nếu có), ảnh từng Người (anh/, tên Người + số thứ tự), rồi ảnh từng sự kiện (anh-su-kien/, tên sự kiện + số thứ tự);
 * không trùng, không có ký tự cấm trên Windows/macOS.
 */
export const planImageJobs = (
  tree: Pick<Tree, 'photo_path'>,
  photos: readonly { id: string; person_id: string; storage_path: string }[],
  personName: ReadonlyMap<string, string>,
  eventPhotos: readonly { id: string; event_id: string; storage_path: string }[] = [],
  eventTitle: ReadonlyMap<string, string> = new Map(),
): ImageJob[] => [
  ...(tree.photo_path ? [{ path: tree.photo_path, zipBase: 'anh/gia-pha', photoId: null }] : []),
  ...photos.map((photo, index) => ({
    path: photo.storage_path,
    zipBase: `anh/${safeFileName(personName.get(photo.person_id) ?? 'khong-ten')}-${String(index + 1).padStart(3, '0')}`,
    photoId: photo.id,
  })),
  ...eventPhotos.map((photo, index) => ({
    path: photo.storage_path,
    zipBase: `anh-su-kien/${safeFileName(eventTitle.get(photo.event_id) ?? 'khong-ten')}-${String(index + 1).padStart(3, '0')}`,
    photoId: photo.id,
  })),
];

type Backupable = { id: string };
export type BackupDataInput = {
  tree: Pick<Tree, 'id' | 'name' | 'description' | 'outside_generations' | 'created_at'>;
  /** File ảnh bìa trong zip (null nếu không có hoặc tải lỗi). */
  coverFile: string | null;
  persons: readonly unknown[];
  parentLinks: readonly unknown[];
  unions: readonly unknown[];
  events: readonly unknown[];
  photos: readonly Backupable[];
  /** Ảnh sự kiện. */
  eventPhotos?: readonly Backupable[];
  /** Tên file trong zip của từng ảnh đã tải được, theo id ảnh. */
  zipPathByPhoto: ReadonlyMap<string, string>;
  phaDoConfig: unknown;
};

/** Nội dung du-lieu.json: có định dạng + phiên bản để đọc lại được về sau; mỗi ảnh có trường `file` trỏ vào zip (null nếu tải lỗi). */
export const buildBackupData = (input: BackupDataInput): Record<string, unknown> => ({
  dinhDang: BACKUP_FORMAT,
  phienBan: BACKUP_VERSION,
  giaPha: {
    id: input.tree.id,
    name: input.tree.name,
    description: input.tree.description,
    outside_generations: input.tree.outside_generations,
    created_at: input.tree.created_at,
    photo_file: input.coverFile,
  },
  persons: input.persons,
  parentLinks: input.parentLinks,
  unions: input.unions,
  events: input.events,
  photos: input.photos.map((photo) => ({ ...photo, file: input.zipPathByPhoto.get(photo.id) ?? null })),
  eventPhotos: (input.eventPhotos ?? []).map((photo) => ({ ...photo, file: input.zipPathByPhoto.get(photo.id) ?? null })),
  phaDoConfig: input.phaDoConfig,
});
