import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

/**
 * Seam B: database của dự án, truy cập đúng như PostgREST của Supabase làm —
 * mỗi lệnh chạy trong một transaction với role `anon` hoặc `authenticated`
 * và JWT claims của người gọi, nên RLS được áp dụng thật.
 *
 * Xem ADR 0005 về lý do dùng PGlite thay cho Supabase CLI + Docker.
 */

const DATE_OID = 1082;
const TIMESTAMPTZ_OID = 1184;
const ROOT = join(import.meta.dirname, '..', '..');
const SHIM_FILE = join(import.meta.dirname, 'supabase-shim.sql');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

export type TestUser = { id: string; email: string };

export type Caller = {
  /** Chạy một câu SQL với quyền của người gọi; trả về các dòng kết quả. */
  query<Row = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<Row[]>;
  /** Gọi một hàm RPC trả về một giá trị, giống `supabase.rpc(name, args)`. */
  rpc<Result = unknown>(name: string, args?: Record<string, unknown>): Promise<Result>;
  /** Gọi một hàm RPC trả về bảng (nhiều dòng), giống `supabase.rpc(name, args)`. */
  rpcRows<Row = Record<string, unknown>>(name: string, args?: Record<string, unknown>): Promise<Row[]>;
};

export type TestDb = {
  createUser(email: string): Promise<TestUser>;
  as(user: TestUser): Caller;
  asAnon(): Caller;
  /** Truy cập không qua RLS — chỉ để dựng dữ liệu hoặc kiểm tra trong test. */
  admin: PGlite;
  close(): Promise<void>;
};

async function listMigrations(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR).catch(() => []);
  return entries.filter((name) => name.endsWith('.sql')).sort();
}

// Đối số kiểu object được gửi dạng JSON, như PostgREST làm với tham số jsonb.
const namedArgs = (args: Record<string, unknown>) => {
  const keys = Object.keys(args);
  return {
    placeholders: keys.map((key, index) => `${key} => $${index + 1}`).join(', '),
    values: keys.map((key) => {
      const value = args[key];
      return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
    }),
  };
};

export async function createTestDb(): Promise<TestDb> {
  // Trả ngày/giờ dạng chuỗi như PostgREST (không đổi sang Date của JS).
  const db = await PGlite.create({
    parsers: { [DATE_OID]: (value: string) => value, [TIMESTAMPTZ_OID]: (value: string) => value },
    extensions: { pgcrypto },
  });
  await db.exec(await readFile(SHIM_FILE, 'utf8'));
  for (const file of await listMigrations()) {
    await db.exec(await readFile(join(MIGRATIONS_DIR, file), 'utf8'));
  }

  const callerFor = (role: 'anon' | 'authenticated', userId?: string): Caller => {
    const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
    const inScope = <T>(work: (tx: Transaction) => Promise<T>) =>
      db.transaction(async (tx) => {
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
        await tx.exec(`set local role ${role}`);
        return work(tx);
      });

    return {
      query: async <Row>(sql: string, params: unknown[] = []) =>
        inScope(async (tx) => (await tx.query<Row>(sql, params)).rows),
      rpc: async <Result>(name: string, args: Record<string, unknown> = {}) => {
        const { placeholders, values } = namedArgs(args);
        return inScope(async (tx) => {
          const result = await tx.query<{ result: Result }>(`select public.${name}(${placeholders}) as result`, values);
          return result.rows[0]!.result;
        });
      },
      rpcRows: async <Row>(name: string, args: Record<string, unknown> = {}) => {
        const { placeholders, values } = namedArgs(args);
        return inScope(async (tx) => (await tx.query<Row>(`select * from public.${name}(${placeholders})`, values)).rows);
      },
    };
  };

  return {
    createUser: async (email) => {
      const result = await db.query<TestUser>(
        'insert into auth.users (email) values ($1) returning id, email',
        [email],
      );
      return result.rows[0]!;
    },
    as: (user) => callerFor('authenticated', user.id),
    asAnon: () => callerFor('anon'),
    admin: db,
    close: () => db.close(),
  };
}
