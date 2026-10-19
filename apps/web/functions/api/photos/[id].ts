/** GET/DELETE /api/photos/{fileId} — đọc hoặc xoá ảnh trên Google Drive. Xem src/drive/photo-handler.ts. */
import { handleDelete, handleDownload, type PhotoEnv } from '../../../src/drive/photo-handler';

type Context = { request: Request; env: PhotoEnv; params: { id?: string } };

export const onRequestGet = ({ request, env, params }: Context): Promise<Response> => handleDownload(request, env, params.id ?? '');
export const onRequestDelete = ({ request, env, params }: Context): Promise<Response> => handleDelete(request, env, params.id ?? '');
