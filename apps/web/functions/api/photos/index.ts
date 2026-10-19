/** POST /api/photos — tải ảnh lên Google Drive; DELETE /api/photos?treeId=… — xoá cả thư mục ảnh của gia phả. Xem src/drive/photo-handler.ts. */
import { handleDeleteTree, handleUpload, type PhotoEnv } from '../../../src/drive/photo-handler';

export const onRequestPost = ({ request, env }: { request: Request; env: PhotoEnv }): Promise<Response> => handleUpload(request, env);
export const onRequestDelete = ({ request, env }: { request: Request; env: PhotoEnv }): Promise<Response> => handleDeleteTree(request, env);
