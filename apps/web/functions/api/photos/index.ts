/** POST /api/photos — tải ảnh lên Google Drive. Xem src/drive/photo-handler.ts. */
import { handleUpload, type PhotoEnv } from '../../../src/drive/photo-handler';

export const onRequestPost = ({ request, env }: { request: Request; env: PhotoEnv }): Promise<Response> => handleUpload(request, env);
