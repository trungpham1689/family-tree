// Đi qua các trang chính ở khổ điện thoại 375px: không được tràn ngang.
import { APP, openBrowser } from './walk-lib.mjs';

const [treeUrl, publicUrl, email] = process.argv.slice(2);
const SHOTS = process.env.SHOTS;
const { browser, page, problems } = await openBrowser({ mobile: true });

await page.goto(`${APP}/dang-nhap`);
await page.getByLabel('Email').fill(email);
await page.getByLabel('Mật khẩu').first().fill('matkhau123');
await page.getByRole('button', { name: 'Đăng nhập' }).last().click();
await page.waitForURL(/\/gia-pha$/);

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
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${SHOTS}/m-${name}.png`, fullPage: true });
  console.log(`${overflow > 0 ? 'TRÀN' : 'OK  '} ${name}${overflow > 0 ? ` (+${overflow}px)` : ''}`);
}
const firstPerson = await page.goto(treeUrl).then(() => page.locator('a[href*="/nguoi/"]').first().getAttribute('href'));
await page.goto(`${APP}${firstPerson}`);
await page.waitForLoadState('networkidle');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
await page.screenshot({ path: `${SHOTS}/m-nguoi.png`, fullPage: true });
console.log(`${overflow > 0 ? 'TRÀN' : 'OK  '} nguoi`);
console.log(problems.length ? problems.join('\n') : '(không có lỗi console)');
await browser.close();
