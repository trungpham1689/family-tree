import { describe, expect, it } from 'vitest';
import { handleDelete, handleDeleteTree, handleDownload, handleUpload, type PhotoEnv } from './photo-handler';

const TREE = '11111111-1111-1111-1111-111111111111';
const PERSON = '22222222-2222-2222-2222-222222222222';
const env: PhotoEnv = {
  VITE_SUPABASE_URL: 'https://db.test',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'pk',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_REFRESH_TOKEN: 'refresh',
};

type Call = { url: string; method: string };

/** Giả Supabase + Drive: `roles` là các hàm vai trò trả true; Drive giữ thư mục/file trong bộ nhớ. */
const fakeServer = (options: { allow?: string[]; fileTree?: string } = {}) => {
  const allow = new Set(options.allow ?? []);
  const calls: Call[] = [];
  let folderCount = 0;
  const folders: { id: string; role: string }[] = [];
  const doFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    const json = (body: unknown, status = 200) => Response.json(body, { status });
    if (url.startsWith('https://db.test/rest/v1/rpc/')) {
      const fn = url.split('/').pop()!;
      const authorization = (init?.headers as Record<string, string> | undefined)?.authorization;
      return authorization === 'Bearer bad' ? json({}, 401) : json(allow.has(fn));
    }
    if (url.startsWith('https://db.test/rest/v1/family_trees')) return json([{ name: 'Họ Phạm' }]);
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'drive-token' });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?q=')) {
      const role = /value='(root|tree|tree-photos|member-photos)'/.exec(decodeURIComponent(url.replace(/\+/g, ' ')))![1]!;
      return json({ files: folders.filter((folder) => folder.role === role).map(({ id }) => ({ id })) });
    }
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?fields=id') && method === 'POST') {
      const body = JSON.parse(init!.body as string) as { appProperties: { role: string } };
      folders.push({ id: `folder-${++folderCount}`, role: body.appProperties.role });
      return json({ id: `folder-${folderCount}` });
    }
    if (url.includes('/upload/drive/v3/files')) return json({ id: 'driveFileId123' });
    if (url.includes('fields=appProperties')) return json({ appProperties: { treeId: options.fileTree ?? TREE } });
    if (url.includes('alt=media')) return new Response('bytes', { headers: { 'content-type': 'image/jpeg' } });
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return json({}, 500);
  }) as typeof fetch;
  return { doFetch, calls, folders };
};

const MEMBER_QUERY_FOR_TREE = `treeId=${TREE}&kind=member&personId=${PERSON}`;

const upload = (query: string, headers: Record<string, string> = {}, body: BodyInit = new Uint8Array([1, 2, 3])) =>
  new Request(`https://app.test/api/photos?${query}`, {
    method: 'POST',
    headers: { authorization: 'Bearer user', 'content-type': 'image/jpeg', ...headers },
    body,
  });

describe('/api/photos', () => {
  it('Biên tập viên tải ảnh Người: tạo Family-tree/{tên}/Ảnh Gia Phả + Ảnh Người rồi trả id file', async () => {
    const server = fakeServer({ allow: ['can_edit_tree'] });
    const response = await handleUpload(upload(`treeId=${TREE}&kind=member&personId=${PERSON}`), env, server.doFetch);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ fileId: 'driveFileId123' });
    expect(server.folders.map((folder) => folder.role).sort()).toEqual(['member-photos', 'root', 'tree', 'tree-photos']);
  });

  it('lần tải thứ hai dùng lại thư mục, không tạo thêm', async () => {
    const server = fakeServer({ allow: ['can_edit_tree'] });
    await handleUpload(upload(`treeId=${TREE}&kind=member&personId=${PERSON}`), env, server.doFetch);
    await handleUpload(upload(`treeId=${TREE}&kind=member&personId=${PERSON}`), env, server.doFetch);
    expect(server.folders).toHaveLength(4);
  });

  it('không đăng nhập hoặc phiên hết hạn: 401; không đủ vai trò: 403', async () => {
    const server = fakeServer();
    const anonymous = new Request(`https://app.test/api/photos?treeId=${TREE}&kind=member&personId=${PERSON}`, { method: 'POST' });
    expect((await handleUpload(anonymous, env, server.doFetch)).status).toBe(401);
    expect((await handleUpload(upload(`treeId=${TREE}&kind=member&personId=${PERSON}`, { authorization: 'Bearer bad' }), env, server.doFetch)).status).toBe(401);
    expect((await handleUpload(upload(`treeId=${TREE}&kind=member&personId=${PERSON}`), env, server.doFetch)).status).toBe(403);
    expect(server.calls.some((call) => call.url.includes('googleapis'))).toBe(false);
  });

  it('ảnh gia phả chỉ Chủ sở hữu; Biên tập viên bị từ chối', async () => {
    const editor = fakeServer({ allow: ['can_edit_tree'] });
    expect((await handleUpload(upload(`treeId=${TREE}&kind=tree`), env, editor.doFetch)).status).toBe(403);
    const owner = fakeServer({ allow: ['is_tree_owner'] });
    expect((await handleUpload(upload(`treeId=${TREE}&kind=tree`), env, owner.doFetch)).status).toBe(201);
  });

  it('từ chối loại file lạ và ảnh quá lớn', async () => {
    const server = fakeServer({ allow: ['can_edit_tree'] });
    const query = `treeId=${TREE}&kind=member&personId=${PERSON}`;
    expect((await handleUpload(upload(query, { 'content-type': 'application/pdf' }), env, server.doFetch)).status).toBe(415);
    expect((await handleUpload(upload(query, {}, new Uint8Array(5 * 1024 * 1024)), env, server.doFetch)).status).toBe(413);
  });

  it('Content-Length quá lớn bị từ chối trước khi đọc thân yêu cầu', async () => {
    const server = fakeServer({ allow: ['can_edit_tree'] });
    const response = await handleUpload(upload(`treeId=${TREE}&kind=member&personId=${PERSON}`, { 'content-length': String(50 * 1024 * 1024) }), env, server.doFetch);
    expect(response.status).toBe(413);
    expect(server.calls.some((call) => call.url.includes('googleapis'))).toBe(false);
  });

  it('chỉ người xem được gia phả mới đọc ảnh; ảnh của gia phả khác bị chặn', async () => {
    const request = () => new Request(`https://app.test/api/photos/driveFileId123?treeId=${TREE}`, { headers: { authorization: 'Bearer user' } });
    expect((await handleDownload(request(), env, 'driveFileId123', fakeServer().doFetch)).status).toBe(403);
    const ok = await handleDownload(request(), env, 'driveFileId123', fakeServer({ allow: ['can_view_tree'] }).doFetch);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
    const foreign = fakeServer({ allow: ['can_view_tree'], fileTree: '33333333-3333-3333-3333-333333333333' });
    expect((await handleDownload(request(), env, 'driveFileId123', foreign.doFetch)).status).toBe(404);
  });

  it('xoá cần quyền sửa và đúng gia phả', async () => {
    const request = () => new Request(`https://app.test/api/photos/driveFileId123?treeId=${TREE}`, { method: 'DELETE', headers: { authorization: 'Bearer user' } });
    expect((await handleDelete(request(), env, 'driveFileId123', fakeServer({ allow: ['can_view_tree'] }).doFetch)).status).toBe(403);
    expect((await handleDelete(request(), env, 'driveFileId123', fakeServer({ allow: ['can_edit_tree'] }).doFetch)).status).toBe(204);
  });

  it('xoá ảnh gọi Drive xoá file thật (DELETE files/{id})', async () => {
    const server = fakeServer({ allow: ['can_edit_tree'] });
    const request = new Request(`https://app.test/api/photos/driveFileId123?treeId=${TREE}`, { method: 'DELETE', headers: { authorization: 'Bearer user' } });
    expect((await handleDelete(request, env, 'driveFileId123', server.doFetch)).status).toBe(204);
    expect(server.calls).toContainEqual({ url: 'https://www.googleapis.com/drive/v3/files/driveFileId123', method: 'DELETE' });
  });

  it('xoá gia phả: chỉ Chủ sở hữu, xoá cả thư mục gia phả trên Drive', async () => {
    const request = () => new Request(`https://app.test/api/photos?treeId=${TREE}`, { method: 'DELETE', headers: { authorization: 'Bearer user' } });
    expect((await handleDeleteTree(request(), env, fakeServer({ allow: ['can_edit_tree'] }).doFetch)).status).toBe(403);

    const server = fakeServer({ allow: ['is_tree_owner', 'can_edit_tree'] });
    await handleUpload(upload(MEMBER_QUERY_FOR_TREE), env, server.doFetch); // tạo thư mục
    const response = await handleDeleteTree(request(), env, server.doFetch);
    expect(response.status).toBe(204);
    expect(server.calls.filter((call) => call.method === 'DELETE' && call.url.includes('/files/folder-'))).toHaveLength(1);
  });
});
