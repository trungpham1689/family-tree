import { resendSender, SendError } from '../../../worker/src/send.ts';
import { EdgeError, supabaseRest, type EdgeEnv, type SupabaseRest } from '../edge/supabase-rest';

/**
 * Logic của /api/invite-email (Cloudflare Pages Function): gửi email mời cho một lời mời ĐANG CHỜ đăng ký.
 * Chỉ Chủ sở hữu gọi được, chỉ gửi tới email đã có lời mời chờ trong gia phả đó (không dùng làm cổng gửi thư tuỳ ý), và có chống gửi dồn
 * (claim_invitation_email). Khoá Resend nằm phía server.
 */
export type InviteEmailEnv = EdgeEnv & { RESEND_API_KEY?: string; RESEND_FROM?: string };

const DEFAULT_FROM = 'Gia Phả <onboarding@resend.dev>';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ROLE_LABELS: Record<string, string> = { editor: 'Biên tập viên', viewer: 'Người xem' };

const json = (body: unknown, status: number): Response => Response.json(body, { status });
const bearer = (request: Request): string | null => /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1] ?? null;
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Mã tài khoản trong JWT (chỉ để tra tên người mời; mọi truy vấn vẫn chạy dưới quyền người gọi nên RLS quyết định). */
const subjectOf = (jwt: string): string | null => {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown };
    return typeof payload.sub === 'string' && UUID.test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
};

export const renderInvite = (input: { inviter: string; treeName: string; role: string; signUpUrl: string }) => {
  const who = input.inviter || 'Chủ sở hữu gia phả';
  const roleLabel = ROLE_LABELS[input.role] ?? input.role;
  const subject = `${who} mời bạn tham gia gia phả ${input.treeName}`;
  const steps = 'Hãy tạo tài khoản bằng ĐÚNG địa chỉ email này. Khi tài khoản được duyệt, bạn đăng nhập là thấy gia phả — không cần được mời lại.';
  const text = [`${who} mời bạn làm ${roleLabel} của gia phả "${input.treeName}" trên Gia Phả.`, '', steps, '', `Tạo tài khoản: ${input.signUpUrl}`].join('\n');
  const html =
    `<!doctype html><html lang="vi"><body style="margin:0;padding:0;background:#f6f1e7;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    `<tr><td style="background:#8a1c1c;border-radius:12px 12px 0 0;padding:20px 24px;color:#ffffff;">` +
    `<div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.85;">Gia Phả</div>` +
    `<div style="font-size:22px;font-weight:700;margin-top:4px;">${escapeHtml(input.treeName)}</div></td></tr>` +
    `<tr><td style="background:#faf7f0;padding:24px;border-radius:0 0 12px 12px;color:#1f1b16;font-size:16px;line-height:1.5;">` +
    `<p style="margin:0 0 12px;"><strong>${escapeHtml(who)}</strong> mời bạn làm <strong>${escapeHtml(roleLabel)}</strong> của gia phả này.</p>` +
    `<p style="margin:0 0 20px;">${escapeHtml(steps)}</p>` +
    `<p style="text-align:center;margin:0;"><a href="${escapeHtml(input.signUpUrl)}" style="display:inline-block;background:#8a1c1c;color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;padding:10px 20px;">Tạo tài khoản</a></p>` +
    `</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
};

type Pending = { email: string; role: string };

export const handleInviteEmail = async (request: Request, env: InviteEmailEnv, doFetch: typeof fetch = fetch): Promise<Response> => {
  const jwt = bearer(request);
  if (!jwt) return json({ error: 'Cần đăng nhập.' }, 401);
  const body = (await request.json().catch(() => null)) as { treeId?: unknown; email?: unknown } | null;
  const treeId = typeof body?.treeId === 'string' ? body.treeId : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!UUID.test(treeId) || !EMAIL.test(email) || email.length > 254) return json({ error: 'Thông tin không hợp lệ.' }, 400);
  if (!env.RESEND_API_KEY) return json({ error: 'Máy chủ chưa cấu hình gửi email.' }, 503);
  const rest: SupabaseRest | null = supabaseRest(env, doFetch);
  if (!rest) return json({ error: 'Máy chủ chưa cấu hình Supabase.' }, 500);

  try {
    const owner = await rest.rpc<boolean>('is_tree_owner', { target_tree: treeId }, jwt);
    if (owner.unauthorized) return json({ error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' }, 401);
    if (owner.data !== true) return json({ error: 'Chỉ Chủ sở hữu gia phả mới gửi được email mời.' }, 403);

    const pending = (await rest.rpc<Pending[]>('list_tree_invitations', { target_tree: treeId }, jwt)).data ?? [];
    const invitation = pending.find((row) => row.email === email);
    if (!invitation) return json({ error: 'Không có lời mời chờ đăng ký cho email này.' }, 404);

    const claimed = await rest.rpc<boolean>('claim_invitation_email', { target_tree: treeId, invite_email: email }, jwt);
    if (claimed.data !== true) return json({ error: 'Vừa gửi email cho địa chỉ này. Hãy chờ khoảng 1 phút rồi gửi lại.' }, 429);

    const [tree] = await rest.rows<{ name: string }>(`family_trees?id=eq.${treeId}&select=name`, jwt);
    const account = subjectOf(jwt);
    const inviter = account ? ((await rest.rows<{ full_name: string | null }>(`account_approvals?account_id=eq.${account}&select=full_name`, jwt).catch(() => []))[0]?.full_name ?? '') : '';
    const { subject, html, text } = renderInvite({
      inviter,
      treeName: tree?.name ?? 'Gia Phả',
      role: invitation.role,
      signUpUrl: `${new URL(request.url).origin}/dang-nhap`,
    });

    try {
      await resendSender({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM || DEFAULT_FROM }, doFetch)([email], subject, html, text, `invite-${crypto.randomUUID()}`);
    } catch (error) {
      await rest.rpc('release_invitation_email', { target_tree: treeId, invite_email: email }, jwt).catch(() => undefined);
      const status = error instanceof SendError ? error.status : 0;
      const hint =
        status === 403 || status === 422
          ? 'Resend từ chối địa chỉ này. Gói thử của Resend (onboarding@resend.dev) chỉ gửi được tới email chủ tài khoản Resend; muốn gửi cho người khác cần xác minh tên miền riêng trên Resend.'
          : 'Không gửi được email. Lời mời vẫn được lưu; hãy thử gửi lại sau.';
      return json({ error: hint }, 502);
    }
    return json({ ok: true }, 200);
  } catch (error) {
    if (error instanceof EdgeError) return json({ error: 'Không kết nối được máy chủ dữ liệu. Hãy thử lại.' }, error.status);
    throw error;
  }
};
