import { buildDigests, isDigestDay } from './digest.ts';
import { loadReminderData } from './fetch-data.ts';
import { renderDigestHtml, renderDigestText } from './render-email.ts';
import { sendEmail } from './send.ts';
import { todayInVietnam } from '@gia-pha/lunar';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  APP_URL: string;
}

/**
 * Chạy mỗi ngày (wrangler.toml) nhưng chỉ gửi vào ngày chia hết cho chu kỳ 5 ngày (`isDigestDay`): gom giỗ và
 * Sự kiện của 5 ngày tới, mỗi Gia phả một email gửi chung cho Chủ sở hữu và Biên tập viên. Gia phả không có gì
 * sắp tới thì không gửi. Email lỗi chỉ ghi log; không có trạng thái "đã đọc" nên không gửi bù.
 */
export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const today = todayInVietnam();
    if (!isDigestDay(today)) return;
    const data = await loadReminderData(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const resend = { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM };

    // Gửi lần lượt (Resend giới hạn tốc độ); một Gia phả lỗi không chặn các Gia phả sau.
    for (const digest of buildDigests({ today, source: data.source, recipientsByTree: data.recipientsByTree })) {
      try {
        await sendEmail(
          resend,
          digest.emails,
          `Nhắc nhở từ Gia Phả — ${digest.treeName}`,
          renderDigestHtml(digest.occurrences, env.APP_URL),
          renderDigestText(digest.occurrences),
        );
      } catch (error) {
        console.error(`Gửi nhắc nhở gia phả ${digest.treeId} lỗi:`, error);
      }
    }
  },
};
