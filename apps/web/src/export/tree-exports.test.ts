import { describe, expect, it, vi } from 'vitest';

// tree-exports kéo theo lớp dữ liệu (cần biến môi trường Supabase); test này chỉ xem bảng các loại xuất.
vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { EXPORT_JOBS, type ExportKind } from './tree-exports';

describe('EXPORT_JOBS', () => {
  it('mỗi loại xuất có câu báo lỗi tiếng Việt riêng khi hỏng', () => {
    const kinds = Object.keys(EXPORT_JOBS) as ExportKind[];
    expect(kinds.sort()).toEqual(['backup-zip', 'ics', 'pha-do-pdf', 'pha-do-png', 'pha-ky-pdf', 'xlsx']);
    for (const kind of kinds) expect(EXPORT_JOBS[kind].failure, kind).toMatch(/^Không tạo được/);
  });
});
