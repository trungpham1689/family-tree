import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

describe('seam B: bất biến catalog sau khi áp mọi migration', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it('không có vi phạm (search_path, quyền anon, RLS) — cùng file SQL với job CI Postgres 17', async () => {
    const sql = await readFile(join(import.meta.dirname, 'catalog-invariants.sql'), 'utf8');
    const rows = (await db.admin.query<{ violation: string }>(sql)).rows;
    expect(rows.map((row) => row.violation)).toEqual([]);
  });

  it('bắt được vi phạm thật: hàm definer thiếu search_path, hàm cho anon gọi, bảng không RLS, anon có quyền ghi', async () => {
    const sql = await readFile(join(import.meta.dirname, 'catalog-invariants.sql'), 'utf8');
    await db.admin.exec(`
      create function public.bad_definer() returns int language sql security definer as $$ select 1 $$;
      create table public.bad_table (id int);
    `);
    try {
      const violations = (await db.admin.query<{ violation: string }>(sql)).rows.map((row) => row.violation);
      expect(violations.some((v) => v.includes('thiếu search_path') && v.includes('bad_definer'))).toBe(true);
      expect(violations.some((v) => v.includes('anon gọi được') && v.includes('bad_definer'))).toBe(true);
      expect(violations.some((v) => v.includes('chưa bật RLS') && v.includes('bad_table'))).toBe(true);
      expect(violations.some((v) => v.includes('anon có quyền ghi') && v.includes('bad_table'))).toBe(true);
    } finally {
      await db.admin.exec('drop function public.bad_definer(); drop table public.bad_table;');
    }
  });
});
