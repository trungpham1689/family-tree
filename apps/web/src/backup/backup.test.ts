import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildBackupZip, safeFileName } from './backup';

describe('sao lưu đầy đủ gia phả', () => {
  const input = {
    treeName: 'Họ Phạm',
    exportedAt: '2026-10-19T10:00:00Z',
    data: { persons: [{ id: 'a', full_name: 'Phạm Văn Tổ' }], photos: [{ id: 'p1', file: 'anh/Phạm Văn Tổ-001.jpg' }] },
    xlsx: new Uint8Array([1, 2, 3]),
    images: [{ path: 'anh/Phạm Văn Tổ-001.jpg', bytes: new Uint8Array([255, 216, 255]) }],
    failedImages: [] as string[],
  };

  it('zip có hướng dẫn, JSON đọc lại đúng, Excel và ảnh nguyên vẹn', () => {
    const files = unzipSync(buildBackupZip(input));
    expect(Object.keys(files).sort()).toEqual(['HUONG-DAN.txt', 'anh/Phạm Văn Tổ-001.jpg', 'du-lieu.json', 'gia-pha.xlsx']);
    expect(JSON.parse(strFromU8(files['du-lieu.json']!))).toEqual(input.data);
    expect([...files['gia-pha.xlsx']!]).toEqual([1, 2, 3]);
    expect([...files['anh/Phạm Văn Tổ-001.jpg']!]).toEqual([255, 216, 255]);
    expect(strFromU8(files['HUONG-DAN.txt']!)).toContain('Họ Phạm');
  });

  it('báo trong hướng dẫn những ảnh không tải được; không có Excel thì bỏ file đó', () => {
    const files = unzipSync(buildBackupZip({ ...input, xlsx: null, failedImages: ['anh/Phạm Văn Tổ-002'] }));
    expect(files['gia-pha.xlsx']).toBeUndefined();
    expect(strFromU8(files['HUONG-DAN.txt']!)).toContain('Không tải được 1 ảnh');
    expect(strFromU8(files['HUONG-DAN.txt']!)).toContain('anh/Phạm Văn Tổ-002');
  });

  it('safeFileName bỏ ký tự cấm, giữ dấu tiếng Việt, không để trống', () => {
    expect(safeFileName('Phạm/Văn: "Tổ"?')).toBe('Phạm Văn Tổ');
    expect(safeFileName('///')).toBe('khong-ten');
    expect(safeFileName('a'.repeat(200))).toHaveLength(80);
  });
});
