/**
 * Backend giả lập Supabase để chạy app thật trong trình duyệt khi không có mạng tới Supabase
 * (kiểm tra end-to-end và test khói, ticket 19):
 *   - PGlite chạy đúng shim + mọi migration (như test seam B), mở cổng TCP bằng pglite-socket;
 *   - PostgREST thật (binary .tools/postgrest) phục vụ /rest/v1;
 *   - Auth tối giản thay GoTrue: đăng ký, đăng nhập email/mật khẩu, làm mới phiên, đăng xuất.
 * Chạy: node e2e/backend.mjs   (cổng 54321; PostgREST nội bộ 54323, Postgres 54322)
 */
import { spawn } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createServer, request as httpRequest } from 'node:http';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const ROOT = join(import.meta.dirname, '..');
const API_PORT = Number(process.env.E2E_API_PORT ?? 54321);
const PG_PORT = API_PORT + 1;
const REST_PORT = API_PORT + 2;
const JWT_SECRET = 'e2e-secret-chi-dung-cho-kiem-thu-cuc-bo-0123456789';

// pgcrypto: migration mật khẩu link công khai cần (giống tests/db/harness.ts).
const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(await readFile(join(ROOT, 'tests/db/supabase-shim.sql'), 'utf8'));
for (const file of (await readdir(join(ROOT, 'supabase/migrations'))).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(await readFile(join(ROOT, 'supabase/migrations', file), 'utf8'));
}
// Chỉ có trong môi trường kiểm thử: tạo tài khoản như GoTrue làm.
await db.exec(`
  create schema if not exists e2e;
  create function e2e.create_user(user_email text) returns uuid
  language plpgsql security definer set search_path = '' as
  $$
  declare
    new_id uuid;
  begin
    insert into auth.users (email) values (user_email) returning id into new_id;
    -- Tài khoản kiểm thử dùng được ngay, không chờ duyệt; riêng email bắt đầu bằng "cho-duyet-" giữ trạng thái chờ duyệt (kịch bản trang quản trị).
    update public.account_approvals set approved = true where account_id = new_id and user_email not like 'cho-duyet-%';
    return new_id;
  end;
  $$;
`);

const pgServer = new PGLiteSocketServer({ db, port: PG_PORT, host: '127.0.0.1', maxConnections: 4 });
await pgServer.start();

const postgrest = spawn(join(ROOT, '.tools/postgrest'), [], {
  env: {
    ...process.env,
    PGRST_DB_URI: `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres?sslmode=disable`,
    PGRST_DB_SCHEMAS: 'public',
    PGRST_DB_ANON_ROLE: 'anon',
    PGRST_JWT_SECRET: JWT_SECRET,
    // Mọi kết nối dùng chung một phiên PGlite: một kết nối, không dùng prepared statement.
    PGRST_DB_POOL: '1',
    PGRST_DB_PREPARED_STATEMENTS: 'false',
    PGRST_DB_CHANNEL_ENABLED: 'false',
    PGRST_SERVER_PORT: String(REST_PORT),
    PGRST_SERVER_HOST: '127.0.0.1',
    PGRST_LOG_LEVEL: process.env.E2E_REST_LOG ?? 'error',
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});

// ---------------------------------------------------------------------------
// Auth tối giản
// ---------------------------------------------------------------------------
const base64url = (input) => Buffer.from(input).toString('base64url');
const signJwt = (payload) => {
  const head = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${signature}`;
};
const verifyJwt = (token) => {
  const [head, body, signature] = token.split('.');
  if (!head || !body || !signature) return null;
  if (createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url') !== signature) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  return payload.exp > Date.now() / 1000 ? payload : null;
};

const accounts = new Map(); // email → { id, password, createdAt }
const refreshTokens = new Map(); // token → email

const userObject = (email) => {
  const account = accounts.get(email);
  return {
    id: account.id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: account.createdAt,
    confirmed_at: account.createdAt,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: account.createdAt,
    updated_at: account.createdAt,
  };
};

const sessionFor = (email) => {
  const account = accounts.get(email);
  const now = Math.floor(Date.now() / 1000);
  const refresh = randomUUID();
  refreshTokens.set(refresh, email);
  return {
    access_token: signJwt({ sub: account.id, email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: refresh,
    user: userObject(email),
  };
};

const restCall = (path, body) =>
  new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port: REST_PORT, path, method: 'POST', headers: { 'content-type': 'application/json' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => (res.statusCode < 300 ? resolve(JSON.parse(data)) : reject(new Error(data))));
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });

// Tạo tài khoản qua kết nối của PostgREST (một hàng đợi duy nhất tới PGlite).
const createAccount = async (email, password) => {
  const id = await db.query('select e2e.create_user($1) as id', [email]).then((r) => r.rows[0].id);
  accounts.set(email, { id, password, createdAt: new Date().toISOString() });
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'access-control-expose-headers': 'content-range, content-profile, x-total-count',
};

const json = (res, status, body) => {
  res.writeHead(status, { ...CORS, 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

const authError = (res, status, message) => json(res, status, { code: status, error_code: 'invalid_credentials', msg: message, message });

const handleAuth = async (req, res, url) => {
  const body = req.method === 'POST' ? JSON.parse((await readBody(req)) || '{}') : {};
  const path = url.pathname.replace('/auth/v1', '');
  if (path === '/signup') {
    const email = String(body.email ?? '').toLowerCase();
    if (accounts.has(email)) return authError(res, 422, 'User already registered');
    if (String(body.password ?? '').length < 6) return authError(res, 422, 'Password should be at least 6 characters');
    await createAccount(email, body.password);
    return json(res, 200, sessionFor(email));
  }
  if (path === '/token') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const email = String(body.email ?? '').toLowerCase();
      const account = accounts.get(email);
      if (!account || account.password !== body.password) return authError(res, 400, 'Invalid login credentials');
      return json(res, 200, sessionFor(email));
    }
    if (grant === 'refresh_token') {
      const email = refreshTokens.get(body.refresh_token);
      if (!email) return authError(res, 400, 'Invalid Refresh Token');
      return json(res, 200, sessionFor(email));
    }
  }
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  const claims = verifyJwt(bearer);
  if (path === '/user') return claims ? json(res, 200, userObject(claims.email)) : authError(res, 401, 'invalid JWT');
  if (path === '/logout') return json(res, 204);
  if (path === '/settings') return json(res, 200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: true });
  return authError(res, 404, `Not implemented: ${path}`);
};

const proxyRest = (req, res, url) => {
  const headers = { ...req.headers, host: `127.0.0.1:${REST_PORT}` };
  // Khoá publishable không phải JWT: bỏ đi để PostgREST coi là khách (anon), như Supabase làm.
  const bearer = (headers.authorization ?? '').replace(/^Bearer /, '');
  if (!verifyJwt(bearer)) delete headers.authorization;
  const upstream = httpRequest(
    { host: '127.0.0.1', port: REST_PORT, path: url.pathname.replace('/rest/v1', '') + url.search, method: req.method, headers },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, { ...upstreamRes.headers, ...CORS });
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', (error) => json(res, 502, { message: String(error) }));
  req.pipe(upstream);
};

const api = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${API_PORT}`);
  if (req.method === 'OPTIONS') return json(res, 204);
  if (url.pathname.startsWith('/rest/v1')) return proxyRest(req, res, url);
  if (url.pathname.startsWith('/auth/v1')) return handleAuth(req, res, url).catch((error) => json(res, 500, { message: String(error) }));
  return json(res, 404, { message: 'not found' });
});
api.listen(API_PORT, '127.0.0.1');

// Chờ PostgREST sẵn sàng rồi báo.
for (let attempt = 0; attempt < 100; attempt += 1) {
  const ok = await new Promise((resolve) => {
    const probe = httpRequest({ host: '127.0.0.1', port: REST_PORT, path: '/', method: 'GET' }, (r) => {
      r.resume();
      resolve(r.statusCode === 200);
    });
    probe.on('error', () => resolve(false));
    probe.end();
  });
  if (ok) break;
  await new Promise((r) => setTimeout(r, 200));
}
console.log(`E2E_BACKEND_READY http://127.0.0.1:${API_PORT}`);

const stop = async () => {
  postgrest.kill();
  api.close();
  await pgServer.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
export { restCall };
