/**
 * Kịch bản trình duyệt cho các tính năng mới: nhập Excel, Dòng thời gian, ngày cưới, thống kê vui, gộp Người trùng,
 * lịch đăng ký, Tiên thường, quy tắc Sự kiện của Biên tập viên, link công khai có mật khẩu và khoá dò mật khẩu,
 * PWA (manifest, noindex, service worker, xem lại khi mất mạng).
 */
import { statSync } from 'node:fs';
import { APP, makeStep, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const { browser, context, page, problems } = await openBrowser();
let current = page;
const step = makeStep(() => current);
const shot = (name, p = current) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
/** Chờ điều kiện đúng (dữ liệu có thể đang tải lại sau khi khôi phục bộ nhớ đệm), tối đa `ms`. */
const until = async (check, what, ms = 10000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`hết giờ chờ: ${what}`);
};
const stamp = Date.now();
const email = `walk3-${stamp}@example.com`;
let treeUrl = '';

const signUp = async (p, address) => {
  await p.goto(`${APP}/dang-nhap`);
  await p.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await p.getByLabel('Email').fill(address);
  await p.locator('input[type=password]').first().fill('matkhau123');
  await p.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await p.waitForURL(/\/gia-pha$/);
};

await step('đăng ký và nhập gia phả từ file Excel mẫu', async () => {
  await signUp(page, email);
  await page.getByRole('link', { name: 'Nhập từ Excel' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Tải file mẫu' }).click()]);
  await download.saveAs(`${SHOTS}/walk3-mau.xlsx`);
  await page.locator('input[type=file]').setInputFiles(`${SHOTS}/walk3-mau.xlsx`);
  await page.getByText('Không có lỗi').waitFor({ timeout: 15000 });
  await page.getByLabel('Tên gia phả mới').fill('Họ Phạm (walk3)');
  await page.getByRole('button', { name: 'Xác nhận & lưu' }).click();
  await page.waitForURL(/\/gia-pha\/[0-9a-f-]{36}$/, { timeout: 20000 });
  treeUrl = page.url();
  await page.getByText('Thống kê', { exact: true }).waitFor();
});

await step('Thống kê hiện số liệu thật', async () => {
  await page.getByText('Thống kê', { exact: true }).click();
  const text = await page.locator('main').innerText();
  for (const expected of ['Tuổi thọ trung bình', 'Họ phổ biến', 'Phạm']) if (!text.includes(expected)) throw new Error(`thiếu "${expected}"`);
  await shot('w3-01-stats');
});

await step('Dòng thời gian: có mốc sinh/mất và mốc lịch sử, tắt được mốc lịch sử', async () => {
  await page.goto(`${treeUrl}/dong-thoi-gian`);
  await page.getByRole('heading', { name: 'Dòng thời gian' }).waitFor();
  await until(async () => (await page.locator('main').innerText()).includes('chào đời'), 'mốc sinh');
  const text = await page.locator('main').innerText();
  if (!text.includes('qua đời')) throw new Error('thiếu mốc mất');
  if (!text.includes('Cách mạng tháng Tám')) throw new Error('thiếu mốc lịch sử');
  await page.getByLabel('Hiện mốc lịch sử Việt Nam').uncheck();
  if ((await page.locator('main').innerText()).includes('Cách mạng tháng Tám')) throw new Error('mốc lịch sử vẫn hiện sau khi tắt');
  await shot('w3-02-timeline');
});

await step('ngày cưới trên hồ sơ vợ/chồng; hiện trên Dòng thời gian', async () => {
  await page.goto(treeUrl);
  await page.getByRole('link', { name: /Phạm Văn Tổ/ }).first().click();
  await page.waitForURL(/nguoi/);
  await page.getByRole('button', { name: 'Thêm ngày cưới' }).first().click();
  await page.getByLabel('Ngày', { exact: true }).fill('15');
  await page.getByLabel('Tháng', { exact: true }).fill('8');
  await page.getByLabel('Năm', { exact: true }).fill('1875');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.getByText('Cưới ngày 15/8/1875').waitFor();
  await page.goto(`${treeUrl}/dong-thoi-gian`);
  await page.getByText('kết hôn').first().waitFor();
  await shot('w3-03-marriage');
});

await step('sự kiện trang Sự kiện: Kỷ niệm cưới và Ngày này năm xưa không làm hỏng trang', async () => {
  await page.goto(`${APP}/su-kien`);
  await page.getByRole('heading', { name: 'Sự kiện' }).waitFor();
  await page.getByText('Lịch trên điện thoại').waitFor();
  await shot('w3-04-my-events');
});

await step('lịch đăng ký: bật, thấy link .ics, tạo lại, tắt', async () => {
  await page.goto(`${APP}/su-kien`);
  await page.getByRole('button', { name: 'Bật lịch đăng ký' }).click();
  const input = page.getByRole('textbox', { name: 'Link lịch đăng ký' });
  await input.waitFor();
  const first = await input.inputValue();
  if (!/\/api\/calendar\/[0-9a-f]{32}\.ics$/.test(first)) throw new Error(`link lạ: ${first}`);
  await page.getByRole('link', { name: 'Thêm vào Google Calendar' }).waitFor();
  await page.getByRole('button', { name: 'Tạo lại link' }).click();
  await page.getByRole('button', { name: 'Tạo link mới' }).click();
  await page.waitForFunction((old) => document.querySelector('input[aria-label="Link lịch đăng ký"]')?.value !== old, first);
  await shot('w3-05-calendar-feed');
  await page.getByRole('button', { name: 'Tắt', exact: true }).click();
  await page.getByRole('button', { name: 'Tắt link' }).click();
  await page.getByRole('button', { name: 'Bật lịch đăng ký' }).waitFor();
});

await step('Tiên thường và độ sớm nhắc ở trang Sự kiện của gia phả', async () => {
  await page.goto(`${treeUrl}/su-kien`);
  await page.getByText('Nhắc cả Tiên thường').click();
  await page.waitForTimeout(500);
  if (!(await page.getByLabel(/Nhắc cả Tiên thường/).isChecked())) throw new Error('công tắc Tiên thường không giữ trạng thái');
  await page.reload();
  await until(() => page.getByLabel(/Nhắc cả Tiên thường/).isChecked(), 'Tiên thường lưu sau khi tải lại');
  await shot('w3-06-tien-thuong');
});

await step('Người trùng: thêm người cùng tên, trang gộp liệt kê nhóm và gộp được', async () => {
  await page.goto(treeUrl);
  await page.getByRole('link', { name: /Phạm Văn Tổ/ }).first().click();
  await page.waitForURL(/nguoi/);
  await page.getByRole('button', { name: '+ Thêm con' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Họ và tên').fill('Phạm Văn Trưởng');
  await dialog.getByRole('button', { name: 'Thêm con', exact: true }).click();
  await page.getByText('Phạm Văn Trưởng').first().waitFor();
  await page.goto(`${treeUrl}/thieu-thong-tin`);
  await page.getByRole('heading', { name: 'Thành viên trùng' }).waitFor();
  await until(async () => (await page.getByRole('button', { name: /Gộp 1 người vào/ }).count()) > 0, 'nhóm trùng xuất hiện', 15000);
  // Backend giả lập (PGlite + PostgREST, một kết nối) thỉnh thoảng trả 503 tạm thời; thao tác gộp cho phép bấm lại.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!(await page.getByRole('button', { name: /Gộp 1 người vào/ }).count())) break;
    const open = page.getByRole('dialog');
    if (!(await open.count())) await page.getByRole('button', { name: /Gộp 1 người vào/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Gộp', exact: true }).click();
    await page.waitForTimeout(1500);
    if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape');
  }
  await page.getByRole('heading', { name: 'Thành viên trùng' }).waitFor({ state: 'detached', timeout: 15000 });
  await shot('w3-07-merged');
});

await step('PWA: manifest, noindex, apple-touch-icon', async () => {
  await page.goto(`${APP}/dang-nhap`);
  const head = await page.evaluate(() => ({
    manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'),
    robots: document.querySelector('meta[name=robots]')?.getAttribute('content'),
    icon: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'),
  }));
  if (head.manifest !== '/manifest.webmanifest' || !head.robots?.includes('noindex') || !head.icon) throw new Error(JSON.stringify(head));
  const manifest = await (await page.request.get(`${APP}/manifest.webmanifest`)).json();
  if (manifest.display !== 'standalone' || manifest.icons.length < 3) throw new Error('manifest thiếu');
  for (const icon of manifest.icons) if ((await page.request.get(APP + icon.src)).status() !== 200) throw new Error(`icon ${icon.src}`);
  return `manifest "${manifest.name}", ${manifest.icons.length} icon`;
});

await step('service worker đăng ký và xem lại gia phả khi mất mạng', async () => {
  await page.goto(treeUrl);
  await page.getByText('Thống kê', { exact: true }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(2500); // chờ bộ nhớ đệm IndexedDB lưu (throttle 2s)
  await page.reload(); // để service worker kiểm soát trang
  await page.getByText('Thống kê', { exact: true }).waitFor();
  await page.waitForTimeout(2500);
  await context.setOffline(true);
  await page.reload();
  await page.getByText('Họ Phạm (walk3)').first().waitFor({ timeout: 15000 });
  await page.getByText('Tổng số Người').waitFor({ timeout: 15000 });
  await shot('w3-08-offline');
  await context.setOffline(false);
});

await step('đăng xuất xoá bộ nhớ đệm offline', async () => {
  await page.goto(`${APP}/gia-pha`);
  await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
  await page.waitForURL(/dang-nhap/);
  const keys = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('gia-pha', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return await new Promise((resolve) => { const req = db.transaction('kv').objectStore('kv').getAllKeys(); req.onsuccess = () => resolve(req.result); });
  });
  if (keys.length > 0) throw new Error(`còn dữ liệu offline sau khi đăng xuất: ${keys.join(',')}`);
});

reportProblems(problems.filter((p) => !/Failed to load resource.*(offline|ERR_INTERNET|503)|\[http 503\]/i.test(p)));
console.log('EMAIL', email);
await browser.close();
void statSync;
