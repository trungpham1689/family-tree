import { deliverDigests, withRetry } from './deliver.ts';
import { buildDigests, DIGEST_PERIOD_DAYS, isDigestDay } from './digest.ts';
import { loadReminderData } from './fetch-data.ts';
import { renderDigestHtml, renderDigestText } from './render-email.ts';
import { resendSender } from './send.ts';
import { todayInVietnam } from '@gia-pha/lunar';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  APP_URL: string;
}

/**
 * Chạy mỗi ngày (wrangler.toml) nhưng chỉ gửi vào ngày chia hết cho chu kỳ 5 ngày (`isDigestDay`): gom giỗ, sinh nhật,
 * kỷ niệm cưới và Sự kiện của 5 ngày tới, mỗi Gia phả một email gửi chung cho Chủ sở hữu và Biên tập viên.
 * Tải dữ liệu lỗi thì thử lại vài lần rồi mới thất bại; gửi lỗi từng gia phả được thử lại (xem deliver.ts) và không chặn
 * gia phả khác. Còn gia phả gửi hỏng thì cuối cùng ném lỗi để lần chạy hiện là thất bại trên Cloudflare, không im lặng.
 */
export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const today = todayInVietnam();
    if (!isDigestDay(today)) return;
    const data = await withRetry(() => loadReminderData(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY), (ms) => new Promise((r) => setTimeout(r, ms)), 3);

    const report = await deliverDigests(buildDigests({ today, source: data.source, recipientsByTree: data.recipientsByTree }), {
      send: resendSender({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM }),
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
