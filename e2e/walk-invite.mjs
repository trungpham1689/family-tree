// Mời Quản trị viên bằng email chưa có tài khoản: lời mời chờ; người đó đăng ký bằng đúng email này thì thấy gia phả mà không cần mời lại.
import { APP, makeStep, openBrowser, reportProblems, SHOTS } from './walk-lib.mjs';

const { browser, page, problems } = await openBrowser();
const step = makeStep(() => page);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const stamp = Date.now();
const guestEmail = `moi-chua-co-${stamp}@example.com`;
let treeUrl = '';
// Preview của e2e không có Pages Functions: giả /api/invite-email, ghi lại các lần gọi (email thật được kiểm tra bằng unit test của handler).
const emailCalls = [];
await page.route('**/api/invite-email', async (route) => {
  emailCalls.push({ auth: route.request().headers().authorization, body: route.request().postDataJSON() });
  await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
});

const signUp = async (target, email, name) => {
  await target.goto(`${APP}/`);
  await target.waitForURL(/dang-nhap/);
  await target.getByRole('tab', { name: 'Tạo tài khoản' }).click();
  await target.getByLabel('Email').fill(email);
  await target.getByLabel('Họ và tên').fill(name);
  await target.getByLabel('Ngày sinh').fill('1990-01-01');
  await target.getByLabel('Số điện thoại').fill('0901234567');
  await target.locator('input[type=password]').first().fill('matkhau123');
  await target.getByRole('button', { name: 'Tạo tài khoản' }).last().click();
  await target.waitForURL(/\/gia-pha$/);
};

await step('Chủ sở hữu tạo gia phả rồi mời email chưa có tài khoản: báo đã lưu lời mời, hiện trong "Lời mời chờ đăng ký"', async () => {
  await signUp(page, `chu-moi-${stamp}@example.com`, 'Chủ Gia Phả');
  await page.getByRole('button', { name: /Tạo gia phả/ }).first().click();
  await page.getByLabel('Tên gia phả').fill('Họ Được Mời');
  await page.getByRole('dialog').getByRole('button', { name: 'Tạo gia phả' }).click();
  await page.waitForURL(/\/gia-pha\/[0-9a-f-]{36}$/);
  treeUrl = page.url();

  await page.getByRole('button', { name: '+ Thêm quản trị' }).click();
  await page.getByLabel('Email tài khoản').fill(guestEmail.toUpperCase());
  await page.getByRole('button', { name: 'Mời', exact: true }).click();
  const status = page.getByRole('status');
  await status.waitFor();
  const notice = await status.textContent();
  assert(notice.includes('Đã lưu lời mời') && notice.includes('Đã gửi email mời'), `thông báo thiếu: ${notice}`);
  assert(emailCalls.length === 1 && emailCalls[0].auth?.startsWith('Bearer ') && emailCalls[0].body.email === guestEmail, 'không gọi /api/invite-email đúng một lần với phiên đăng nhập');
  await page.getByRole('heading', { name: 'Lời mời chờ đăng ký' }).waitFor();
  await page.getByText(guestEmail, { exact: true }).waitFor();
  await page.screenshot({ path: `${SHOTS}/moi-cho-dang-ky.png`, fullPage: true });
});

await step('người được mời đăng ký bằng đúng email: thấy gia phả, vai trò Biên tập viên; Chủ sở hữu thấy lời mời hết chờ', async () => {
  const guest = await browser.newContext({ locale: 'vi-VN' });
  await guest.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const guestPage = await guest.newPage();
  await signUp(guestPage, guestEmail, 'Quản Trị Mới');
  await guestPage.getByText('Họ Được Mời').first().waitFor({ timeout: 15000 });
  await guestPage.goto(treeUrl);
  await guestPage.getByText('Vai trò của bạn: Biên tập viên').waitFor();
  await guest.close();

  await page.goto(treeUrl);
  await page.getByText(guestEmail, { exact: true }).first().waitFor();
  assert((await page.getByRole('heading', { name: 'Lời mời chờ đăng ký' }).count()) === 0, 'lời mời vẫn còn chờ sau khi người đó đăng ký');
});

await step('huỷ lời mời chờ: biến mất khỏi danh sách', async () => {
  await page.getByRole('button', { name: '+ Thêm quản trị' }).click();
  await page.getByLabel('Email tài khoản').fill(`huy-${stamp}@example.com`);
  await page.getByRole('button', { name: 'Mời', exact: true }).click();
  await page.getByText(`huy-${stamp}@example.com`, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Huỷ lời mời' }).click();
  await page.getByRole('heading', { name: 'Lời mời chờ đăng ký' }).waitFor({ state: 'detached' });
});

await browser.close();
reportProblems(problems);
