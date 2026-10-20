/** POST /api/invite-email — gửi email mời cho lời mời chờ đăng ký (chỉ Chủ sở hữu). Xem src/invite/invite-email.ts. */
import { handleInviteEmail, type InviteEmailEnv } from '../../src/invite/invite-email';

export const onRequestPost = ({ request, env }: { request: Request; env: InviteEmailEnv }): Promise<Response> => handleInviteEmail(request, env);
