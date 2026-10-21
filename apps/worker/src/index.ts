import { deliverDigests, withRetry } from './deliver.ts';
import { buildDigests, DIGEST_PERIOD_DAYS, isDigestDay } from './digest.ts';
import { loadReminderData } from './fetch-data.ts';
import { renderDigestHtml, renderDigestText } from './render-email.ts';
import { brevoSender } from './send.ts';
import { todayInVietnam, type SolarDate } from '@gia-pha/lunar';

const parsePinnedDay = (text: string): SolarDate => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new Error(`DIGEST_TODAY phải có dạng YYYY-MM-DD, nhận được "${text}".`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  BREVO_API_KEY: string;
  BREVO_FROM: string;
  APP_URL: string;
  /** Chỉ để kiểm tra gửi mail: YYYY-MM-DD thay cho "hôm nay" và bỏ qua quy tắc ngày gửi. Không đặt trong production. */
  DIGEST_TODAY?: string;
}

/**
 * Chạy mỗi ngày (wrangler.toml) nhưng chỉ gửi vào ngày chia hết cho chu kỳ 5 ngày (`isDigestDay`): gom giỗ, sinh nhật,
 * kỷ niệm cưới và Sự kiện của 5 ngày tới, mỗi Gia phả một email gửi chung cho Chủ sở hữu và Biên tập viên.
 * Tải dữ liệu lỗi thì thử lại vài lần rồi mới thất bại; gửi lỗi từng gia phả được thử lại (xem deliver.ts) và không chặn
 * gia phả khác. Còn gia phả gửi hỏng thì cuối cùng ném lỗi để lần chạy hiện là thất bại trên Cloudflare, không im lặng.
 */
export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const pinned = env.DIGEST_TODAY ? parsePinnedDay(env.DIGEST_TODAY) : null;
    const today = pinned ?? todayInVietnam();
    if (!pinned && !isDigestDay(today)) return;
    const data = await withRetry(() => loadReminderData(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY), (ms) => new Promise((r) => setTimeout(r, ms)), 3);

    const report = await deliverDigests(buildDigests({ today, source: data.source, recipientsByTree: data.recipientsByTree }), {
      send: brevoSender({ apiKey: env.BREVO_API_KEY, from: env.BREVO_FROM }),
      dateKey: `${today.year}-${today.month}-${today.day}`,
      render: (digest) => {
        const meta = { treeName: digest.treeName, days: DIGEST_PERIOD_DAYS };
        return {
          subject: `Nhắc nhở từ Gia Phả — ${digest.treeName}`,
          html: renderDigestHtml(digest.occurrences, env.APP_URL, meta),
          text: renderDigestText(digest.occurrences, meta),
        };
      },
    });
    console.log(`Bản tin nhắc nhở: gửi ${report.sent} gia phả, lỗi ${report.failed.length}.`);
    if (report.failed.length > 0) {
      throw new Error(`Không gửi được bản tin cho ${report.failed.length} gia phả: ${report.failed.map((f) => `${f.treeId} (${f.error})`).join('; ')}`);
    }
  },
};
