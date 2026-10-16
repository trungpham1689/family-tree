import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');

export const APP = process.env.E2E_APP_URL ?? 'http://127.0.0.1:4173';

/** Mở trình duyệt, ghi lại mọi lỗi console / request thất bại để báo cáo. */
export const openBrowser = async ({ mobile = false } = {}) => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 375, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'vi-VN' }
      : { viewport: { width: 1366, height: 860 }, locale: 'vi-VN', acceptDownloads: true },
  );
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
