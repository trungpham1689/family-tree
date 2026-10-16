// Đi qua các trang chính ở khổ điện thoại 375px: không được tràn ngang.
// Dùng lại tài khoản và gia phả walk-2 vừa tạo (ghi trong walk-2.json).
import { readFileSync } from 'node:fs';
import { APP, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const { email, treeUrl, publicUrl } = JSON.parse(readFileSync(`${SHOTS}/walk-2.json`, 'utf8'));
const { browser, page, problems } = await openBrowser({ mobile: true });

await page.goto(`${APP}/dang-nhap`);
await page.getByLabel('Email').fill(email);
await page.getByLabel('Mật khẩu').first().fill('matkhau123');
await page.getByRole('button', { name: 'Đăng nhập' }).last().click();
await page.waitForURL(/\/gia-pha$/);

const checkOverflow = async (name) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${SHOTS}/m-${name}.png`, fullPage: true });
  if (overflow > 0) process.exitCode = 1;
  console.log(`${overflow > 0 ? 'TRÀN' : 'OK  '} ${name}${overflow > 0 ? ` (+${overflow}px)` : ''}`);
};

const pages = {
  'danh-sach': `${APP}/gia-pha`,
  'gia-pha': treeUrl,
  cay: `${treeUrl}/cay`,
  'su-kien': `${treeUrl}/su-kien`,
  'pha-do': `${treeUrl}/pha-do`,
  'nhap-excel': `${treeUrl}/nhap-excel`,
  lich: `${APP}/lich`,
  'sap-toi': `${APP}/sap-toi`,
  'cong-khai': publicUrl,
};
for (const [name, url] of Object.entries(pages)) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await checkOverflow(name);
}
const firstPerson = await page.goto(treeUrl).then(() => page.locator('a[href*="/nguoi/"]').first().getAttribute('href'));
await page.goto(`${APP}${firstPerson}`);
await page.waitForLoadState('networkidle');
await checkOverflow('nguoi');
reportProblems(problems);
await browser.close();
