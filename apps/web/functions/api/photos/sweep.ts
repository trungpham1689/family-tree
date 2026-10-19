/** POST /api/photos/sweep?treeId=… — dọn ảnh mồ côi của gia phả trên Drive. Xem src/drive/photo-handler.ts. */
import { handleSweep, type PhotoEnv } from '../../../src/drive/photo-handler';

export const onRequestPost = ({ request, env }: { request: Request; env: PhotoEnv }): Promise<Response> => handleSweep(request, env);
