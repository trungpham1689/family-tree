import { describe, expect, it } from 'vitest';
import { handleInviteEmail, renderInvite, type InviteEmailEnv } from './invite-email';

const TREE = '11111111-1111-4111-8111-111111111111';
const ACCOUNT = '22222222-2222-4222-8222-222222222222';
const jwt = `h.${btoa(JSON.stringify({ sub: ACCOUNT })).replace(/=+$/, '')}.s`;
const env: InviteEmailEnv = { VITE_SUPABASE_URL: 'https://db.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'pk', RESEND_API_KEY: 're_test', RESEND_FROM: 'Gia Phả <moi@example.com>' };

type Script = { owner?: boolean; pending?: { email: string; role: string }[]; claim?: boolean; resendStatus?: number; unauthorized?: boolean };

/** Supabase + Resend giả; ghi lại các lệnh gọi để kiểm tra thứ tự và nội dung. */
const world = (script: Script = {}) => {
  const calls: string[] = [];
  let sent: { to: string[]; subject: string; html: string } | null = null;
  const doFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push(url.replace('https://db.test/rest/v1/', '').split('?')[0]!);
    if (url === 'https://api.resend.com/emails') {
      if ((script.resendStatus ?? 200) !== 200) return new Response('từ chối', { status: script.resendStatus });
      sent = JSON.parse(String(init?.body));
      return Response.json({ id: 'x' });
    }
    if (script.unauthorized && url.includes('/rpc/')) return new Response('', { status: 401 });
    if (url.endsWith('/rpc/is_tree_owner')) return Response.json(script.owner ?? true);
    if (url.endsWith('/rpc/list_tree_invitations')) return Response.json(script.pending ?? [{ email: 'moi@example.com', role: 'editor' }]);
    if (url.endsWith('/rpc/claim_invitation_email')) return Response.json(script.claim ?? true);
    if (url.endsWith('/rpc/release_invitation_email')) return Response.json(null);
    if (url.includes('family_trees')) return Response.json([{ name: 'Họ <Phạm>' }]);
    if (url.includes('account_approvals')) return Response.json([{ full_name: 'Phạm Chủ' }]);
    return new Response('?', { status: 500 });
  };
  return { doFetch, calls, sent: () => sent };
};

const post = (body: unknown, token: string | null = jwt) =>
  new Request('https://app.test/api/invite-email', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) });
const valid = { treeId: TREE, email: ' Moi@Example.com ' };

describe('Pages Function gửi email mời', () => {
  it('Chủ sở hữu + có lời mời chờ: gửi đúng một email tới địa chỉ đó, nội dung có tên người mời, tên gia phả (đã thoát HTML), vai trò và link đăng ký', async () => {
    const w = world();
    const response = await handleInviteEmail(post(valid), env, w.doFetch);
    expect(response.status).toBe(200);
    expect(w.sent()?.to).toEqual(['moi@example.com']);
    expect(w.sent()?.subject).toBe('Phạm Chủ mời bạn tham gia gia phả Họ <Phạm>');
    expect(w.sent()?.html).toContain('Họ &lt;Phạm&gt;');
    expect(w.sent()?.html).toContain('Biên tập viên');
    expect(w.sent()?.html).toContain('https://app.test/dang-nhap');
    expect(w.calls).toEqual(['rpc/is_tree_owner', 'rpc/list_tree_invitations', 'rpc/claim_invitation_email', 'family_trees', 'account_approvals', 'https://api.resend.com/emails']);
  });

  it('chưa đăng nhập: 401; không phải Chủ sở hữu: 403, không gửi; dữ liệu sai: 400; thiếu khoá Resend: 503', async () => {
    const w = world({ owner: false });
    expect((await handleInviteEmail(post(valid, null), env, w.doFetch)).status).toBe(401);
    expect((await handleInviteEmail(post(valid), env, w.doFetch)).status).toBe(403);
    expect((await handleInviteEmail(post({ treeId: 'x', email: 'a@b.co' }), env, w.doFetch)).status).toBe(400);
    expect((await handleInviteEmail(post({ treeId: TREE, email: 'khong-phai-email' }), env, w.doFetch)).status).toBe(400);
    expect((await handleInviteEmail(post(valid), { ...env, RESEND_API_KEY: undefined }, w.doFetch)).status).toBe(503);
    expect((await handleInviteEmail(post(valid), env, world({ unauthorized: true }).doFetch)).status).toBe(401);
    expect(w.sent()).toBeNull();
  });

  it('email không có lời mời chờ trong gia phả này: 404 và không gửi (không dùng làm cổng gửi thư tuỳ ý)', async () => {
    const w = world({ pending: [{ email: 'khac@example.com', role: 'viewer' }] });
    expect((await handleInviteEmail(post(valid), env, w.doFetch)).status).toBe(404);
    expect(w.sent()).toBeNull();
    expect(w.calls).not.toContain('rpc/claim_invitation_email');
  });

  it('vừa gửi chưa đầy 1 phút (claim trả false): 429, không gửi', async () => {
    const w = world({ claim: false });
    expect((await handleInviteEmail(post(valid), env, w.doFetch)).status).toBe(429);
    expect(w.sent()).toBeNull();
  });

  it('Resend từ chối: 502 kèm gợi ý xác minh tên miền, và nhả lượt gửi để thử lại ngay', async () => {
    const w = world({ resendStatus: 403 });
    const response = await handleInviteEmail(post(valid), env, w.doFetch);
    expect(response.status).toBe(502);
    expect(((await response.json()) as { error: string }).error).toContain('tên miền');
    expect(w.calls.at(-1)).toBe('rpc/release_invitation_email');
  });
});

describe('renderInvite', () => {
  it('thiếu tên người mời thì dùng "Chủ sở hữu gia phả"; bản chữ thường có link đăng ký', () => {
    const mail = renderInvite({ inviter: '', treeName: 'Họ Lê', role: 'viewer', signUpUrl: 'https://a.test/dang-nhap' });
    expect(mail.subject).toBe('Chủ sở hữu gia phả mời bạn tham gia gia phả Họ Lê');
    expect(mail.text).toContain('Người xem');
    expect(mail.text).toContain('https://a.test/dang-nhap');
  });
});
