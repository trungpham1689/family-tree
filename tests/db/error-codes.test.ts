import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUSINESS_MESSAGES } from '../../apps/web/src/data/db-error-message';

const MIGRATIONS = join(import.meta.dirname, '..', '..', 'supabase', 'migrations');

/** Mã không cần câu riêng: chỉ do hàm nội bộ/trigger bắt hoặc dành cho kiểm tra của chính test. */
const NOT_USER_FACING = new Set<string>([]);

describe('mã lỗi nghiệp vụ trong migration', () => {
  it('mọi mã `raise exception \'MA_LOI\'` đều có câu tiếng Việt trong db-error-message.ts', () => {
    const codes = new Set<string>();
    for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql'))) {
      for (const match of readFileSync(join(MIGRATIONS, file), 'utf8').matchAll(/raise exception '([A-Z][A-Z_]+)'/g)) codes.add(match[1]!);
    }
    const missing = [...codes].filter((code) => !(code in BUSINESS_MESSAGES) && !NOT_USER_FACING.has(code));
    expect(missing).toEqual([]);
  });
});
