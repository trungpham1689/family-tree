import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, BACKUP_VERSION, buildBackupData, planImageJobs } from './snapshot';

describe('planImageJobs', () => {
  it('ảnh bìa trước, rồi ảnh từng Người theo tên + số thứ tự; tên cấm ký tự bị thay; Người lạ là khong-ten', () => {
    const jobs = planImageJobs(
      { photo_path: 't/cover' },
      [
        { id: 'p1', person_id: 'a', storage_path: 't/f1' },
        { id: 'p2', person_id: 'a', storage_path: 't/f2' },
        { id: 'p3', person_id: 'zzz', storage_path: 't/f3' },
      ],
      new Map([['a', 'Phạm/Văn: Tổ']]),
    );
    expect(jobs.map((j) => [j.zipBase, j.photoId])).toEqual([
      ['anh/gia-pha', null],
      ['anh/Phạm Văn Tổ-001', 'p1'],
      ['anh/Phạm Văn Tổ-002', 'p2'],
      ['anh/khong-ten-003', 'p3'],
    ]);
  });

  it('không có ảnh bìa thì không có job bìa', () => {
    expect(planImageJobs({ photo_path: null }, [], new Map())).toEqual([]);
  });
});

describe('buildBackupData', () => {
  it('định dạng + phiên bản; mỗi ảnh trỏ file trong zip, ảnh tải lỗi là null', () => {
    const data = buildBackupData({
      tree: { id: 't', name: 'Họ Phạm', description: null, outside_generations: 1, created_at: '2026-01-01' },
      coverFile: 'anh/gia-pha.jpg',
      persons: [{ id: 'a' }],
      parentLinks: [],
      unions: [],
      events: [],
      photos: [{ id: 'p1' }, { id: 'p2' }],
      zipPathByPhoto: new Map([['p1', 'anh/x-001.jpg']]),
      phaDoConfig: null,
    });
    expect(data).toMatchObject({ dinhDang: BACKUP_FORMAT, phienBan: BACKUP_VERSION, giaPha: { id: 't', photo_file: 'anh/gia-pha.jpg' } });
    expect(data.photos).toEqual([{ id: 'p1', file: 'anh/x-001.jpg' }, { id: 'p2', file: null }]);
  });
});
