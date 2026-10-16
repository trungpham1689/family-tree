import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

export const APP = process.env.E2E_APP_URL ?? 'http://127.0.0.1:4173';
/** Ảnh chụp màn hình và file tải về của các kịch bản; CI tải thư mục này lên khi có lỗi. */
export const SHOTS = process.env.SHOTS ?? join(import.meta.dirname, '.out');
mkdirSync(SHOTS, { recursive: true });

/** In các vấn đề ghi nhận; có vấn đề thì kịch bản kết thúc với mã lỗi. */
export const reportProblems = (problems) => {
  const unique = [...new Set(problems)];
  console.log('\n--- vấn đề ghi nhận ---\n' + (unique.join('\n') || '(không có)'));
  if (unique.length > 0) process.exitCode = 1;
};

/** Một bước của kịch bản: in OK/FAIL, chụp màn hình khi hỏng, không dừng các bước sau. */
export const makeStep = (getPage) => async (name, work) => {
  try {
    const note = await work();
    console.log(`OK   ${name}${note ? ` — ${note}` : ''}`);
  } catch (error) {
    process.exitCode = 1;
    console.log(`FAIL ${name} — ${error.message.split('\n')[0]}`);
    await getPage()
      .screenshot({ path: `${SHOTS}/FAIL-${name.replace(/[^a-z0-9]+/gi, '-')}.png`, fullPage: true })
      .catch(() => {});
  }
};

/** Mở trình duyệt, ghi lại mọi lỗi console / request thất bại để báo cáo. */
export const openBrowser = async ({ mobile = false } = {}) => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 375, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'vi-VN' }
      : { viewport: { width: 1366, height: 860 }, locale: 'vi-VN', acceptDownloads: true },
  );
  // Font Google không phải phần của app; trả về rỗng để kết quả không phụ thuộc mạng ngoài.
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const problems = [];
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`[console.${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('/auth/v1/user')) {
      problems.push(`[http ${response.status()}] ${response.request().method()} ${response.url()}`);
    }
  });
  return { browser, context, page, problems };
};
