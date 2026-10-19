import { EdgeError, supabaseRest, type EdgeEnv, type SupabaseRest } from '../edge/supabase-rest';
import {
  deleteFileById,
  deleteImage,
  deleteTreeFolder,
  downloadImage,
  DriveError,
  ensureTreeFolders,
  getAccessToken,
  listTreeFileIds,
  uploadImage,
  type DriveEnv,
} from './drive-api';

/**
 * Logic của /api/photos (Cloudflare Pages Functions): kiểm tra phiên đăng nhập + vai trò bằng chính
 * database Supabase (can_view_tree / can_edit_tree / is_tree_owner chạy dưới quyền người gọi), rồi mới
 * dùng khoá Drive của chủ app. Trình duyệt không bao giờ thấy khoá Drive.
 */

export type PhotoEnv = DriveEnv & EdgeEnv;
export type PhotoKind = 'member' | 'tree';

/** Chặn cứng phía server; trình duyệt đã nén ảnh xuống vài trăm KB nên mức này rất rộng rãi. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DRIVE_ID = /^[\w-]{10,100}$/;

const json = (body: unknown, status: number): Response => Response.json(body, { status });

const bearer = (request: Request): string | null => /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1] ?? null;

type Rule = { fn: 'can_view_tree' | 'can_edit_tree' | 'is_tree_owner' | 'can_edit_person'; args: Record<string, string> };

const treeRule = (fn: 'can_view_tree' | 'can_edit_tree' | 'is_tree_owner', treeId: string): Rule => ({ fn, args: { target_tree: treeId } });

const restOf = (env: PhotoEnv, doFetch: typeof fetch): SupabaseRest => {
  const rest = supabaseRest(env, doFetch);
  if (!rest) throw new EdgeError(500, 'Máy chủ chưa cấu hình Supabase.');
  return rest;
};

const rpcAllowed = async (rest: SupabaseRest, jwt: string, rule: Rule): Promise<boolean | null> => {
  const { unauthorized, data } = await rest.rpc<boolean>(rule.fn, rule.args, jwt);
  return unauthorized ? null : data === true;
};

const treeName = async (rest: SupabaseRest, jwt: string, treeId: string): Promise<string> =>
  (await rest.rows<{ name: string }>(`family_trees?id=eq.${treeId}&select=name`, jwt))[0]?.name ?? treeId;

/**
 * Quy tắc xoá một file ảnh, đúng như RLS của dòng dữ liệu trỏ tới file đó:
 * ảnh của Người → `can_edit_person`; ảnh bìa gia phả → Chủ sở hữu; chưa có dòng nào (file mồ côi vừa tải lên,
 * trình duyệt đang dọn sau khi lưu dòng lỗi) → Biên tập viên của gia phả.
 */
const deletionRule = async (rest: SupabaseRest, jwt: string, treeId: string, fileId: string): Promise<Rule> => {
  const path = encodeURIComponent(`${treeId}/${fileId}`);
  const [photo] = await rest.rows<{ person_id: string }>(`person_photos?storage_path=eq.${path}&select=person_id`, jwt);
  if (photo) return { fn: 'can_edit_person', args: { target_person: photo.person_id } };
  const cover = await rest.rows<{ id: string }>(`family_trees?id=eq.${treeId}&photo_path=eq.${path}&select=id`, jwt);
  return treeRule(cover.length > 0 ? 'is_tree_owner' : 'can_edit_tree', treeId);
};

/**
 * Trả Response lỗi nếu không đủ quyền, null nếu được phép. `rule` có thể là hàm để tra thêm dữ liệu sau khi biết người gọi.
 * Tra cứu quyền lỗi (Supabase không trả lời) thì từ chối bằng 502, không bao giờ "coi như được phép".
 */
const authorize = async (
  request: Request,
  env: PhotoEnv,
  treeId: string,
  rule: Rule | ((jwt: string, rest: SupabaseRest) => Promise<Rule | Response>),
  doFetch: typeof fetch,
): Promise<Response | null> => {
  const jwt = bearer(request);
  if (!jwt) return json({ error: 'Cần đăng nhập.' }, 401);
  if (!UUID.test(treeId)) return json({ error: 'Gia phả không hợp lệ.' }, 400);
  try {
    const rest = restOf(env, doFetch);
    const resolved = typeof rule === 'function' ? await rule(jwt, rest) : rule;
    if (resolved instanceof Response) return resolved;
    const allowed = await rpcAllowed(rest, jwt, resolved);
    if (allowed === null) return json({ error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' }, 401);
    return allowed ? null : json({ error: 'Bạn không có quyền với ảnh này.' }, 403);
  } catch (error) {
    return failure(error);
  }
};

const failure = (error: unknown): Response =>
  error instanceof DriveError || error instanceof EdgeError
    ? json({ error: error.message }, error.status)
    : json({ error: 'Không xử lý được ảnh. Hãy thử lại.' }, 500);

/** POST /api/photos?treeId=…&kind=member|tree[&personId=…] — thân yêu cầu là chính file ảnh. Trả { fileId }. */
export const handleUpload = async (request: Request, env: PhotoEnv, doFetch: typeof fetch = fetch): Promise<Response> => {
  const url = new URL(request.url);
  const treeId = url.searchParams.get('treeId') ?? '';
  const kind = url.searchParams.get('kind');
  const personId = url.searchParams.get('personId');
  if (kind !== 'member' && kind !== 'tree') return json({ error: 'Loại ảnh không hợp lệ.' }, 400);
  if (kind === 'member' && !UUID.test(personId ?? '')) return json({ error: 'Thiếu Người của ảnh.' }, 400);

  // Ảnh Người: Chủ sở hữu hoặc Biên tập viên đã tạo Người đó (như RLS bảng person_photos). Ảnh gia phả: chỉ Chủ sở hữu (như RLS family_trees).
  const denied = await authorize(
    request,
    env,
    treeId,
    kind === 'tree'
      ? treeRule('is_tree_owner', treeId)
      : async (jwt, rest) => {
          const [person] = await rest.rows<{ tree_id: string }>(`persons?id=eq.${personId}&select=tree_id`, jwt);
          // Người phải thuộc đúng gia phả của thư mục sẽ nhận file.
          return person?.tree_id === treeId ? { fn: 'can_edit_person', args: { target_person: personId! } } : json({ error: 'Không tìm thấy Người trong gia phả này.' }, 404);
        },
    doFetch,
  );
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
    const folders = await ensureTreeFolders(token, treeId, await treeName(restOf(env, doFetch), bearer(request)!, treeId), doFetch);
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
  const denied = await authorize(request, env, treeId, treeRule('can_view_tree', treeId), doFetch);
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
  const denied = await authorize(request, env, treeId, (jwt, rest) => deletionRule(rest, jwt, treeId, fileId), doFetch);
  if (denied) return denied;
  try {
    await deleteImage(await getAccessToken(env, doFetch), fileId, treeId, doFetch);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
};

/**
 * DELETE /api/photos?treeId=… — Chủ sở hữu xoá gia phả. Database quyết định trước (xoá dòng bằng quyền người gọi, RLS áp dụng),
 * chỉ khi xoá được mới dọn thư mục ảnh trên Drive; nhờ vậy không bao giờ mất ảnh mà gia phả vẫn còn.
 */
export const handleDeleteTree = async (request: Request, env: PhotoEnv, doFetch: typeof fetch = fetch): Promise<Response> => {
  const treeId = new URL(request.url).searchParams.get('treeId') ?? '';
  const denied = await authorize(request, env, treeId, treeRule('is_tree_owner', treeId), doFetch);
  if (denied) return denied;

  try {
    const removed = await restOf(env, doFetch).remove<unknown>(`family_trees?id=eq.${treeId}`, bearer(request)!);
    if (removed.length === 0) return json({ error: 'Không xoá được gia phả.' }, 404);
  } catch (error) {
    return failure(error);
  }

  try {
    await deleteTreeFolder(await getAccessToken(env, doFetch), treeId, doFetch);
  } catch (error) {
    // Gia phả đã xoá; thư mục ảnh còn lại chỉ là rác trên Drive, không chặn người dùng.
    console.error('Không xoá được thư mục Drive của gia phả', treeId, error);
  }
  return new Response(null, { status: 204 });
};

/**
 * POST /api/photos/sweep?treeId=… — Chủ sở hữu dọn ảnh mồ côi: file của gia phả trên Drive không còn dòng nào trỏ tới
 * (sót lại khi xoá file lỗi, hoặc ảnh dư khi gộp người trùng). Trả { deleted }.
 */
export const handleSweep = async (request: Request, env: PhotoEnv, doFetch: typeof fetch = fetch): Promise<Response> => {
  const treeId = new URL(request.url).searchParams.get('treeId') ?? '';
  const denied = await authorize(request, env, treeId, treeRule('is_tree_owner', treeId), doFetch);
  if (denied) return denied;
  const jwt = bearer(request)!;
  try {
    const rest = restOf(env, doFetch);
    const referenced = new Set([
      ...(await rest.all<{ storage_path: string }>(`person_photos?tree_id=eq.${treeId}&select=storage_path&order=id`, jwt)).map((row) => row.storage_path),
      ...(await rest.all<{ photo_path: string | null }>(`family_trees?id=eq.${treeId}&select=photo_path`, jwt)).flatMap((row) => (row.photo_path ? [row.photo_path] : [])),
    ]);
    const token = await getAccessToken(env, doFetch);
    const orphans = (await listTreeFileIds(token, treeId, doFetch)).filter((fileId) => !referenced.has(`${treeId}/${fileId}`));
    for (const fileId of orphans) await deleteFileById(token, fileId, doFetch);
    return json({ deleted: orphans.length }, 200);
  } catch (error) {
    return failure(error);
  }
};
