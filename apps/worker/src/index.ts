import { createClient } from '@supabase/supabase-js';
import { notificationKey } from '@gia-pha/reminders';
import { buildDigests } from './digest.ts';
import { loadReminderData } from './fetch-data.ts';
import { renderDigestHtml, renderDigestText } from './render-email.ts';
import { sendEmail } from './send.ts';
import { todayInVietnam } from './vietnam-today.ts';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  APP_URL: string;
}

/**
 * Chạy mỗi thứ Hai (wrangler.toml): tính sự kiện 7 ngày tới, chưa đọc, chưa tắt email của mỗi tài
 * khoản — đúng logic @gia-pha/reminders mà web dùng — gộp thành một email, gửi qua Resend. Không
 * có gì sắp tới thì không gửi. Gửi xong mới đánh dấu đã đọc, nên gửi lỗi thì tuần sau thử lại.
 */
export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const data = await loadReminderData(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const digests = buildDigests({ today: todayInVietnam(), ...data });
    if (digests.length === 0) return;

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const resend = { apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM };

    for (const digest of digests) {
      ctx.waitUntil(
        sendEmail(
          resend,
          digest.email,
          'Nhắc nhở từ Gia Phả',
          renderDigestHtml(digest.occurrences, env.APP_URL),
          renderDigestText(digest.occurrences),
        )
          .then(() =>
            supabase.from('notification_reads').upsert(
              digest.occurrences.map((occurrence) => ({
                account_id: digest.accountId,
                notification_key: notificationKey(occurrence),
              })),
            ),
          )
          .catch((error: unknown) => console.error(`Gửi nhắc nhở cho ${digest.email} lỗi:`, error)),
      );
    }
  },
};
