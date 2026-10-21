// Sự kiện sắp tới / hôm nay lên trên, đã qua gập sẵn, ở mọi nơi hiện danh sách sự kiện:
// Gia phả của tôi (/gia-pha), Lịch (/lich), Sự kiện (/su-kien) và tìm kiếm Sự kiện của một Gia phả.
// Dữ liệu giả: ngày cố định 15/10/2026, sự kiện giả ở các ngày 3, 14 (đã qua), 15 (hôm nay), 17, 29 (sắp tới); không có Người nên không lẫn sinh nhật, giỗ.
import { readFileSync } from 'node:fs';
import { APP, makeStep, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const { email, treeUrl } = JSON.parse(readFileSync(`${SHOTS}/walk-2.json`, 'utf8'));
const treeId = treeUrl.split('/').pop();
const { browser, page, problems } = await openBrowser();
const step = makeStep(() => page);

const EVENTS = [
  [3, 'Sự kiện đã qua ba'],
  [14, 'Sự kiện đã qua mười bốn'],
  [15, 'Sự kiện hôm nay'],
  [17, 'Sự kiện mười bảy'],
  [29, 'Sự kiện hai chín'],
].map(([day, title], index) => ({
  id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
  tree_id: treeId,
  title,
  calendar: 'duong',
  repeats_yearly: true,
  year: null,
  month: 10,
  day,
  leap: false,
  start_time: null,
  location: null,
}));
const UPCOMING = ['Sự kiện hôm nay', 'Sự kiện mười bảy', 'Sự kiện hai chín'];
const PAST = ['Sự kiện đã qua mười bốn', 'Sự kiện đã qua ba'];

await page.clock.setFixedTime(new Date('2026-10-15T05:00:00+07:00'));
// Chỉ dữ liệu lịch (lọc theo nhiều gia phả: tree_id=in.) bị thay; danh sách sự kiện của riêng một gia phả giữ nguyên.
const calendarRows = { tree_events: EVENTS, persons: [], unions: [] };
await page.route(/rest\/v1\/(tree_events|persons|unions)\?/, (route) => {
  const request = route.request();
  const table = new URL(request.url()).pathname.split('/').pop();
  if (request.method() !== 'GET' || !request.url().includes('tree_id=in')) return route.continue();
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(calendarRows[table]) });
});
let dataRequests = 0;
page.on('request', (request) => {
  if (/rest\/v1\/(tree_events|persons|unions)\?/.test(request.url()) && request.url().includes('tree_id=in')) dataRequests += 1;
});

await page.goto(`${APP}/dang-nhap`);
await page.getByLabel('Email').fill(email);
await page.locator('input[type=password]').first().fill('matkhau123');
await page.getByRole('button', { name: 'Đăng nhập' }).last().click();
await page.waitForURL(/\/gia-pha$/);

// Không exact: ở dòng không có liên kết (trang tìm kiếm) tên nằm chung thẻ với dòng đọc ngày cho trình đọc màn hình.
const top = async (root, text) => (await root.getByText(text).first().boundingBox()).y;

/** Danh sách sự kiện tháng: sắp tới trên, đã qua gập sẵn; mở ra mới thấy, gập lại ẩn; không gọi thêm API. */
const checkMonthList = async (root, label) => {
  for (const title of UPCOMING) await root.getByText(title, { exact: true }).waitFor();
  for (const title of PAST) {
    if (await root.getByText(title, { exact: true }).isVisible()) throw new Error(`${label}: "${title}" (đã qua) hiện khi chưa mở`);
  }
  if ((await top(root, UPCOMING[0])) >= (await top(root, UPCOMING[1])) || (await top(root, UPCOMING[1])) >= (await top(root, UPCOMING[2]))) {
    throw new Error(`${label}: sắp tới không theo thứ tự ngày`);
  }
  await root.getByText('Hôm nay', { exact: true }).first().waitFor();
  await root.getByText('Còn 2 ngày', { exact: true }).waitFor();
  const toggle = root.getByRole('button', { name: 'Đã qua (2)' });
  if ((await toggle.getAttribute('aria-expanded')) !== 'false') throw new Error(`${label}: nút Đã qua không gập sẵn`);
  const before = dataRequests;
  await toggle.click();
  for (const title of PAST) await root.getByText(title, { exact: true }).waitFor();
  await root.getByText('Đã qua · 1 ngày trước').waitFor();
  if ((await top(root, PAST[0])) <= (await top(root, UPCOMING[2]))) throw new Error(`${label}: đã qua phải nằm dưới sắp tới`);
  if ((await top(root, PAST[0])) >= (await top(root, PAST[1]))) throw new Error(`${label}: đã qua phải mới nhất trước`);
  await toggle.click();
  await root.getByText(PAST[0], { exact: true }).waitFor({ state: 'hidden' });
  if (dataRequests !== before) throw new Error(`${label}: mở/gập gọi thêm ${dataRequests - before} API`);
};

await step('Gia phả của tôi: sự kiện tháng dưới danh sách gia phả; sắp tới trên, đã qua gập sẵn', async () => {
  await page.goto(`${APP}/gia-pha`);
  await page.getByRole('heading', { name: 'Sự kiện trong tháng 10/2026' }).waitFor();
  const section = page.locator('main > div').filter({ has: page.getByRole('heading', { name: 'Sự kiện trong tháng 10/2026' }) });
  await checkMonthList(section, 'Gia phả của tôi');
  const heading = await page.getByRole('heading', { name: 'Sự kiện trong tháng 10/2026' }).boundingBox();
  const card = await page.locator(`a[href="/gia-pha/${treeId}"]`).first().boundingBox();
  if (heading.y <= card.y) throw new Error('sự kiện phải nằm dưới danh sách gia phả');
  await page.screenshot({ path: `${SHOTS}/eo-home.png`, fullPage: true });
});

await step('Lịch: danh sách tháng sắp tới trên, đã qua gập sẵn; đổi tháng không gọi thêm API', async () => {
  await page.goto(`${APP}/lich`);
  const section = page.getByRole('region', { name: 'Sự kiện trong tháng' });
  await checkMonthList(section, 'Lịch');
  const before = dataRequests;
  await page.getByRole('button', { name: 'Tháng sau' }).click();
  await page.getByRole('button', { name: 'Tháng trước' }).click();
  await page.waitForTimeout(500);
  if (dataRequests !== before) throw new Error('đổi tháng gọi thêm API');
  await page.screenshot({ path: `${SHOTS}/eo-lich.png`, fullPage: true });
});

await step('Sự kiện (30 ngày tới): chỉ hôm nay và sắp tới, không có đã qua', async () => {
  await page.goto(`${APP}/su-kien`);
  for (const title of UPCOMING) await page.getByText(title, { exact: true }).waitFor();
  for (const title of PAST) {
    if ((await page.getByText(title, { exact: true }).count()) > 0) throw new Error(`"${title}" (đã qua) không được có ở Sắp tới`);
  }
});

await step('Tìm kiếm Sự kiện của gia phả: mặc định sắp tới; 30 ngày qua có Đã qua và vạch Hôm nay', async () => {
  await page.goto(`${treeUrl}/su-kien`);
  const panel = page.getByRole('region', { name: 'Tìm sự kiện' });
  for (const title of UPCOMING) await panel.getByText(title).waitFor();
  if ((await panel.getByText(PAST[0]).count()) > 0) throw new Error('mặc định (30 ngày tới) không được có sự kiện đã qua');
  await panel.getByRole('button', { name: '30 ngày qua' }).click();
  await panel.getByText(PAST[0]).waitFor();
  await panel.getByText('Đã qua · 1 ngày trước').waitFor();
  await panel.getByText(/Hôm nay · Thứ Năm 15\/10/).waitFor();
  if ((await top(panel, PAST[1])) >= (await top(panel, PAST[0]))) throw new Error('tìm kiếm xếp theo ngày tăng dần');
  if ((await top(panel, PAST[0])) >= (await top(panel, UPCOMING[0]))) throw new Error('đã qua phải nằm trên vạch Hôm nay');
  await page.screenshot({ path: `${SHOTS}/eo-search.png`, fullPage: true });
});

reportProblems(problems);
await browser.close();
