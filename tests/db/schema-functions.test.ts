import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from './harness';

const SNAPSHOT = join(import.meta.dirname, '..', '..', 'supabase', 'schema-functions.sql');

/** Định nghĩa HIỆN HÀNH của mọi hàm ở public / private / public_share (sau khi áp mọi migration), kèm quyền gọi. */
const generate = async (db: TestDb): Promise<string> => {
  const rows = (
    await db.admin.query<{ schema: string; signature: string; def: string; anon: boolean; authenticated: boolean; service: boolean }>(`
      select n.nspname as schema,
             p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature,
             pg_get_functiondef(p.oid) as def,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
             has_function_privilege('service_role', p.oid, 'execute') as service
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private', 'public_share') and p.prokind = 'f'
      order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)`)
  ).rows;
  const flag = (value: boolean) => (value ? 'có' : 'không');
  return (
    '-- TẠO TỰ ĐỘNG từ các migration — đừng sửa tay. Cập nhật: UPDATE_SCHEMA_SNAPSHOT=1 pnpm test:db\n' +
    '-- Đây là bản HIỆN HÀNH của từng hàm (nhiều hàm được định nghĩa lại qua nhiều migration); đọc file này thay vì lần theo các migration.\n\n' +
    rows
      .map((row) => `-- ${row.schema}.${row.signature}  [anon: ${flag(row.anon)}, authenticated: ${flag(row.authenticated)}, service_role: ${flag(row.service)}]\n${row.def.trim()};\n`)
      .join('\n')
  );
};

describe('seam B: ảnh chụp định nghĩa hàm SQL hiện hành', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.close();
  });

  it('supabase/schema-functions.sql khớp với các migration (lệch thì chạy lại với UPDATE_SCHEMA_SNAPSHOT=1)', async () => {
    const current = await generate(db);
    if (process.env.UPDATE_SCHEMA_SNAPSHOT === '1') {
      await writeFile(SNAPSHOT, current);
      return;
    }
    const saved = await readFile(SNAPSHOT, 'utf8').catch(() => '');
    expect(current, 'Hàm SQL đã đổi: chạy `UPDATE_SCHEMA_SNAPSHOT=1 pnpm test:db` rồi commit supabase/schema-functions.sql').toBe(saved);
  });
});
