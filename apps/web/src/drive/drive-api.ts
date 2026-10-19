/**
 * Google Drive tối thiểu cho ảnh: tìm/tạo thư mục, tải lên, tải xuống, xoá. Chỉ dùng `fetch`,
 * chạy được trong Cloudflare Pages Function. Quyền `drive.file`: app chỉ thấy file do chính nó tạo.
 *
 * Cấu trúc: Family-tree / {tên gia phả} / Ảnh Gia Phả + Ảnh Thành Viên. Thư mục tìm theo appProperties
 * (treeId, role) chứ không theo tên, nên đổi tên gia phả hay thư mục không làm mất ảnh.
 */

export type DriveEnv = { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string; GOOGLE_REFRESH_TOKEN: string };
export type FolderRole = 'root' | 'tree' | 'tree-photos' | 'member-photos';
export type TreeFolders = { treePhotos: string; memberPhotos: string };

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const FOLDER_NAMES = { root: 'Family-tree', 'tree-photos': 'Ảnh Gia Phả', 'member-photos': 'Ảnh Thành Viên' } as const;

type Fetch = typeof fetch;

export class DriveError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const check = async (response: Response, what: string): Promise<Response> => {
  if (!response.ok) throw new DriveError(response.status === 404 ? 404 : 502, `Google Drive lỗi khi ${what} (${response.status}).`);
  return response;
};

export const getAccessToken = async (env: DriveEnv, doFetch: Fetch = fetch): Promise<string> => {
  const response = await doFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  await check(response, 'đăng nhập');
  return ((await response.json()) as { access_token: string }).access_token;
};

type DriveFile = { id: string; appProperties?: Record<string, string> };

const authed = (token: string, init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${token}` },
});

const findFolder = async (token: string, role: FolderRole, treeId: string | null, doFetch: Fetch): Promise<string | null> => {
  const conditions = [`mimeType='${FOLDER_MIME}'`, 'trashed=false', `appProperties has { key='role' and value='${role}' }`];
  if (treeId) conditions.push(`appProperties has { key='treeId' and value='${treeId}' }`);
  const url = `${API}/files?${new URLSearchParams({ q: conditions.join(' and '), fields: 'files(id)', orderBy: 'createdTime', pageSize: '1' })}`;
  const { files } = (await (await check(await doFetch(url, authed(token)), 'tìm thư mục')).json()) as { files: DriveFile[] };
  return files[0]?.id ?? null;
};

const createFolder = async (
  token: string,
  input: { name: string; parent: string | null; role: FolderRole; treeId: string | null },
  doFetch: Fetch,
): Promise<string> => {
  const appProperties: Record<string, string> = { role: input.role };
  if (input.treeId) appProperties.treeId = input.treeId;
  const response = await doFetch(
    `${API}/files?fields=id`,
    authed(token, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: input.name, mimeType: FOLDER_MIME, parents: input.parent ? [input.parent] : undefined, appProperties }),
    }),
  );
  return ((await (await check(response, 'tạo thư mục')).json()) as DriveFile).id;
};

/** Tìm thư mục, chưa có thì tạo. Hai lần tải đầu chạy song song có thể tạo trùng; lần tìm sau luôn lấy thư mục cũ nhất. */
const ensureFolder = async (
  token: string,
  input: { name: string; parent: string | null; role: FolderRole; treeId: string | null },
  doFetch: Fetch,
): Promise<string> => (await findFolder(token, input.role, input.treeId, doFetch)) ?? createFolder(token, input, doFetch);

/** Đảm bảo có Gia Phả/{treeName}/Ảnh Gia Phả và /Ảnh Thành Viên, trả id hai thư mục ảnh. */
export const ensureTreeFolders = async (token: string, treeId: string, treeName: string, doFetch: Fetch = fetch): Promise<TreeFolders> => {
  const root = await ensureFolder(token, { name: FOLDER_NAMES.root, parent: null, role: 'root', treeId: null }, doFetch);
  const tree = await ensureFolder(token, { name: treeName, parent: root, role: 'tree', treeId }, doFetch);
  const [treePhotos, memberPhotos] = await Promise.all(
    (['tree-photos', 'member-photos'] as const).map((role) =>
      ensureFolder(token, { name: FOLDER_NAMES[role], parent: tree, role, treeId }, doFetch),
    ),
  );
  return { treePhotos: treePhotos!, memberPhotos: memberPhotos! };
};

/** Tải ảnh lên thư mục; gắn treeId vào file để kiểm quyền khi đọc/xoá. Trả id file Drive. */
export const uploadImage = async (
  token: string,
  input: { name: string; parent: string; treeId: string; mimeType: string; bytes: ArrayBuffer },
  doFetch: Fetch = fetch,
): Promise<string> => {
  const boundary = `gia-pha-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: input.name, parents: [input.parent], appProperties: { treeId: input.treeId } });
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + input.bytes.byteLength + tail.length);
  body.set(head, 0);
  body.set(new Uint8Array(input.bytes), head.length);
  body.set(tail, head.length + input.bytes.byteLength);

  const response = await doFetch(
    `${UPLOAD}/files?uploadType=multipart&fields=id`,
    authed(token, { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body }),
  );
  return ((await (await check(response, 'tải ảnh lên')).json()) as DriveFile).id;
};

/** File phải thuộc đúng gia phả đó, kẻo biết id file của họ khác là đọc/xoá được. */
const assertInTree = async (token: string, fileId: string, treeId: string, doFetch: Fetch): Promise<void> => {
  const response = await doFetch(`${API}/files/${encodeURIComponent(fileId)}?fields=appProperties`, authed(token));
  const file = (await (await check(response, 'đọc thông tin ảnh')).json()) as DriveFile;
  if (file.appProperties?.treeId !== treeId) throw new DriveError(404, 'Không tìm thấy ảnh.');
};

export const downloadImage = async (token: string, fileId: string, treeId: string, doFetch: Fetch = fetch): Promise<Response> => {
  await assertInTree(token, fileId, treeId, doFetch);
  return check(await doFetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`, authed(token)), 'tải ảnh xuống');
};

export const deleteImage = async (token: string, fileId: string, treeId: string, doFetch: Fetch = fetch): Promise<void> => {
  await assertInTree(token, fileId, treeId, doFetch);
  const response = await doFetch(`${API}/files/${encodeURIComponent(fileId)}`, authed(token, { method: 'DELETE' }));
  await check(response, 'xoá ảnh');
};
