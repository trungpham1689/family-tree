import {
  deleteImage,
  deleteTreeFolder,
  downloadImage,
  DriveError,
  ensureTreeFolders,
  getAccessToken,
  uploadImage,
  type DriveEnv,
} from './drive-api';

/**
 * Logic của /api/photos (Cloudflare Pages Functions): kiểm tra phiên đăng nhập + vai trò bằng chính
 * database Supabase (can_view_tree / can_edit_tree / is_tree_owner chạy dưới quyền người gọi), rồi mới
 * dùng khoá Drive của chủ app. Trình duyệt không bao giờ thấy khoá Drive.
 */

export type PhotoEnv = DriveEnv & { VITE_SUPABASE_URL: string; VITE_SUPABASE_PUBLISHABLE_KEY: string };
export type PhotoKind = 'member' | 'tree';

/** Chặn cứng phía server; trình duyệt đã nén ảnh xuống vài trăm KB nên mức này rất rộng rãi. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DRIVE_ID = /^[\w-]{10,100}$/;

const json = (body: unknown, status: number): Response => Response.json(body, { status });

const bearer = (request: Request): string | null => /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1] ?? null;

const rpcAllowed = async (env: PhotoEnv, jwt: string, fn: 'can_view_tree' | 'can_edit_tree' | 'is_tree_owner', treeId: string, doFetch: typeof fetch) => {
  const response = await doFetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({ target_tree: treeId }),
  });
  if (response.status === 401) return null;
  return response.ok && (await response.json()) === true;
};

const treeName = async (env: PhotoEnv, jwt: string, treeId: string, doFetch: typeof fetch): Promise<string> => {
  const response = await doFetch(`${env.VITE_SUPABASE_URL}/rest/v1/family_trees?id=eq.${treeId}&select=name`, {
    headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${jwt}` },
  });
  const rows = response.ok ? ((await response.json()) as { name: string }[]) : [];
  return rows[0]?.name ?? treeId;
};

/** Trả Response lỗi nếu không đủ quyền, null nếu được phép. */
const authorize = async (
  request: Request,
  env: PhotoEnv,
  treeId: string,
  need: 'can_view_tree' | 'can_edit_tree' | 'is_tree_owner',
  doFetch: typeof fetch,
): Promise<Response | null> => {
  const jwt = bearer(request);
  if (!jwt) return json({ error: 'Cần đăng nhập.' }, 401);
  if (!UUID.test(treeId)) return json({ error: 'Gia phả không hợp lệ.' }, 400);
  const allowed = await rpcAllowed(env, jwt, need, treeId, doFetch);
  if (allowed === null) return json({ error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' }, 401);
  return allowed ? null : json({ error: 'Bạn không có quyền với ảnh của gia phả này.' }, 403);
};

const failure = (error: unknown): Response =>
  error instanceof DriveError ? json({ error: error.message }, error.status) : json({ error: 'Không xử lý được ảnh. Hãy thử lại.' }, 500);

/** POST /api/photos?treeId=…&kind=member|tree[&personId=…] — thân yêu cầu là chính file ảnh. Trả { fileId }. */
export const handleUpload = async (request: Request, env: PhotoEnv, doFetch: typeof fetch = fetch): Promise<Response> => {
  const url = new URL(request.url);
  const treeId = url.searchParams.get('treeId') ?? '';
  const kind = url.searchParams.get('kind');
  const personId = url.searchParams.get('personId');
  if (kind !== 'member' && kind !== 'tree') return json({ error: 'Loại ảnh không hợp lệ.' }, 400);
  if (kind === 'member' && !UUID.test(personId ?? '')) return json({ error: 'Thiếu Người của ảnh.' }, 400);

  // Ảnh Người: Biên tập viên trở lên (như RLS bảng person_photos). Ảnh gia phả: chỉ Chủ sở hữu (như RLS family_trees).
  const denied = await authorize(request, env, treeId, kind === 'tree' ? 'is_tree_owner' : 'can_edit_tree', doFetch);
  if (denied) return denied;

  const mimeType = request.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!IMAGE_TYPES.has(mimeType)) return json({ error: 'Chỉ nhận ảnh JPEG, PNG hoặc WEBP.' }, 415);
  // Từ chối sớm theo Content-Length, đỡ phải đọc cả thân yêu cầu quá khổ vào bộ nhớ.
  if (Number(request.headers.get('content-length')) > MAX_UPLOAD_BYTES) return json({ error: `Ảnh phải nhỏ hơn ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.` }, 413);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    return json({ error: `Ảnh phải nhỏ hơn ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.` }, 413);
  }

  try {
    const token = await getAccessToken(env, doFetch);
    const folders = await ensureTreeFolders(token, treeId, await treeName(env, bearer(request)!, treeId, doFetch), doFetch);
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const fileId = await uploadImage(
      token,
      {
        name: `${kind === 'tree' ? 'gia-pha' : personId}-${crypto.randomUUID()}.${extension}`,
        parent: kind === 'tree' ? folders.treePhotos : folders.memberPhotos,
        treeId,
        mimeType,
        bytes,
      },
      doFetch,
    );
    return json({ fileId }, 201);
  } catch (error) {
    return failure(error);
  }
};

/** GET /api/photos/{fileId}?treeId=… — ảnh gốc từ Drive, chỉ cho người xem được gia phả. */
export const handleDownload = async (request: Request, env: PhotoEnv, fileId: string, doFetch: typeof fetch = fetch): Promise<Response> => {
  const treeId = new URL(request.url).searchParams.get('treeId') ?? '';
  if (!DRIVE_ID.test(fileId)) return json({ error: 'Ảnh không hợp lệ.' }, 400);
  const denied = await authorize(request, env, treeId, 'can_view_tree', doFetch);
  if (denied) return denied;
  try {
    const upstream = await downloadImage(await getAccessToken(env, doFetch), fileId, treeId, doFetch);
    return new Response(upstream.body, {
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'image/jpeg',
        'x-content-type-options': 'nosniff',
        // Mỗi lần đổi ảnh là một file Drive mới (id mới) nên nội dung một id không bao giờ đổi.
        'cache-control': 'private, max-age=86400, immutable',
      },
    });
  } catch (error) {
    return failure(error);
  }
};

/** DELETE /api/photos/{fileId}?treeId=… */
export const handleDelete = async (request: Request, env: PhotoEnv, fileId: string, doFetch: typeof fetch = fetch): Promise<Response> => {
  const treeId = new URL(request.url).searchParams.get('treeId') ?? '';
  if (!DRIVE_ID.test(fileId)) return json({ error: 'Ảnh không hợp lệ.' }, 400);
  const denied = await authorize(request, env, treeId, 'can_edit_tree', doFetch);
  if (denied) return denied;
  try {
    await deleteImage(await getAccessToken(env, doFetch), fileId, treeId, doFetch);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
};

/** DELETE /api/photos?treeId=… — xoá cả thư mục ảnh của gia phả trên Drive; chỉ Chủ sở hữu (dùng khi xoá gia phả). */
export const handleDeleteTree = async (request: Request, env: PhotoEnv, doFetch: typeof fetch = fetch): Promise<Response> => {
  const treeId = new URL(request.url).searchParams.get('treeId') ?? '';
  const denied = await authorize(request, env, treeId, 'is_tree_owner', doFetch);
  if (denied) return denied;
  try {
    await deleteTreeFolder(await getAccessToken(env, doFetch), treeId, doFetch);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
};
